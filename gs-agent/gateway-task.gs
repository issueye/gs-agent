import { loadAgentApp, runAgentTask } from "@/agent/app";
import { imMessagePrompt } from "@/agent/im/bridge";

function gatewayTaskText(task) {
  let input = task || {};
  if (input.kind === "agent.im") {
    return imMessagePrompt(input.payload.im);
  }
  return String(input.payload.text || "");
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
