import { createJSONLSession } from "@/agent/session/jsonl";

let fs = require("@std/fs");
let path = require("@std/path");
let process = require("@std/process");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

let file = path.join(process.cwd(), ".agent", "session-level-smoke.jsonl");
let archiveFile = path.join(process.cwd(), ".agent", "session-level-smoke.messages.jsonl");
if (fs.existsSync(file)) {
  fs.unlinkSync(file);
}
if (fs.existsSync(archiveFile)) {
  fs.unlinkSync(archiveFile);
}

let session = createJSONLSession(file);
session.append("message", { role: "user", content: "hello" });
session.append("tool_call", { id: "tool_0", name: "read_file", args: { path: "README.md" } });
session.append("tool_result", { role: "tool", id: "tool_0", name: "read_file", content: "{\"ok\":true}" });
session.append("message", { role: "assistant", content: "done" });
session.append("turn_end", { turn: 0, stop: "message" });

let records = session.readAll();
assert(records[0].level === "primary", "user message should be primary");
assert(records[1].level === "working", "tool call should be working");
assert(records[2].level === "working", "tool result should be working");
assert(records[4].level === "audit", "turn metadata should be audit");

let primary = session.readMessages();
assert(primary.length === 2, "default restore should read primary messages only");
assert(primary[0].role === "user", "primary restore keeps user message");
assert(primary[1].role === "assistant", "primary restore keeps assistant message");

let withWorking = session.readMessages({ levels: ["primary", "working"] });
assert(withWorking.length === 4, "explicit restore can include working messages");
assert(withWorking[1].kind === "tool_call", "working restore keeps tool call");
assert(withWorking[2].role === "tool", "working restore keeps tool result");

let archived = session.archive.search({ query: "README", maxResults: 3 });
assert(archived.length >= 1, "archive search should find tool call");
assert(archived[0].content.includes("README") || archived[0].name === "read_file", "archive result should include matching context");

println("session level smoke ok");
