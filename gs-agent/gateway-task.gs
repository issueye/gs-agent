import { loadAgentApp, runAgentTask } from "@/agent/app";

function taskText(input) {
  if (!input) {
    return "";
  }
  if (input.text) {
    return String(input.text);
  }
  if (input.input && input.input.text) {
    return String(input.input.text);
  }
  if (input.payload && input.payload.text) {
    return String(input.payload.text);
  }
  return JSON.stringify(input);
}

export function runGatewayTask(task) {
  let input = task || {};
  let app = loadAgentApp(input.root);

  let result = runAgentTask({
    app: app,
    taskText: taskText(input.payload || input.input || input),
  });
  result.ok = true;
  return result;
}
