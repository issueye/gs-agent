import { loadConfig } from "@/config";
import { openGatewayStore } from "@/models/store";
import { createGatewayModel } from "@/models/gateway";

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
  assertOK(received.task.id, "task id should be created");
  assertOK(received.task.payload.im.source === "im", "IM task should keep normalized source");
  assertOK(received.task.payload.im.platform === "onebot", "IM task should keep platform");
  assertOK(received.task.payload.im.adapter === "qq-local", "IM task should keep adapter");
  assertOK(received.task.payload.im.chat === "smoke-chat", "IM task should keep chat");
  assertOK(received.task.payload.im.text === "hello gateway", "IM task should keep text");

  let task = store.updateTask(received.task.id, {
    status: "done",
    result: {
      message: "ok",
    },
  });
  assertOK(task.status === "done", "task should be updated");

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
    kind: "agent.smoke",
    schedule: {
      dueAt: "2000-01-01T00:00:00.000Z",
    },
    payload: {
      text: "scheduled smoke",
    },
  });
  assertOK(schedule.id, "schedule should be created");
  let due = model.scheduler.dueToTasks({
    now: (new Date()).toISOString(),
  });
  assertOK(due.tasks.length >= 1, "due schedule should create a task");

  let agentTask = store.createTask({
    name: "bridge real agent",
    kind: "agent.real",
    payload: {
      text: "real agent run",
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
  println("schedule=" + schedule.id + " dueTasks=" + String(due.tasks.length));
  println("agentBridge=" + agentResult.id + " status=" + agentResult.status);
}

main();
