import { createAgent } from "@/agent/core/agent";
import { createRegistry } from "@/agent/tools/registry";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createConversationProvider() {
  let calls = [];

  function next(messages, tools, turnOptions) {
    calls.push(messages.slice(0));
    if (calls.length === 1) {
      return {
        role: "assistant",
        content: "第一轮回答：我会记住 alpha。",
      };
    }

    let seenFirstAnswer = false;
    let seenSecondUser = false;
    for (let message of messages) {
      if (message.role === "assistant" && String(message.content).includes("alpha")) {
        seenFirstAnswer = true;
      }
      if (message.role === "user" && String(message.content).includes("第二轮")) {
        seenSecondUser = true;
      }
    }

    if (seenFirstAnswer && seenSecondUser) {
      return {
        role: "assistant",
        content: "MULTI_TURN_OK",
      };
    }

    return {
      role: "assistant",
      content: "MULTI_TURN_MISSING_CONTEXT",
    };
  }

  return {
    calls: calls,
    next: next,
  };
}

let provider = createConversationProvider();
let registry = createRegistry();
let events = [];
let agent = createAgent({
  provider: provider,
  registry: registry,
  maxTurns: 4,
  onEvent: function(event) {
    events.push(event);
  },
});

let messages = [];
let first = agent.runMessages(messages, "第一轮：请记住 alpha");
let second = agent.runMessages(messages, "第二轮：刚才让你记住什么？");

assert(first.content.includes("alpha"), "first answer should mention alpha");
assert(second.content === "MULTI_TURN_OK", "second turn should receive conversation history");
assert(messages.length === 4, "messages should contain two user and two assistant messages");
assert(provider.calls.length === 2, "provider should be called once for each turn");
assert(provider.calls[1].length === 3, "second request should include previous user, assistant, and current user");
assert(events.length >= 4, "events should include user and assistant messages");

let oneShot = agent.run("一次性任务");
assert(oneShot.content === "MULTI_TURN_MISSING_CONTEXT", "run(input) should remain one-shot");

println("conversation smoke ok");
