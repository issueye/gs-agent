import { loadAgentApp, runAgentTask } from "@/agent/app";
import { imMessagePrompt } from "@/agent/im/bridge";

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

  let result = runAgentTask({
    app: app,
    taskText: gatewayTaskText(input),
  });
  result.ok = true;
  return result;
}
