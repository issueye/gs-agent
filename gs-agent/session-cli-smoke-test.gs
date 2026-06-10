import { runAgentApp } from "@/agent/app";
import { sessionPaths, writeCurrentAgentSession } from "@/agent/session/manager";

let fs = require("@std/fs");
let os = require("@std/os");
let path = require("@std/path");

let root = fs.mkdtempSync(path.join(os.tmpdir(), "gs-agent-session-cli-"));
fs.writeTextSync(path.join(root, "project.toml"), "[project]\nentry = \"main.gs\"\n");
fs.writeTextSync(path.join(root, "agent.toml"), [
  "[agent]",
  "provider = \"fake\"",
  "taskFile = \"workspace/task.txt\"",
  "includeCodingTools = false",
  "includeSubagents = false",
  "includeSkills = false",
  "tools = []",
  "maxTurns = 1",
  "",
].join("\n"));
fs.mkdirSync(path.join(root, "workspace"), { recursive: true });
fs.writeTextSync(path.join(root, "workspace", "task.txt"), "continue this conversation");

let session = sessionPaths(root, "known-session");
fs.mkdirSync(session.sessionDir, { recursive: true });
fs.writeTextSync(session.sessionFile, [
  JSON.stringify({
    sessionId: session.sessionId,
    level: "primary",
    kind: "message",
    payload: {
      role: "user",
      content: "previous question",
    },
  }),
  JSON.stringify({
    sessionId: session.sessionId,
    level: "primary",
    kind: "message",
    payload: {
      role: "assistant",
      content: "previous answer",
    },
  }),
  "",
].join("\n"));
writeCurrentAgentSession(root, session);

let result = runAgentApp({
  root: root,
  session: "known-session",
});

if (result.sessionId !== "known-session") {
  throw new Error("expected known-session, got " + result.sessionId);
}
if (result.events < 4) {
  throw new Error("expected resumed session events, got " + String(result.events));
}
if (!fs.existsSync(session.answerFile)) {
  throw new Error("answer file was not written");
}

println("ok session=" + result.sessionId + " events=" + String(result.events));
