import { createEventBus } from "@/agent/events/bus";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

let bus = createEventBus();
let calls = 0;
bus.on("x", function(payload) {
  calls = calls + payload.amount;
});
bus.emit("x", { amount: 2 });
assert(calls === 2, "bus should emit events");

println("event-bus:ok");
