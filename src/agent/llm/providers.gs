import { createScriptedProvider } from "@/agent/llm/fake";
import { createAnthropicProvider } from "@/agent/llm/anthropic";

// Provider factory：应用层只关心 provider 名称，不直接依赖具体模型实现。
export function createProvider(config, agent) {
  if (agent.provider === "anthropic") {
    return createAnthropicProvider(anthropicOptions(config, agent));
  }

  if (agent.provider === "fake") {
    return createFakeProvider();
  }

  throw new ReferenceError("unknown agent provider: " + agent.provider);
}

// Anthropic 兼容 provider 必须有 [llm.anthropic] 段，DeepSeek 也走这条路径。
export function anthropicOptions(config, agent) {
  if (!config.llm || !config.llm.anthropic) {
    throw new ReferenceError("agent provider is anthropic, but [llm.anthropic] is missing");
  }

  let anthropic = config.llm.anthropic;
  return {
    apiKey: anthropic.apiKey,
    baseUrl: anthropic.baseUrl,
    model: anthropic.model,
    maxTokens: anthropic.maxTokens,
    timeoutMs: anthropic.timeoutMs,
    temperature: anthropic.temperature,
    thinking: anthropic.thinking,
    system: agent.system,
  };
}

// fake provider 保留为本地测试分支，避免 smoke test 依赖真实 API。
export function createFakeProvider() {
  return createScriptedProvider([
    {
      kind: "tool_call",
      name: "read_task",
      args: { path: "task.txt" },
    },
    {
      role: "assistant",
      content: "Task file read. Configure [agent].provider = \"anthropic\" for real model execution.",
    },
  ]);
}
