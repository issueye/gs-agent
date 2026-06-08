import { loadAgentApp, runAgentTask } from "@/agent/app";
import { createAgentSession, writeCurrentAgentSession } from "@/agent/session/manager";

let fs = require("@std/fs");
let path = require("@std/path");

function taskText(input) {
  if (!input) {
    return "";
  }
  if (input.text) {
    return String(input.text);
  }
  if (input.input && input.input.text) {
    return String(input.input.text);
  }
  if (input.payload && input.payload.text) {
    return String(input.payload.text);
  }
  return JSON.stringify(input);
}

function fakeResult(app, task) {
  let session = createAgentSession(app.root);
  fs.mkdirSync(session.sessionDir, { recursive: true });
  let text = taskText(task.payload || task.input || task);
  let answer = "fake agent completed task " + String(task.taskId || task.id || "") + ": " + text;
  fs.writeTextSync(session.sessionFile, JSON.stringify({
    sessionId: session.sessionId,
    level: "primary",
    kind: "message",
    payload: {
      role: "assistant",
      content: answer,
    },
  }) + "\n");
  fs.writeTextSync(session.answerFile, answer + "\n");
  writeCurrentAgentSession(app.root, session);
  return {
    ok: true,
    mode: "fake",
    answer: answer,
    events: 1,
    sessionId: session.sessionId,
    sessionDir: session.sessionDir,
    sessionFile: session.sessionFile,
    sessionArchiveFile: session.sessionArchiveFile,
    answerFile: session.answerFile,
  };
}

export function runGatewayTask(task) {
  let input = task || {};
  let mode = input.mode || "fake";
  let app = loadAgentApp(input.root);

  if (mode === "fake" || mode === "dryRun") {
    return fakeResult(app, input);
  }

  if (mode !== "real") {
    throw new TypeError("unknown gateway task mode: " + mode);
  }

  let result = runAgentTask({
    app: app,
    taskText: taskText(input.payload || input.input || input),
  });
  result.ok = true;
  result.mode = "real";
  return result;
}
