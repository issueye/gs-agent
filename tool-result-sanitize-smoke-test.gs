import { createAgent } from "@/agent/core/agent";
import { createRegistry, createTool } from "@/agent/tools/registry";
import { sanitizeToolResult } from "@/agent/tools/sanitize";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

let rawFetch = {
  ok: true,
  name: "web_fetch",
  result: {
    ok: true,
    url: "https://example.test/article",
    status: 200,
    statusText: "200 OK",
    contentType: "text/html",
    contentLength: 9999,
    truncated: false,
    text: "<html><head><meta name=\"x\" content=\"noise\"><style>.x{}</style><script>var tokenWaste = true;</script></head><body><h1>AI Roadmap</h1><p>Useful finding &amp; context.</p></body></html>",
  },
};

let sanitized = sanitizeToolResult("web_fetch", rawFetch);
assert(sanitized.result.text.includes("AI Roadmap"), "sanitized fetch keeps useful text");
assert(sanitized.result.text.includes("Useful finding & context."), "sanitized fetch decodes entities");
assert(!sanitized.result.text.includes("tokenWaste"), "sanitized fetch removes scripts");
assert(!sanitized.result.text.includes("<html"), "sanitized fetch strips tags");

let search = sanitizeToolResult("web_search", {
  ok: true,
  name: "web_search",
  result: {
    ok: true,
    provider: "duckduckgo",
    query: "q",
    results: [
      {
        title: "A".repeat(200),
        url: "https://example.test/" + "u".repeat(400),
        description: "D".repeat(500),
      },
    ],
  },
});
assert(search.result.results[0].title.length <= 123, "search title clipped");
assert(search.result.results[0].url.length <= 243, "search url clipped");
assert(search.result.results[0].description.length <= 223, "search description clipped");

function createProvider() {
  let calls = [];
  function next(messages, tools, turnOptions) {
    calls.push(messages.slice(0));
    if (calls.length === 1) {
      return {
        kind: "tool_call",
        name: "web_fetch",
        args: { url: "https://example.test/article" },
      };
    }
    return {
      role: "assistant",
      content: "OK",
    };
  }
  return {
    calls: calls,
    next: next,
  };
}

let registry = createRegistry();
registry.register(createTool(
  "web_fetch",
  "Fetch test page.",
  {
    type: "object",
    additionalProperties: true,
    properties: {},
  },
  function(args) {
    return rawFetch.result;
  }
));

let provider = createProvider();
let agent = createAgent({
  provider: provider,
  registry: registry,
  maxTurns: 3,
});
let answer = agent.run("fetch");
assert(answer.content === "OK", "agent should finish");
let secondRequest = JSON.stringify(provider.calls[1]);
assert(secondRequest.includes("AI Roadmap"), "provider receives sanitized useful text");
assert(!secondRequest.includes("tokenWaste"), "provider should not receive script noise");
assert(!secondRequest.includes("<style>"), "provider should not receive style noise");

println("tool-result-sanitize:ok");
