import { createAgentSession, readCurrentAgentSession, writeCurrentAgentSession } from "@/agent/session/manager";

let fs = require("@std/fs");
let path = require("@std/path");
let process = require("@std/process");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

let root = process.cwd();
let session = createAgentSession(root);

assert(session.sessionId !== "", "session id should be present");
assert(session.sessionFile.includes(".agent"), "session file should be under .agent");
assert(session.sessionFile.includes("sessions"), "session file should be under sessions dir");
assert(session.sessionArchiveFile.endsWith(path.join(".agent", "session-archive.db")), "session archive should be a single shared sqlite database");
assert(session.answerFile.endsWith("answer.md"), "answer file should be named answer.md");

writeCurrentAgentSession(root, session);
let loaded = readCurrentAgentSession(root);
assert(loaded.sessionId === session.sessionId, "current session id should round trip");
assert(loaded.sessionFile === session.sessionFile, "current session file should round trip");

let currentFile = path.join(root, ".agent", "current-session.json");
assert(fs.existsSync(currentFile), "current session pointer should exist");

println("session-manager:ok");
