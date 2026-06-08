let path = require("@std/path");
let runtime = require("@std/runtime");

function errorResult(error) {
  return {
    error: {
      message: error && error.message ? error.message : String(error),
    },
  };
}

function agentTaskPayload(gatewayModel, task) {
  return {
    taskId: task.id,
    id: task.id,
    kind: task.kind,
    name: task.name,
    root: gatewayModel.config.gateway.agentRoot,
    payload: task.payload || {},
  };
}

function callAgent(gatewayModel, task) {
  let agentRoot = gatewayModel.config.gateway.agentRoot;
  let entry = path.join(agentRoot, "gateway-task.gs");
  return runtime.callScript(entry, "runGatewayTask", [agentTaskPayload(gatewayModel, task)], {
    cwd: agentRoot,
    argv: ["gs-agent", "gateway-task"],
  });
}

export function createAgentBridgeModel(gatewayModel) {
  function addEvent(type, task, payload, status) {
    return gatewayModel.store.addEvent("agent_bridge", type, task.id, payload || {}, status || "accepted");
  }

  function runTask(id) {
    let task = gatewayModel.store.getTask(id);
    if (!task) {
      throw new Error("task not found");
    }

    addEvent("start", task, {
      agentRoot: gatewayModel.config.gateway.agentRoot,
    }, "running");
    gatewayModel.store.updateTask(id, { status: "running" });

    try {
      let result = callAgent(gatewayModel, task);
      let updated = gatewayModel.store.updateTask(id, {
        status: "done",
        result: result,
      });
      addEvent("done", task, {
        result: result,
      }, "done");
      return updated;
    } catch (error) {
      gatewayModel.store.updateTask(id, {
        status: "failed",
        result: errorResult(error),
      });
      addEvent("failed", task, {
        error: error.message || String(error),
      }, "failed");
      throw error;
    }
  }

  return {
    runTask: runTask,
  };
}
