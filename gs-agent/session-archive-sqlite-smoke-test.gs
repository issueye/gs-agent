import { createSessionArchive, defaultArchiveFile } from "@/agent/session/archive";
import { createSearchSessionArchiveTool } from "@/agent/tools/session-archive";

let fs = require("@std/fs");
let path = require("@std/path");
let process = require("@std/process");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

let suffix = String(Date.now());
let file = path.join(process.cwd(), ".agent", "test-session-archive-" + suffix + ".db");
let defaultFile = defaultArchiveFile(path.join(process.cwd(), ".agent", "sessions", "session-a", "session.jsonl"));
assert(defaultFile.endsWith(path.join(".agent", "session-archive.db")), "default archive should be the shared sqlite database");
if (fs.existsSync(file)) {
  fs.unlinkSync(file);
}
if (fs.existsSync(file + "-wal")) {
  fs.unlinkSync(file + "-wal");
}
if (fs.existsSync(file + "-shm")) {
  fs.unlinkSync(file + "-shm");
}

let archive = createSessionArchive(file, {
  sessionId: "test-session",
});
archive.append({
  sessionId: "test-session",
  kind: "message",
  payload: {
    role: "user",
    content: "Please remember the blue deployment decision.",
  },
});
archive.append({
  sessionId: "test-session",
  kind: "message",
  payload: {
    role: "assistant",
    content: "The final choice was green deployment.",
  },
});
archive.append({
  sessionId: "other-session",
  kind: "message",
  payload: {
    role: "user",
    content: "Other session should not appear in filtered search.",
  },
});

let all = archive.readAll();
assert(all.length === 2, "archive should round trip all messages from sqlite");
assert(all[0].index === 0, "first message index should be 0");
assert(all[1].index === 1, "second message index should be 1");

let results = archive.search({ query: "green", maxResults: 4 });
assert(results.length === 1, "search should find matching sqlite row");
assert(results[0].content.includes("green deployment"), "search result should include matching content");

let recent = archive.search({ query: "", maxResults: 1 });
assert(recent.length === 1, "empty search should return recent rows");
assert(recent[0].index === 1, "empty search should be newest first");

let tool = createSearchSessionArchiveTool(file);
let toolResult = tool.run({ query: "blue", maxResults: 2 });
assert(toolResult.archiveDatabase === file, "tool should expose sqlite archive database path");
assert(toolResult.results.length === 1, "tool should query sqlite archive");

let filteredTool = createSearchSessionArchiveTool(file, {
  sessionId: "test-session",
});
let filteredResult = filteredTool.run({ query: "other session", maxResults: 2 });
assert(filteredResult.results.length === 0, "tool should filter by current session in shared sqlite archive");

let otherArchive = createSessionArchive(file, {
  sessionId: "other-session",
});
let otherResults = otherArchive.search({ query: "other session", maxResults: 2 });
assert(otherResults.length === 1, "shared sqlite archive should still store other session rows");

fs.unlinkSync(file);
if (fs.existsSync(file + "-wal")) {
  fs.unlinkSync(file + "-wal");
}
if (fs.existsSync(file + "-shm")) {
  fs.unlinkSync(file + "-shm");
}

println("session-archive-sqlite:ok");
