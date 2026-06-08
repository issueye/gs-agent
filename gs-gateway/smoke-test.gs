import { loadConfig } from "@/config";
import { openGatewayStore } from "@/models/store";
import { createGatewayModel } from "@/models/gateway";

function assertOK(value, message) {
  if (!value) {
    throw new Error(message);
  }
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

  let bridgeTask = store.createTask({
    name: "bridge dry run",
    kind: "agent.dry_run",
    payload: {
      text: "dry run",
    },
  });
  let bridgeResult = model.agentBridge.runTask(bridgeTask.id, {
    dryRun: true,
  });
  assertOK(bridgeResult.status === "done", "bridge dry-run should finish task");

  let agentTask = store.createTask({
    name: "bridge fake agent",
    kind: "agent.fake",
    payload: {
      text: "fake agent run",
    },
  });
  let agentResult = model.agentBridge.runTask(agentTask.id, {
    mode: "fake",
  });
  assertOK(agentResult.status === "done", "bridge fake agent should finish task");
  assertOK(agentResult.result.mode === "fake", "fake agent mode should be recorded");

  let realBlocked = false;
  let blockedTask = store.createTask({
    name: "bridge real blocked",
    kind: "agent.real",
    payload: {
      text: "should be blocked",
    },
  });
  try {
    model.agentBridge.runTask(blockedTask.id, {
      mode: "real",
    });
  } catch (error) {
    realBlocked = true;
  }
  assertOK(realBlocked, "real bridge should be blocked by default");

  let bridgeEvents = store.listEvents(20);
  let sawBridgeDone = false;
  for (let event of bridgeEvents) {
    if (event.source === "agent_bridge" && event.type === "done") {
      sawBridgeDone = true;
    }
  }
  assertOK(sawBridgeDone, "bridge should record done event");

  let skills = model.agent.listSkills();
  let tools = model.agent.listDynamicTools();
  let plugins = model.agent.listPlugins();

  println("gs-gateway smoke ok");
  println("agentRoot=" + config.gateway.agentRoot);
  println("skills=" + String(skills.length) + " tools=" + String(tools.length) + " plugins=" + String(plugins.length));
  println("task=" + task.id + " status=" + task.status);
  println("schedule=" + schedule.id + " dueTasks=" + String(due.tasks.length));
  println("bridge=" + bridgeResult.id + " status=" + bridgeResult.status);
  println("agentBridge=" + agentResult.id + " mode=" + agentResult.result.mode);
}

main();
