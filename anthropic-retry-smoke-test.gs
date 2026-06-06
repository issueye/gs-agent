import { isRetryableAnthropicError } from "@/agent/llm/anthropic";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(isRetryableAnthropicError(new Error("Anthropic request returned empty body: status=200")), "empty body should retry");
assert(isRetryableAnthropicError(new Error("Anthropic request returned invalid JSON: status=200")), "invalid JSON should retry");
assert(isRetryableAnthropicError(new Error("Anthropic request failed: 429 rate limited")), "rate limit should retry");
assert(isRetryableAnthropicError(new Error("Anthropic request failed: 500 server error")), "server error should retry");
assert(isRetryableAnthropicError(new Error("request timeout")), "timeout should retry");
assert(!isRetryableAnthropicError(new Error("Anthropic request failed: 401 unauthorized")), "auth error should not retry");
assert(!isRetryableAnthropicError(new Error("Anthropic request failed: 400 bad request")), "bad request should not retry");

println("anthropic-retry:ok");
