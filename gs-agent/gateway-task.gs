import { loadAgentApp, runAgentTask } from "@/agent/app";

let wsClient = require("@std/net/ws/client");

function gatewayTaskText(task) {
  let taskInput = (task && task.input) ? task.input : {};
  let text = String(taskInput.text || "");
  if (text === "") {
    throw new Error("gateway task input.text is required");
  }
  return text;
}

function applyRuntimeConfig(app, runtimeConfig) {
  let value = runtimeConfig || {};
  let llm = value.llm || {};
  let agent = value.agent || {};
  if (!llm.apiKey && !llm.model && !llm.baseUrl && !agent.provider) {
    return app;
  }

  if (!app.config.llm) {
    app.config.llm = {};
  }
  if (!app.config.llm.anthropic) {
    app.config.llm.anthropic = {};
  }
  if (llm.apiKey) {
    app.config.llm.anthropic.apiKey = llm.apiKey;
  }
  if (llm.baseUrl) {
    app.config.llm.anthropic.baseUrl = llm.baseUrl;
  }
  if (llm.model) {
    app.config.llm.anthropic.model = llm.model;
  }

  app.agent.provider = agent.provider || llm.provider || "anthropic";
  if (agent.system) {
    app.agent.system = agent.system;
    app.system = agent.system;
  }
  if (agent.maxTurns) {
    app.agent.maxTurns = agent.maxTurns;
  }
  if (agent.tools) {
    if (agent.tools.length > 0) {
      app.agent.tools = agent.tools;
    }
  }
  if (agent.skills) {
    app.agent.skills = agent.skills;
    if (agent.skills.length > 0) {
      app.agent.includeSkills = true;
    } else {
      app.agent.includeSkills = false;
    }
  }
  return app;
}

export function runGatewayTask(task) {
  let input = task || {};
  let app = loadAgentApp(input.root);
  applyRuntimeConfig(app, input.config || {});
  let stream = input.stream || {};
  let streamWS = undefined;

  if (stream.url) {
    streamWS = wsClient.connect(stream.url);
    streamWS.sendText(JSON.stringify({
      type: "agent_connected",
      taskId: input.taskId || input.id,
      at: (new Date()).toISOString(),
    }));
  }

  let onEvent = function(event) {
    if (streamWS) {
      streamWS.sendText(JSON.stringify({
        type: "agent_event",
        taskId: input.taskId || input.id,
        at: (new Date()).toISOString(),
        event: event,
      }));
    }
  };
  let result;
  let runOptions = input.run || {};
  let sessionId = runOptions.sessionId || runOptions.session || "";
  result = runAgentTask({
    app: app,
    taskText: gatewayTaskText(input),
    promptMode: "direct",
    session: sessionId,
    resumeSession: sessionId !== "",
    onEvent: onEvent,
  });
  result.ok = true;
  if (streamWS) {
    streamWS.sendText(JSON.stringify({
      type: "agent_result",
      taskId: input.taskId || input.id,
      at: (new Date()).toISOString(),
      result: result,
    }));
    streamWS.close();
  }
  return result;
}
