let fs = require("@std/fs");
let path = require("@std/path");
let db = require("@std/db");

import { messageFromSessionEvent, sessionRecordLevel } from "@/agent/session/messages";

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

function ensureParentDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function openArchiveDb(file) {
  ensureParentDir(file);
  let conn = db.open("sqlite", file);
  conn.exec("create table if not exists session_messages (idx integer primary key, session_id text, level text, kind text, role text, name text, message_id text, content text, message_json text, entry_json text, created_at text not null default current_timestamp)");
  conn.exec("create index if not exists idx_session_messages_content on session_messages(content)");
  conn.exec("create index if not exists idx_session_messages_level on session_messages(level)");
  conn.exec("create index if not exists idx_session_messages_kind on session_messages(kind)");
  return conn;
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
  return path.join(dir, base + ".messages.db");
}

export function createSessionArchive(file) {
  function append(record) {
    let conn = openArchiveDb(file);
    let indexRow = conn.queryOne("select coalesce(max(idx) + 1, 0) as next_idx from session_messages");
    let index = 0;
    if (indexRow && indexRow.next_idx !== undefined) {
      index = indexRow.next_idx;
    }

    let entry = archiveEntry(record, index);
    if (!entry) {
      conn.close();
      return undefined;
    }
    conn.exec(
      "insert into session_messages (idx, session_id, level, kind, role, name, message_id, content, message_json, entry_json) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        entry.index,
        entry.sessionId || "",
        entry.level || "",
        entry.kind || "",
        entry.role || "",
        entry.name || "",
        entry.id || "",
        entry.content || "",
        JSON.stringify(entry.message || {}),
        JSON.stringify(entry),
      ]
    );
    conn.close();
    return entry;
  }

  function readAll() {
    if (!fs.existsSync(file)) {
      return [];
    }
    let conn = openArchiveDb(file);
    let rows = conn.query("select idx, session_id, level, kind, role, name, message_id, content, message_json, entry_json from session_messages order by idx");
    conn.close();
    let entries = [];
    for (let row of rows) {
      let entry = undefined;
      if (row.entry_json) {
        entry = JSON.parse(row.entry_json);
      } else {
        entry = {
          sessionId: row.session_id,
          level: row.level,
          kind: row.kind,
          role: row.role,
          name: row.name,
          id: row.message_id,
          content: row.content,
          message: row.message_json ? JSON.parse(row.message_json) : {},
        };
      }
      if (!("index" in entry) || entry.index === undefined) {
        entry.index = row.idx;
      }
      entries.push(entry);
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
    if (!fs.existsSync(file)) {
      return [];
    }

    let conn = openArchiveDb(file);
    let rows = [];
    if (query === "") {
      rows = conn.query(
        "select idx, level, kind, role, name, message_id, content from session_messages order by idx desc limit ?",
        [maxResults]
      );
    } else {
      let pattern = "%" + query + "%";
      rows = conn.query(
        "select idx, level, kind, role, name, message_id, content from session_messages where lower(entry_json) like ? order by idx desc limit ?",
        [pattern, maxResults]
      );
    }
    conn.close();

    let results = [];
    for (let row of rows) {
      results.push({
        index: row.idx,
        level: row.level,
        kind: row.kind,
        role: row.role,
        name: row.name,
        id: row.message_id,
        content: clipped(row.content, maxChars),
      });
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
