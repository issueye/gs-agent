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

export function runGatewayTask(task) {
  let input = task || {};
  let app = loadAgentApp(input.root);
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
