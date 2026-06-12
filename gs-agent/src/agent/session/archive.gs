let fs = require("@std/fs");
let path = require("@std/path");
let orm = require("@std/orm");

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

const sessionMessageSchema = {
  table: "session_messages",
  columns: [
    { name: "idx", type: "integer", primaryKey: true },
    { name: "session_id", type: "text" },
    { name: "level", type: "text" },
    { name: "kind", type: "text" },
    { name: "role", type: "text" },
    { name: "name", type: "text" },
    { name: "message_id", type: "text" },
    { name: "content", type: "text" },
    { name: "message_json", type: "text" },
    { name: "entry_json", type: "text" },
    { name: "created_at", type: "text", notNull: true, defaultValue: "current_timestamp" },
  ],
  indexes: [
    { name: "idx_session_messages_content", columns: ["content"] },
    { name: "idx_session_messages_session", columns: ["session_id"] },
    { name: "idx_session_messages_level", columns: ["level"] },
    { name: "idx_session_messages_kind", columns: ["kind"] },
  ],
};

function openArchiveOrm(file) {
  ensureParentDir(file);
  let archive = orm.connect("sqlite", file);
  archive.autoMigrate(sessionMessageSchema);
  return archive;
}

function sessionMessages(archive) {
  return archive.table("session_messages");
}

function archiveRow(entry) {
  return {
    idx: entry.index,
    session_id: entry.sessionId || "",
    level: entry.level || "",
    kind: entry.kind || "",
    role: entry.role || "",
    name: entry.name || "",
    message_id: entry.id || "",
    content: entry.content || "",
    message_json: JSON.stringify(entry.message || {}),
    entry_json: JSON.stringify(entry),
  };
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
  let parent = path.dirname(dir);
  if (path.basename(parent) === "sessions") {
    return path.join(path.dirname(parent), "session-archive.db");
  }
  return path.join(dir, "session-archive.db");
}

export function createSessionArchive(file, options) {
  if (!options) {
    options = {};
  }
  let sessionId = options.sessionId || "";

  function append(record) {
    let archive = openArchiveOrm(file);
    let indexRow = sessionMessages(archive).select("idx").orderBy("idx DESC").first();
    let index = 0;
    if (indexRow) {
      if (indexRow.idx !== undefined) {
        index = indexRow.idx + 1;
      }
    }

    let entry = archiveEntry(record, index);
    if (!entry) {
      archive.close();
      return undefined;
    }
    sessionMessages(archive).insert(archiveRow(entry));
    archive.close();
    return entry;
  }

  function readAll() {
    if (!fs.existsSync(file)) {
      return [];
    }
    let archive = openArchiveOrm(file);
    let query = sessionMessages(archive)
      .select("idx", "session_id", "level", "kind", "role", "name", "message_id", "content", "message_json", "entry_json");
    if (sessionId !== "") {
      query = query.where("session_id = ?", sessionId);
    }
    let rows = query.orderBy("idx ASC").find();
    archive.close();
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
    let searchSessionId = options.sessionId || sessionId;
    if (!fs.existsSync(file)) {
      return [];
    }

    let archive = openArchiveOrm(file);
    let rows = [];
    let queryBuilder = sessionMessages(archive)
      .select("idx", "session_id", "level", "kind", "role", "name", "message_id", "content");
    if (searchSessionId !== "") {
      queryBuilder = queryBuilder.where("session_id = ?", searchSessionId);
    }
    if (query === "") {
      rows = queryBuilder.orderBy("idx DESC").limit(maxResults).find();
    } else {
      let pattern = "%" + query + "%";
      rows = queryBuilder
        .where("lower(entry_json) like ?", pattern)
        .orderBy("idx DESC")
        .limit(maxResults)
        .find();
    }
    archive.close();

    let results = [];
    for (let row of rows) {
      results.push({
        index: row.idx,
        sessionId: row.session_id,
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
