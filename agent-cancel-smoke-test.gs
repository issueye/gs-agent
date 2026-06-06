import { createAgent } from "@/agent/core/agent";
import { createRegistry, createTool } from "@/agent/tools/registry";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

let cancelled = false;
let toolCalls = 0;
let providerCalls = 0;

let registry = createRegistry();
registry.register(createTool(
  "slow_tool",
  "Test cancellation before tool execution.",
  {
    type: "object",
    additionalProperties: true,
    properties: {},
  },
  function(args) {
    toolCalls = toolCalls + 1;
    return { ok: true };
  }
));

let provider = {
  next: function(messages, tools, turnOptions) {
    providerCalls = providerCalls + 1;
    cancelled = true;
    return {
      kind: "tool_call",
      id: "cancel_tool",
      name: "slow_tool",
      args: {},
    };
  },
};

let events = [];
let agent = createAgent({
  provider: provider,
  registry: registry,
  maxTurns: 3,
  isCancelled: function() {
    return cancelled;
  },
  onEvent: function(event) {
    events.push(event);
  },
});

let answer = agent.run("start");
assert(providerCalls === 1, "provider should be called once");
assert(toolCalls === 0, "tool should not run after cancellation");
assert(answer.content.includes("interrupted"), "answer should mention interruption");

let cancelledTurn = false;
for (let event of events) {
  if (event.kind === "turn_end" && event.payload.stop === "cancelled") {
    cancelledTurn = true;
  }
}
assert(cancelledTurn, "cancelled turn should be emitted");

println("agent-cancel:ok");
