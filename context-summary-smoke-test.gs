import { selectLeveledContext } from "@/agent/core/context";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

let messages = [];
for (let i = 1; i <= 6; i = i + 1) {
  messages.push({ role: "user", content: "user turn " + String(i) });
  if (i === 3) {
    messages.push({ kind: "tool_call", id: "tool_3", name: "read_file", args: { path: "notes.md" } });
    messages.push({ role: "tool", id: "tool_3", name: "read_file", content: "tool output for turn 3" });
  }
  messages.push({ role: "assistant", content: "assistant turn " + String(i) });
}

let selected = selectLeveledContext(messages, {
  levels: ["primary", "working"],
  working: "recent",
  recentTurns: 4,
  tokenThreshold: 1,
  summary: true,
});

assert(selected.length > 0, "selected context should not be empty");
assert(selected[0].role === "user", "summary should be injected as user context");
assert(String(selected[0].content).includes("Earlier conversation summary"), "first message should be summary");
assert(String(selected[0].content).includes("user turn 1"), "summary should include older user content");
assert(String(selected[0].content).includes("assistant turn 2"), "summary should include older assistant content");

let joined = JSON.stringify(selected);
assert(joined.includes("user turn 3"), "recent full turns should include turn 3");
assert(joined.includes("assistant turn 6"), "recent full turns should include latest answer");
assert(joined.includes("tool output for turn 3"), "recent working messages should stay complete");
let oldFullMessages = 0;
for (let message of selected) {
  if (message.role === "assistant" && message.content === "assistant turn 1") {
    oldFullMessages = oldFullMessages + 1;
  }
}
assert(oldFullMessages === 0, "old assistant turn should not appear as full message");

let full = selectLeveledContext(messages, {
  levels: ["primary", "working"],
  working: "recent",
  recentTurns: 4,
  tokenThreshold: 999999,
  summary: true,
});

assert(full.length === messages.length, "context below threshold should stay complete");
assert(full[0].content === "user turn 1", "complete context should not inject summary");

println("context summary smoke ok");
