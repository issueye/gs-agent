import { createProvider, anthropicOptions } from "@/agent/llm/providers";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  let fake = createProvider({ agent: { provider: "fake" } }, { provider: "fake" });
  let first = fake.next([], [], { allowTools: true });
  assert(first.kind === "tool_call", "fake provider should start with a tool call");

  let config = {
    llm: {
      anthropic: {
        apiKey: "test-key",
        baseUrl: "https://example.test/anthropic",
        model: "test-model",
        maxTokens: 128,
        retryCount: 4,
        retryDelayMs: 25,
        thinking: "disabled",
      },
    },
  };
  let options = anthropicOptions(config, { system: "system prompt" });
  assert(options.apiKey === "test-key", "apiKey should be copied");
  assert(options.model === "test-model", "model should be copied");
  assert(options.retryCount === 4, "retryCount should be copied");
  assert(options.retryDelayMs === 25, "retryDelayMs should be copied");
  assert(options.system === "system prompt", "system prompt should come from agent config");

  println("provider:ok");
}

main();
