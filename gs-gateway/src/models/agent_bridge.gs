let path = require("@std/path");
let runtime = require("@std/runtime");

function wsBaseUrl(config) {
  let port = String(config.gateway.port);
  return "ws://127.0.0.1:" + port;
}

function errorResult(error) {
  return {
    error: {
      message: error && error.message ? error.message : String(error),
    },
  };
}

function resolveTaskAgentId(task) {
  let body = task && task.payload ? task.payload : {};
  let run = body.run || {};
  let input = body.input || {};
  return String(run.agentId || run.agent_id || input.agentId || input.agent_id || "");
}

function resolveProvider(store, agent) {
  if (!agent) {
    return undefined;
  }
  if (agent.providerId) {
    return store.getProviderSecret(agent.providerId);
  }
  let providers = store.listProviders();
  for (let provider of providers) {
    if (provider.enabled && provider.type === agent.modelProvider) {
      return store.getProviderSecret(provider.id);
    }
  }
  return undefined;
}

function agentRunConfig(gatewayModel, task) {
  let agentId = resolveTaskAgentId(task);
  if (agentId === "") {
    return {};
  }
  let agent = gatewayModel.store.getAgent(agentId);
  if (!agent) {
    throw new Error("agent not found: " + agentId);
  }
  if (!agent.enabled) {
    throw new Error("agent is disabled: " + agentId);
  }
  let provider = resolveProvider(gatewayModel.store, agent);
  if (!provider || !provider.enabled) {
    throw new Error("agent provider not found or disabled: " + agentId);
  }
  if (!provider.apiKey) {
    throw new Error("agent provider apiKey is missing: " + provider.id);
  }

  return {
    agent: {
      id: agent.id,
      provider: agent.modelProvider || provider.type || "anthropic",
      system: agent.systemPrompt || "",
      maxTurns: agent.maxIterations || 0,
      tools: agent.toolWhitelist || [],
      skills: agent.skillIds || [],
      includeSkills: (agent.skillIds || []).length > 0,
    },
    llm: {
      provider: provider.type || agent.modelProvider || "",
      apiKey: provider.apiKey,
      baseUrl: agent.baseUrl || provider.baseUrl || "",
      model: agent.modelName || provider.defaultModel || "",
    },
  };
}

function agentTaskPayload(gatewayModel, task) {
  let body = task.payload || {};
  return {
    taskId: task.id,
    id: task.id,
    kind: task.kind,
    name: task.name,
    root: gatewayModel.config.gateway.agentRoot,
    source: body.source || {},
    input: body.input || {},
    run: body.run || {},
    config: agentRunConfig(gatewayModel, task),
    stream: {
      url: wsBaseUrl(gatewayModel.config) + "/ws/agent-events",
      taskId: task.id,
    },
    payload: body.payload || {},
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
      source: (task.payload && task.payload.source) ? task.payload.source.type : "",
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
