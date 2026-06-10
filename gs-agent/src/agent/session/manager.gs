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

export function sessionArchiveFile(root) {
  return path.join(root, ".agent", "session-archive.db");
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
    sessionArchiveFile: sessionArchiveFile(root),
    answerFile: path.join(dir, "answer.md"),
  };
}

export function resolveAgentSession(root, value) {
  let text = String(value || "").trim();
  if (text === "") {
    return undefined;
  }

  if (text === "current" || text === "latest") {
    return readCurrentAgentSession(root);
  }

  if (fs.existsSync(text)) {
    let info = fs.statSync(text);
    let sessionDir = text;
    let sessionFile = path.join(text, "session.jsonl");
    if (!info.isDirectory()) {
      sessionFile = text;
      sessionDir = path.dirname(text);
    }
    let id = path.basename(sessionDir);
    return {
      sessionId: id,
      sessionDir: sessionDir,
      sessionFile: sessionFile,
      sessionArchiveFile: sessionArchiveFile(root),
      answerFile: path.join(sessionDir, "answer.md"),
    };
  }

  return sessionPaths(root, text);
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
