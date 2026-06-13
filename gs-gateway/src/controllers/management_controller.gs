import { ok, created, fail } from "@/views/response";

function notFound(res, message) {
  return fail(res, 404, "NOT_FOUND", message);
}

function providerConfig(provider) {
  if (!provider) {
    return {};
  }
  return {
    providerId: provider.id,
    modelProvider: provider.type || "",
    modelBaseUrl: provider.baseUrl || "",
    apiKeySet: Boolean(provider.apiKeySet),
  };
}

function resolveProvider(store, agent) {
  if (!agent) {
    return undefined;
  }
  if (agent.providerId) {
    return store.getProvider(agent.providerId);
  }
  let providers = store.listProviders();
  for (let provider of providers) {
    if (provider.enabled && provider.type === agent.modelProvider) {
      return provider;
    }
  }
  return undefined;
}

function instanceConfig(agent, provider, input) {
  let providerSnapshot = providerConfig(provider);
  return {
    ...providerSnapshot,
    baseUrl: agent.baseUrl || providerSnapshot.modelBaseUrl || "",
    transport: agent.transport || input.transport || "websocket",
    commandArgs: input.commandArgs || agent.commandArgs || [],
    modelProvider: agent.modelProvider || providerSnapshot.modelProvider || "",
    modelName: agent.modelName || (provider ? provider.defaultModel : "") || "",
    host: "127.0.0.1",
    port: 0,
    pid: 0,
    lastHeartbeatAt: (new Date()).toISOString(),
    lastError: provider ? "real process launch not yet implemented" : "未匹配到可用供应商",
    inflight: 0,
  };
}

export function createManagementController(model) {
  let store = model.store;

  function listProviders(req, res) {
    return ok(res, store.listProviders());
  }

  function createProvider(req, res) {
    return created(res, store.createProvider(req.body || {}));
  }

  function updateProvider(req, res) {
    let provider = store.updateProvider(req.params.id, req.body || {});
    if (!provider) {
      return notFound(res, "provider not found");
    }
    return ok(res, provider);
  }

  function removeProvider(req, res) {
    let provider = store.removeProvider(req.params.id);
    if (!provider) {
      return notFound(res, "provider not found");
    }
    return ok(res, provider);
  }

  function listAgents(req, res) {
    return ok(res, store.listAgents());
  }

  function createAgent(req, res) {
    return created(res, store.createAgent(req.body || {}));
  }

  function updateAgent(req, res) {
    let agent = store.updateAgent(req.params.id, req.body || {});
    if (!agent) {
      return notFound(res, "agent not found");
    }
    return ok(res, agent);
  }

  function removeAgent(req, res) {
    let agent = store.removeAgent(req.params.id);
    if (!agent) {
      return notFound(res, "agent not found");
    }
    return ok(res, agent);
  }

  function listAgentInstances(req, res) {
    return ok(res, store.listAgentInstances());
  }

  function startAgentInstance(req, res) {
    let body = req.body || {};
    let agentId = String(body.agentId || body.agent_id || "");
    let agent = store.getAgent(agentId);
    if (!agent) {
      return notFound(res, "agent not found");
    }
    if (!agent.enabled) {
      return fail(res, 409, "AGENT_DISABLED", "agent is disabled");
    }
    let provider = resolveProvider(store, agent);
    let instance = store.createAgentInstance({
      agentId: agent.id,
      name: body.name || agent.name,
      status: provider ? "ready" : "failed",
      config: instanceConfig(agent, provider, body),
    });
    return created(res, instance);
  }

  function stopAgentInstance(req, res) {
    let instance = store.updateAgentInstance(req.params.id, {
      status: "stopped",
      config: {
        lastHeartbeatAt: (new Date()).toISOString(),
      },
    });
    if (!instance) {
      return notFound(res, "agent instance not found");
    }
    return ok(res, instance);
  }

  function restartAgentInstance(req, res) {
    let existing = store.getAgentInstance(req.params.id);
    if (!existing) {
      return notFound(res, "agent instance not found");
    }
    let agent = store.getAgent(existing.agentId);
    let provider = resolveProvider(store, agent);
    let instance = store.updateAgentInstance(req.params.id, {
      status: provider ? "ready" : "failed",
      config: instanceConfig(agent || existing, provider, existing),
    });
    return ok(res, instance);
  }

  function drainAgentInstance(req, res) {
    let instance = store.updateAgentInstance(req.params.id, {
      status: "draining",
      config: {
        lastHeartbeatAt: (new Date()).toISOString(),
      },
    });
    if (!instance) {
      return notFound(res, "agent instance not found");
    }
    return ok(res, instance);
  }

  function removeAgentInstance(req, res) {
    let instance = store.removeAgentInstance(req.params.id);
    if (!instance) {
      return notFound(res, "agent instance not found");
    }
    return ok(res, instance);
  }

  return {
    listProviders: listProviders,
    createProvider: createProvider,
    updateProvider: updateProvider,
    removeProvider: removeProvider,
    listAgents: listAgents,
    createAgent: createAgent,
    updateAgent: updateAgent,
    removeAgent: removeAgent,
    listAgentInstances: listAgentInstances,
    startAgentInstance: startAgentInstance,
    stopAgentInstance: stopAgentInstance,
    restartAgentInstance: restartAgentInstance,
    drainAgentInstance: drainAgentInstance,
    removeAgentInstance: removeAgentInstance,
  };
}
