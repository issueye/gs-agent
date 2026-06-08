let fs = require("@std/fs");
let path = require("@std/path");
let crypto = require("@std/crypto");

import { createSessionArchive, defaultArchiveFile } from "@/agent/session/archive";
import { messagesFromSessionEvents, sessionRecordLevel } from "@/agent/session/messages";

// session 文件不存在时视为空内容，方便首次运行直接 append。
function readText(file) {
  if (!fs.existsSync(file)) {
    return "";
  }
  return fs.readFileSync(file);
}

// appendTextSync 由 GoScript 标准库提供，避免每次追加都读写整个 session 文件。
function appendLine(file, line) {
  let dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendTextSync(file, line + "\n");
}

// JSONL session 每行一条事件，适合边运行边观察，也便于后续工具解析。
export function createJSONLSession(file, options) {
  if (!options) {
    options = {};
  }

  let id = options.sessionId || crypto.randomUUID();
  let archiveFile = options.archiveFile;
  if (archiveFile === undefined) {
    archiveFile = defaultArchiveFile(file);
  }
  let archive = undefined;
  if (archiveFile) {
    archive = createSessionArchive(archiveFile, {
      sessionId: id,
    });
  }

  function append(kind, payload) {
    let record = {
      sessionId: id,
      level: sessionRecordLevel(kind, payload),
      kind: kind,
      payload: payload,
    };
    appendLine(file, JSON.stringify(record));
    if (archive) {
      archive.append(record);
    }
    return record;
  }

  function readAll() {
    let text = readText(file);
    let lines = text.split("\n");
    let records = [];
    for (let line of lines) {
      let trimmed = line.trim();
      if (trimmed !== "") {
        let record = JSON.parse(trimmed);
        if (!record.level) {
          record.level = sessionRecordLevel(record.kind, record.payload);
        }
        records.push(record);
      }
    }
    return records;
  }

  function readMessages(options) {
    return messagesFromSessionEvents(readAll(), options);
  }

  return {
    id: id,
    file: file,
    archiveFile: archiveFile,
    archive: archive,
    append: append,
    readAll: readAll,
    readMessages: readMessages,
  };
}
