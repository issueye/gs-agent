import { createCodingAgent } from "@/agent/core/kit";
import { createScriptedProvider } from "@/agent/llm/fake";

let fs = require("@std/fs");
let path = require("@std/path");

function assert(condition, message) {
  if (!condition) {
    throw new Error("assert failed: " + message);
  }
}

function main() {
  let root = ".";
  let workspaceDir = path.join(root, "workspace");
  let taskFile = path.join(workspaceDir, "task.txt");
  fs.mkdirSync(workspaceDir, { recursive: true });
  fs.writeTextSync(taskFile, "Run a smoke test and confirm the agent loop works.");

  let sessionId = "smoke-" + String(Date.now());
  let sessionDir = path.join(root, ".agent", "sessions", sessionId);
  let sessionFile = path.join(sessionDir, "session.jsonl");
  let answerFile = path.join(sessionDir, "answer.md");

  let provider = createScriptedProvider([
    {
      kind: "tool_call",
      name: "read_task",
      args: { path: "task.txt" },
    },
    {
      role: "assistant",
      content: "Smoke test passed: task file was read and agent loop completed.",
    },
  ]);

  let kit = createCodingAgent({
    cwd: root,
    includeCodingTools: true,
    enabledTools: ["read_task"],
    includeDynamicTools: false,
    includeSessionArchiveTool: false,
    provider: provider,
    sessionId: sessionId,
    sessionFile: sessionFile,
    sessionArchiveFile: "",
    maxTurns: 4,
  });

  let answer = kit.agent.run("Please read the task file and report success.");

  fs.mkdirSync(path.dirname(answerFile), { recursive: true });
  fs.writeTextSync(answerFile, answer.content);

  let records = kit.session.readAll();
  assert(records.length >= 4, "expected at least 4 events, got " + String(records.length));

  let toolCalls = records.filter(function(r) { return r.kind === "tool_call"; });
  assert(toolCalls.length === 1, "expected 1 tool_call, got " + String(toolCalls.length));
  assert(toolCalls[0].payload.name === "read_task", "expected read_task tool call");

  let messages = records.filter(function(r) { return r.kind === "message"; });
  assert(messages.length >= 2, "expected at least 2 messages, got " + String(messages.length));

  assert(fs.existsSync(answerFile), "answer file not created: " + answerFile);

  println("gs-agent smoke ok");
  println("session=" + sessionFile);
  println("answer=" + answerFile);
  println("events=" + String(records.length));
}

main();
