import { createEventBus } from "@/agent/events/bus";
import { emitIMEvent, normalizeIMMessage } from "@/agent/im/bridge";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

let bus = createEventBus();
let received = [];
bus.on("agent_input", function(input) {
  received.push(input);
});

assert(bus.listenerCount("agent_input") === 1, "event bus should keep agent_input listener");

emitIMEvent(bus, {
  module: "@plugin/im-bot",
  event: "message",
  data: {
    platform: "onebot",
    adapter: "qq-local",
    groupId: "123456",
    userId: "u-1",
    message: {
      raw_message: "hello agent",
    },
  },
});

assert(received.length === 1, "IM event should be forwarded as agent_input");
assert(received[0].source === "im", "agent_input source should be im");
assert(received[0].platform === "onebot", "platform should be preserved");
assert(received[0].adapter === "qq-local", "adapter should be preserved");
assert(received[0].chat === "123456", "chat should be normalized");
assert(received[0].sender === "u-1", "sender should be normalized");
assert(received[0].text === "hello agent", "text should be normalized");

let normalized = normalizeIMMessage({
  data: {
    content: "direct content",
  },
});
assert(normalized.text === "direct content", "direct content should normalize");

println("im-event-bus:ok");
