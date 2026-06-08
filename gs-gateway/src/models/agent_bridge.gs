let path = require("@std/path");
let runtime = require("@std/runtime");

function makeSessionId(task) {
  return "dry-run:" + task.id;
}

function makeDryRunResult(task, options) {
  let sessionId = makeSessionId(task);
  return {
    answer: "dry-run completed for task " + task.id,
    sessionId: sessionId,
    events: [
      {
        type: "agent_bridge.dry_run",
        taskId: task.id,
        sessionId: sessionId,
        dryRun: !!options.dryRun,
      },
    ],
  };
}

function errorResult(error) {
  return {
    error: {
      message: error && error.message ? error.message : String(error),
    },
  };
}

function bridgeConfig(gatewayModel) {
  if (gatewayModel.config && gatewayModel.config.agentBridge) {
    return gatewayModel.config.agentBridge;
  }
  return {
    defaultMode: "fake",
    allowReal: false,
  };
}

function runMode(gatewayModel, options) {
  if (options.dryRun) {
    return "dryRun";
  }
  if (options.mode) {
    return options.mode;
  }
  return bridgeConfig(gatewayModel).defaultMode || "fake";
}

function ensureAllowed(gatewayModel, mode, options) {
  if (mode !== "real") {
    return;
  }
  let cfg = bridgeConfig(gatewayModel);
  if (cfg.allowReal || options.allowReal) {
    return;
  }
  throw new Error("real agent execution is disabled; set [agentBridge].allowReal=true or pass allowReal=true");
}

function agentTaskPayload(gatewayModel, task, options) {
  return {
    taskId: task.id,
    id: task.id,
    kind: task.kind,
    name: task.name,
    mode: runMode(gatewayModel, options),
    root: gatewayModel.config.gateway.agentRoot,
    payload: task.payload || {},
  };
}

function callAgent(gatewayModel, task, options) {
  let agentRoot = gatewayModel.config.gateway.agentRoot;
  let entry = path.join(agentRoot, "gateway-task.gs");
  return runtime.callScript(entry, "runGatewayTask", [agentTaskPayload(gatewayModel, task, options)], {
    cwd: agentRoot,
    argv: ["gs-agent", "gateway-task"],
  });
}

export function createAgentBridgeModel(gatewayModel) {
  function addEvent(type, task, payload, status) {
    return gatewayModel.store.addEvent("agent_bridge", type, task.id, payload || {}, status || "accepted");
  }

  function runTask(id, options) {
    let runOptions = options || {};
    let task = gatewayModel.store.getTask(id);
    if (!task) {
      throw new Error("task not found");
    }

    let mode = runMode(gatewayModel, runOptions);
    try {
      ensureAllowed(gatewayModel, mode, runOptions);
    } catch (error) {
      addEvent("blocked", task, {
        mode: mode,
        error: error.message || String(error),
      }, "blocked");
      throw error;
    }

    addEvent("start", task, {
      mode: mode,
      dryRun: !!runOptions.dryRun,
    }, "running");
    gatewayModel.store.updateTask(id, { status: "running" });

    try {
      if (runOptions.dryRun) {
        let result = makeDryRunResult(task, runOptions);
        let updated = gatewayModel.store.updateTask(id, {
          status: "done",
          result: result,
        });
        addEvent("done", task, {
          mode: mode,
          result: result,
        }, "done");
        return updated;
      }

      let result = callAgent(gatewayModel, task, runOptions);
      let updated = gatewayModel.store.updateTask(id, {
        status: "done",
        result: result,
      });
      addEvent("done", task, {
        mode: mode,
        result: result,
      }, "done");
      return updated;
    } catch (error) {
      gatewayModel.store.updateTask(id, {
        status: "failed",
        result: errorResult(error),
      });
      addEvent("failed", task, {
        mode: mode,
        error: error.message || String(error),
      }, "failed");
      throw error;
    }
  }

  return {
    runTask: runTask,
  };
}
