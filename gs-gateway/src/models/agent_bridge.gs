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

function gatewayIMPrompt(input) {
  let value = input || {};
  let lines = [];
  lines.push("IM message received through gateway.");
  if (value.platform) {
    lines.push("Platform: " + value.platform);
  }
  if (value.adapter) {
    lines.push("Adapter: " + value.adapter);
  }
  if (value.channelId) {
    lines.push("Channel: " + value.channelId);
  }
  if (value.conversationId) {
    lines.push("Conversation: " + value.conversationId);
  }
  if (value.chat || value.chatId) {
    lines.push("Chat: " + String(value.chat || value.chatId));
  }
  if (value.sender || value.senderId) {
    lines.push("From: " + String(value.sender || value.senderId));
  }
  lines.push("");
  lines.push(String(value.text || ""));
  return lines.join("\n");
}

function bridgeInput(body, task) {
  let input = body.input || {};
  if (task.kind === "agent.im" || (body.source && body.source.type === "im")) {
    let im = input.im || input;
    let next = {};
    for (let key in input) {
      next[key] = input[key];
    }
    next.text = gatewayIMPrompt(im);
    return next;
  }
  return input;
}

function bridgeRun(body, task) {
  let run = body.run || {};
  let next = {};
  for (let key in run) {
    next[key] = run[key];
  }
  if ((task.kind === "agent.im" || (body.source && body.source.type === "im")) && !next.sessionId && !next.session) {
    let source = body.source || {};
    let input = body.input || {};
    let im = input.im || {};
    next.sessionId = source.conversationId || im.conversationId || im.conversation_id || "";
  }
  return next;
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
  let input = bridgeInput(body, task);
  let run = bridgeRun(body, task);
  return {
    taskId: task.id,
    id: task.id,
    kind: task.kind,
    name: task.name,
    root: gatewayModel.config.gateway.agentRoot,
    source: body.source || {},
    input: input,
    run: run,
    config: agentRunConfig(gatewayModel, task),
    stream: {
      url: wsBaseUrl(gatewayModel.config) + "/ws/agent-events",
      taskId: task.id,
    },
    payload: body.payload || {},
  };
}

export function buildAgentTaskPayloadForGateway(gatewayModel, task) {
  return agentTaskPayload(gatewayModel, task);
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
      let replyInput = createGatewayIMReply(task, result);
      let reply = undefined;
      if (replyInput) {
        reply = gatewayModel.store.createIMReply(replyInput);
        addEvent("im_reply_pending", task, {
          reply: reply,
        }, "accepted");
      }
      let updated = gatewayModel.store.updateTask(id, {
        status: "done",
        result: result,
      });
      addEvent("done", task, {
        result: result,
        reply: reply,
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

function createGatewayIMReply(task, result) {
  let payload = task.payload || {};
  let source = payload.source || {};
  if (task.kind !== "agent.im" && source.type !== "im") {
    return undefined;
  }
  let input = payload.input || {};
  let im = input.im || {};
  let answer = String((result && result.answer) || "");
  if (answer === "") {
    return undefined;
  }
  return {
    conversationId: source.conversationId || im.conversationId || "",
    taskId: task.id,
    eventId: source.eventId || "",
    channelId: source.channelId || im.channelId || "",
    chatId: im.chatId || im.chat || "",
    senderId: im.senderId || im.sender || "",
    messageId: source.messageId || im.messageId || "",
    text: answer,
    status: "pending",
    payload: {
      source: source,
      input: im,
    },
  };
}

export function buildGatewayIMReply(task, result) {
  return createGatewayIMReply(task, result);
}
