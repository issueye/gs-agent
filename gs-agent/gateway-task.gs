import { loadAgentApp, runAgentTask } from "@/agent/app";
import { imMessagePrompt } from "@/agent/im/bridge";

let wsClient = require("@std/net/ws/client");

function gatewayTaskText(task) {
  let taskInput = (task && task.input) ? task.input : {};
  if (task.kind === "agent.im") {
    return imMessagePrompt(taskInput.im || taskInput);
  }
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

  app.agent.provider = "anthropic";
  if (agent.system) {
    app.agent.system = agent.system;
    app.system = agent.system;
  }
  if (agent.maxTurns) {
    app.agent.maxTurns = agent.maxTurns;
  }
  if (agent.tools && agent.tools.length > 0) {
    app.agent.tools = agent.tools;
  }
  if (agent.skills) {
    app.agent.skills = agent.skills;
    app.agent.includeSkills = agent.skills.length > 0;
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

  let result = runAgentTask({
    app: app,
    taskText: gatewayTaskText(input),
    promptMode: "direct",
    onEvent: function(event) {
      if (streamWS) {
        streamWS.sendText(JSON.stringify({
          type: "agent_event",
          taskId: input.taskId || input.id,
          at: (new Date()).toISOString(),
          event: event,
        }));
      }
    },
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
