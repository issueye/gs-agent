let fs = require("@std/fs");
let path = require("@std/path");

import { messageFromSessionEvent, sessionRecordLevel } from "@/agent/session/messages";

function appendLine(file, line) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendTextSync(file, line + "\n");
}

function readText(file) {
  if (!fs.existsSync(file)) {
    return "";
  }
  return fs.readFileSync(file);
}

function lower(value) {
  return String(value || "").toLowerCase();
}

function messageText(message) {
  if (!message) {
    return "";
  }
  if ("content" in message) {
    return String(message.content || "");
  }
  return JSON.stringify(message);
}

function clipped(text, max) {
  text = String(text || "");
  if (text.length > max) {
    return text.slice(0, max) + "...";
  }
  return text;
}

function archiveEntry(record, index) {
  let message = messageFromSessionEvent(record);
  if (!message) {
    return undefined;
  }

  let level = record.level;
  if (!level) {
    level = sessionRecordLevel(record.kind, record.payload);
  }

  let entry = {
    sessionId: record.sessionId,
    level: level,
    kind: record.kind,
    role: message.role || "",
    name: message.name || "",
    id: message.id || "",
    content: messageText(message),
    message: message,
  };
  if (index !== undefined) {
    entry.index = index;
  }
  return entry;
}

export function defaultArchiveFile(sessionFile) {
  let dir = path.dirname(sessionFile);
  let base = path.basename(sessionFile);
  if (base.endsWith(".jsonl")) {
    base = base.slice(0, base.length - 6);
  }
  return path.join(dir, base + ".messages.jsonl");
}

export function createSessionArchive(file) {
  function append(record) {
    let entry = archiveEntry(record, undefined);
    if (!entry) {
      return undefined;
    }
    appendLine(file, JSON.stringify(entry));
    return entry;
  }

  function readAll() {
    let text = readText(file);
    let lines = text.split("\n");
    let entries = [];
    for (let line of lines) {
      let trimmed = line.trim();
      if (trimmed !== "") {
        let entry = JSON.parse(trimmed);
        if (!("index" in entry) || entry.index === undefined) {
          entry.index = entries.length;
        }
        entries.push(entry);
      }
    }
    return entries;
  }

  function search(options) {
    if (!options) {
      options = {};
    }
    let query = lower(options.query);
    let maxResults = options.maxResults || 8;
    let maxChars = options.maxChars || 1200;
    let entries = readAll();
    let results = [];

    for (let i = entries.length - 1; i >= 0; i = i - 1) {
      let entry = entries[i];
      let haystack = lower(JSON.stringify(entry));
      if (query === "" || haystack.indexOf(query) >= 0) {
        results.push({
          index: entry.index,
          level: entry.level,
          kind: entry.kind,
          role: entry.role,
          name: entry.name,
          id: entry.id,
          content: clipped(entry.content, maxChars),
        });
      }
      if (results.length >= maxResults) {
        break;
      }
    }

    return results;
  }

  return {
    file: file,
    append: append,
    readAll: readAll,
    search: search,
  };
}
