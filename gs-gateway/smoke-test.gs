import { loadConfig } from "@/config";
import { openGatewayStore } from "@/models/store";
import { createGatewayModel } from "@/models/gateway";
import { buildAgentTaskPayloadForGateway, buildGatewayIMReply } from "@/models/agent_bridge";
import { tick as outboundTick } from "@/models/im_outbound";

let fs = require("@std/fs");
let path = require("@std/path");


function assertOK(value, message) {
  if (!value) {
    throw new Error(message);
  }
}

function assertError(fn, code, message) {
  let failed = false;
  let errorCode = "";
  try {
    fn();
  } catch (error) {
    failed = true;
    let text = String(error.message || "");
    if (text.startsWith("GATEWAY_ERROR|")) {
      let parts = text.split("|");
      errorCode = parts[2] || "";
    }
  }
  assertOK(failed, message);
  assertOK(errorCode === code, message + " code should be " + code + ", got " + errorCode);
}

function main() {
  let config = loadConfig();
  let smokeDb = path.join(config.root, ".gateway", "smoke-test-" + String((new Date()).getTime()) + ".db");
  config.gateway.database = smokeDb;
  let store = openGatewayStore(config.gateway.database);
  let model = createGatewayModel(config, store);

  let agent = model.agent.summary();
  assertOK(agent.exists, "agent root should exist: " + config.gateway.agentRoot);

  let received = model.receiveIM({
    platform: "onebot",
    adapter: "qq-local",
    sender: "smoke-user",
    chat: "smoke-chat",
    text: "hello gateway",
  });
  assertOK(received.event.id, "event id should be created");
  assertOK(received.conversation.id, "conversation id should be created");
  assertOK(received.task.id, "task id should be created");
  assertOK(received.task.payload.source.type === "im", "IM task should keep normalized source");
  assertOK(received.task.payload.source.eventId === received.event.id, "IM task should keep event id");
  assertOK(received.task.payload.input.text === "hello gateway", "IM task should keep input text");
  assertOK(received.task.payload.input.im.platform === "onebot", "IM task should keep platform");
  assertOK(received.task.payload.input.im.adapter === "qq-local", "IM task should keep adapter");
  assertOK(received.task.payload.input.im.chat === "smoke-chat", "IM task should keep chat");
  assertOK(received.task.payload.input.im.sender === "smoke-user", "IM task should keep sender");
  let bridgePayload = buildAgentTaskPayloadForGateway(model, received.task);
  assertOK(bridgePayload.input.text.indexOf("IM message received through gateway.") >= 0, "gateway should convert IM input into agent prompt");
  assertOK(bridgePayload.input.text.indexOf("hello gateway") >= 0, "gateway IM prompt should include original text");
  assertOK(bridgePayload.run.sessionId === received.conversation.id, "gateway should map IM conversation to agent session id");
  let replyInput = buildGatewayIMReply(received.task, {
    answer: "hello gateway reply",
  });
  assertOK(replyInput.conversationId === received.conversation.id, "gateway reply should keep conversation id");
  assertOK(replyInput.text === "hello gateway reply", "gateway reply should use agent answer");

  let imReply = store.createIMReply(replyInput);
  assertOK(imReply.status === "pending", "IM reply should be created as pending");
  outboundTick(store, config.im.outbound || { adapter: "console" });
  let processedReply = store.getIMReply(imReply.id);
  assertOK(processedReply.status === "sent", "IM outbound should send reply via console adapter");

  let conversations = model.im.listConversations({
    channelId: received.channel.id,
  });
  assertOK(conversations.length >= 1, "IM conversation should be listed");

  let task = store.updateTask(received.task.id, {
    status: "done",
    result: {
      message: "ok",
      answer: "hello gateway reply",
    },
  });
  assertOK(task.status === "done", "task should be updated");
  let imMessages = model.im.listConversationMessages(received.conversation.id);
  let sawIMToolMessage = false;
  for (let message of imMessages) {
    if (message.id === task.id + ":tool") {
      let toolCalls = message.tool_calls || [];
      if (toolCalls.length === 1) {
        sawIMToolMessage = toolCalls[0].ID === task.id &&
          toolCalls[0].Title === "网关任务" &&
          toolCalls[0].Status === "done";
      }
    }
  }
  assertOK(sawIMToolMessage, "IM conversation history should include gateway task tool call");

  let desktopConversationId = "desktop-history-" + String((new Date()).getTime());
  let firstDesktop = model.receiveIM({
    platform: "desktop",
    adapter: "wails",
    conversationId: desktopConversationId,
    sender: "desktop-user",
    chat: desktopConversationId,
    text: "first desktop history message",
  });
  let secondDesktop = model.receiveIM({
    platform: "desktop",
    adapter: "wails",
    conversationId: desktopConversationId,
    sender: "desktop-user",
    chat: desktopConversationId,
    text: "second desktop history message",
  });
  assertOK(firstDesktop.conversation.id === desktopConversationId, "desktop IM should keep explicit conversation id");
  assertOK(secondDesktop.conversation.id === desktopConversationId, "desktop IM should append to explicit conversation id");
  let desktopMessages = model.im.listConversationMessages(desktopConversationId);
  let sawFirstDesktop = false;
  let sawSecondDesktop = false;
  for (let message of desktopMessages) {
    if (message.content === "first desktop history message") {
      sawFirstDesktop = true;
    }
    if (message.content === "second desktop history message") {
      sawSecondDesktop = true;
    }
  }
  assertOK(sawFirstDesktop && sawSecondDesktop, "desktop history conversation should keep messages in the same conversation");

  let skillName = "gateway-smoke-skill";
  try {
    model.skills.remove(skillName);
  } catch (error) {
  }
  let createdSkill = model.skills.create({
    name: skillName,
    description: "Smoke test skill created by gs-gateway.",
    content: "# Gateway Smoke Skill\n\nTemporary skill for gateway tests.\n",
  });
  assertOK(createdSkill.name === skillName, "skill should be created");
  let updatedSkill = model.skills.update(skillName, {
    description: "Updated smoke test skill.",
  });
  assertOK(updatedSkill.description === "Updated smoke test skill.", "skill should be updated");
  try {
    model.skills.remove("gateway-smoke-empty-description");
  } catch (error) {
  }
  assertError(function() {
    model.skills.create({
      name: "gateway-smoke-empty-description",
      description: "",
      content: "# Gateway Smoke Skill\n",
    });
  }, "INVALID_SKILL_DESCRIPTION", "empty skill description should be rejected");
  try {
    model.skills.remove("gateway-smoke-skill-name-that-is-longer-than-sixty-four-characters-total");
  } catch (error) {
  }
  assertError(function() {
    model.skills.create({
      name: "gateway-smoke-skill-name-that-is-longer-than-sixty-four-characters-total",
      description: "Too long name smoke test.",
      content: "# Gateway Smoke Skill\n",
    });
  }, "INVALID_SKILL_NAME", "too-long skill name should be rejected");
  let removedSkill = model.skills.remove(skillName);
  assertOK(removedSkill.name === skillName, "skill should be removed");

  let schedule = model.scheduler.create({
    name: "smoke schedule",
    kind: "agent.schedule",
    schedule: {
      type: "at",
      at: "2000-01-01T00:00:00.000Z",
    },
    run: {
      prompt: "scheduled smoke",
    },
  });
  assertOK(schedule.id, "schedule should be created");
  assertOK(schedule.schedule.type === "at", "schedule should use at type");
  assertOK(schedule.run.prompt === "scheduled smoke", "schedule should keep run prompt");
  let tick = model.scheduler.tick({
    now: (new Date()).toISOString(),
  });
  assertOK(tick.tasks.length >= 1, "scheduler tick should create a task");
  assertOK(tick.tasks[0].payload.source.type === "schedule", "schedule task should keep source");
  assertOK(tick.tasks[0].payload.input.text === "scheduled smoke", "schedule task should keep input text");

  let manualSchedule = model.scheduler.create({
    name: "manual smoke schedule",
    kind: "agent.schedule",
    schedule: {
      type: "manual",
    },
    run: {
      prompt: "manual scheduled smoke",
    },
  });
  let manualRun = model.scheduler.run(manualSchedule.id, {
    now: (new Date()).toISOString(),
  });
  assertOK(manualRun.task.id, "manual schedule run should create a task");
  let schedulerStatus = model.scheduler.status();
  assertOK(schedulerStatus.total >= 1, "scheduler status should include schedules");

  // 为 agent bridge 测试创建一个带无效 key 的测试 agent，使其进入真实 agent 调用后失败，
  // 验证桥接的错误处理与事件记录。生产环境应通过 /api/providers 和 /api/agents 配置真实 key。
  let smokeSuffix = String((new Date()).getTime());
  let testProvider = store.createProvider({
    id: "provider-smoke-" + smokeSuffix,
    name: "Smoke Test Provider",
    type: "anthropic",
    enabled: true,
    baseUrl: "https://api.deepseek.com/anthropic",
    defaultModel: "deepseek-v4-flash",
    apiKey: "sk-smoke-test",
  });
  let testAgent = store.createAgent({
    id: "agent-smoke-" + smokeSuffix,
    name: "Smoke Test Agent",
    providerId: testProvider.id,
    modelProvider: "anthropic",
    modelName: "deepseek-v4-flash",
    transport: "websocket",
    enabled: true,
    baseUrl: "https://api.deepseek.com/anthropic",
    systemPrompt: "You are a smoke test agent.",
    maxIterations: 2,
    toolWhitelist: ["read_file"],
  });

  let agentTask = store.createTask({
    name: "bridge real agent",
    kind: "agent.real",
    payload: {
      source: {
        type: "smoke",
      },
      input: {
        text: "real agent run",
      },
      run: {
        mode: "agent",
        agentId: testAgent.id,
      },
    },
  });
  let agentBridgeFailed = false;
  let agentBridgeError = "";
  try {
    model.agentBridge.runTask(agentTask.id);
  } catch (error) {
    agentBridgeFailed = true;
    agentBridgeError = error.message || String(error);
  }
  let agentResult = store.getTask(agentTask.id);
  if (agentBridgeFailed) {
    assertOK(agentResult.status === "failed", "bridge should persist failed task when real agent cannot run");
    assertOK(agentResult.result.error.message === agentBridgeError, "bridge failure should persist the surfaced error");
  } else {
    assertOK(agentResult.status === "done", "bridge should finish task when real agent config is available");
    assertOK(agentResult.result.ok === true, "bridge success should return an ok agent result");
  }

  let bridgeEvents = store.listEvents(20);
  let sawBridgeFailed = false;
  let sawBridgeDone = false;
  for (let event of bridgeEvents) {
    if (event.source === "agent_bridge" && event.type === "failed") {
      sawBridgeFailed = true;
    }
    if (event.source === "agent_bridge" && event.type === "done") {
      sawBridgeDone = true;
    }
  }
  if (agentBridgeFailed) {
    assertOK(sawBridgeFailed, "bridge should record failed event");
  } else {
    assertOK(sawBridgeDone, "bridge should record done event");
  }

  let skills = model.agent.listSkills();
  let tools = model.agent.listDynamicTools();
  let plugins = model.agent.listPlugins();

  println("gs-gateway smoke ok");
  println("agentRoot=" + config.gateway.agentRoot);
  println("skills=" + String(skills.length) + " tools=" + String(tools.length) + " plugins=" + String(plugins.length));
  println("task=" + task.id + " status=" + task.status);
  println("schedule=" + schedule.id + " tickTasks=" + String(tick.tasks.length));
  println("agentBridge=" + agentResult.id + " status=" + agentResult.status);

  try {
    fs.rmSync(smokeDb, { force: true });
  } catch (error) {
    // ignore cleanup errors
  }
}

main();
