let fs = require("@std/fs");
let path = require("@std/path");

function sessionTimestamp() {
  let text = (new Date()).toISOString();
  text = text.replaceAll(":", "").replaceAll("-", "").replaceAll(".", "");
  text = text.replaceAll("T", "-").replaceAll("Z", "");
  return text;
}

function sessionId() {
  return sessionTimestamp() + "-" + String(Math.floor(Math.random() * 1000000));
}

function sessionRoot(root, id) {
  return path.join(root, ".agent", "sessions", id);
}

export function currentSessionFile(root) {
  return path.join(root, ".agent", "current-session.json");
}

export function sessionPaths(root, id) {
  let dir = sessionRoot(root, id);
  return {
    sessionId: id,
    sessionDir: dir,
    sessionFile: path.join(dir, "session.jsonl"),
    sessionArchiveFile: path.join(dir, "session.messages.db"),
    answerFile: path.join(dir, "answer.md"),
  };
}

export function createAgentSession(root) {
  return sessionPaths(root, sessionId());
}

export function readCurrentAgentSession(root) {
  let file = currentSessionFile(root);
  if (!fs.existsSync(file)) {
    return undefined;
  }
  let record = JSON.parse(fs.readFileSync(file));
  if (!record.sessionId) {
    return undefined;
  }
  return sessionPaths(root, record.sessionId);
}

export function writeCurrentAgentSession(root, session) {
  let file = currentSessionFile(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeTextSync(file, JSON.stringify({
    sessionId: session.sessionId,
    sessionDir: session.sessionDir,
    sessionFile: session.sessionFile,
    sessionArchiveFile: session.sessionArchiveFile,
    answerFile: session.answerFile,
    updatedAt: (new Date()).toISOString(),
  }, null, 2) + "\n");
}
