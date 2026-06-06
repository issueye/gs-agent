import { parseAnthropicPayload } from "@/agent/llm/anthropic";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

let payload = parseAnthropicPayload({
  status: 200,
  body: JSON.stringify({
    content: [
      {
        type: "text",
        text: "ok",
      },
    ],
  }),
});
assert(payload.content[0].text === "ok", "valid payload should parse");

let emptyFailed = false;
try {
  parseAnthropicPayload({
    status: 200,
    body: "",
  });
} catch (err) {
  emptyFailed = String(err).includes("returned empty body");
}
assert(emptyFailed, "empty payload should report empty body");

let invalidFailed = false;
try {
  parseAnthropicPayload({
    status: 200,
    body: "{",
  });
} catch (err) {
  invalidFailed = String(err).includes("returned invalid JSON");
}
assert(invalidFailed, "invalid payload should report invalid JSON");

println("anthropic-empty-body:ok");
