let db = require("@std/db");
let fs = require("@std/fs");
let path = require("@std/path");
let crypto = require("@std/crypto");

function now() {
  return (new Date()).toISOString();
}

function jsonText(value) {
  if (value === undefined) {
    return "{}";
  }
  return JSON.stringify(value);
}

function parseJSON(text, fallback) {
  if (!text) {
    return fallback;
  }
  return JSON.parse(String(text));
}

function ensureSchema(conn) {
  conn.exec("create table if not exists gateway_events (id text primary key, source text not null, type text not null, subject text, payload text not null, status text not null, created_at text not null)");
  conn.exec("create table if not exists gateway_tasks (id text primary key, name text not null, kind text not null, status text not null, schedule text, payload text not null, result text, created_at text not null, updated_at text not null)");
  conn.exec("create table if not exists gateway_clients (id text primary key, kind text not null, name text not null, status text not null, meta text not null, created_at text not null, updated_at text not null)");
  conn.exec("create table if not exists gateway_schedules (id text primary key, name text not null, kind text not null, status text not null, schedule text not null, payload text not null, created_at text not null, updated_at text not null)");
  conn.exec("create table if not exists gateway_im_channels (id text primary key, platform text not null, adapter text not null, name text not null, status text not null, config text not null, created_at text not null, updated_at text not null)");
  conn.exec("create table if not exists gateway_im_conversations (id text primary key, channel_id text not null, chat_id text not null, sender_id text not null, subject text not null, status text not null, last_message_id text not null, last_text text not null, last_event_id text not null, last_at text not null, meta text not null, created_at text not null, updated_at text not null)");
  conn.exec("create table if not exists gateway_im_replies (id text primary key, conversation_id text not null, task_id text, event_id text, channel_id text not null, chat_id text not null, sender_id text not null, message_id text, text text not null, status text not null, payload text not null, created_at text not null, updated_at text not null)");
}

function rowsToRecords(rows) {
  let out = [];
  for (let row of rows) {
    let item = {};
    for (let key in row) {
      item[key] = row[key];
    }
    if ("payload" in item) {
      item.payload = parseJSON(item.payload, {});
    }
    if ("result" in item && item.result) {
      item.result = parseJSON(item.result, {});
    }
    if ("meta" in item) {
      item.meta = parseJSON(item.meta, {});
    }
    out.push(item);
  }
  return out;
}

function scheduleRowsToRecords(rows) {
  let out = rowsToRecords(rows);
  for (let item of out) {
    item.schedule = parseJSON(item.schedule, {});
  }
  return out;
}

function imRowsToRecords(rows) {
  let out = rowsToRecords(rows);
  for (let item of out) {
    if ("config" in item) {
      item.config = parseJSON(item.config, {});
    }
  }
  return out;
}

export function openGatewayStore(databaseFile) {
  fs.mkdirSync(path.dirname(databaseFile), { recursive: true });
  let conn = db.open("sqlite", databaseFile);
  ensureSchema(conn);

  function addEvent(source, type, subject, payload, status) {
    let id = "evt-" + crypto.randomUUID();
    let createdAt = now();
    conn.exec(
      "insert into gateway_events (id, source, type, subject, payload, status, created_at) values (?, ?, ?, ?, ?, ?, ?)",
      [id, source, type, subject || "", jsonText(payload), status || "received", createdAt]
    );
    return {
      id: id,
      source: source,
      type: type,
      subject: subject || "",
      payload: payload || {},
      status: status || "received",
      created_at: createdAt,
    };
  }

  function listEvents(limit) {
    let n = Number(limit || 50);
    return rowsToRecords(conn.query("select * from gateway_events order by created_at desc limit ?", [n]));
  }

  function createTask(input) {
    let id = "task-" + crypto.randomUUID();
    let createdAt = now();
    let status = input.status || "pending";
    conn.exec(
      "insert into gateway_tasks (id, name, kind, status, schedule, payload, result, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        input.name || "task",
        input.kind || "agent",
        status,
        input.schedule || "",
        jsonText(input.payload || {}),
        "",
        createdAt,
        createdAt,
      ]
    );
    return getTask(id);
  }

  function getTask(id) {
    let row = conn.queryOne("select * from gateway_tasks where id = ?", [id]);
    if (!row) {
      return undefined;
    }
    return rowsToRecords([row])[0];
  }

  function listTasks(status, limit) {
    let n = Number(limit || 50);
    if (status) {
      return rowsToRecords(conn.query("select * from gateway_tasks where status = ? order by created_at desc limit ?", [status, n]));
    }
    return rowsToRecords(conn.query("select * from gateway_tasks order by created_at desc limit ?", [n]));
  }

  function updateTask(id, patch) {
    let existing = getTask(id);
    if (!existing) {
      return undefined;
    }
    let status = patch.status || existing.status;
    let result = existing.result || {};
    if ("result" in patch) {
      result = patch.result;
    }
    let updatedAt = now();
    conn.exec(
      "update gateway_tasks set status = ?, result = ?, updated_at = ? where id = ?",
      [status, jsonText(result), updatedAt, id]
    );
    return getTask(id);
  }

  function createSchedule(input) {
    let id = "sch-" + crypto.randomUUID();
    let createdAt = now();
    conn.exec(
      "insert into gateway_schedules (id, name, kind, status, schedule, payload, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        input.name || "schedule",
        input.kind || "agent",
        input.status || "active",
        jsonText(input.schedule || {}),
        jsonText(input.payload || {}),
        createdAt,
        createdAt,
      ]
    );
    return getSchedule(id);
  }

  function listSchedules(status, limit) {
    let n = Number(limit || 50);
    if (status) {
      return scheduleRowsToRecords(conn.query("select * from gateway_schedules where status = ? order by created_at desc limit ?", [status, n]));
    }
    return scheduleRowsToRecords(conn.query("select * from gateway_schedules order by created_at desc limit ?", [n]));
  }

  function getSchedule(id) {
    let row = conn.queryOne("select * from gateway_schedules where id = ?", [id]);
    if (!row) {
      return undefined;
    }
    return scheduleRowsToRecords([row])[0];
  }

  function updateSchedule(id, patch) {
    let existing = getSchedule(id);
    if (!existing) {
      return undefined;
    }
    let updatedAt = now();
    conn.exec(
      "update gateway_schedules set name = ?, kind = ?, status = ?, schedule = ?, payload = ?, updated_at = ? where id = ?",
      [
        patch.name || existing.name,
        patch.kind || existing.kind,
        patch.status || existing.status,
        jsonText(("schedule" in patch) ? patch.schedule : existing.schedule),
        jsonText(("payload" in patch) ? patch.payload : existing.payload),
        updatedAt,
        id,
      ]
    );
    return getSchedule(id);
  }

  function removeSchedule(id) {
    let existing = getSchedule(id);
    if (!existing) {
      return undefined;
    }
    conn.exec("delete from gateway_schedules where id = ?", [id]);
    return existing;
  }

  function upsertClient(kind, name, meta) {
    let id = String(kind) + ":" + String(name);
    let existing = conn.queryOne("select id from gateway_clients where id = ?", [id]);
    let updatedAt = now();
    if (existing) {
      conn.exec("update gateway_clients set status = ?, meta = ?, updated_at = ? where id = ?", ["online", jsonText(meta || {}), updatedAt, id]);
    } else {
      conn.exec(
        "insert into gateway_clients (id, kind, name, status, meta, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)",
        [id, kind, name, "online", jsonText(meta || {}), updatedAt, updatedAt]
      );
    }
    return rowsToRecords([conn.queryOne("select * from gateway_clients where id = ?", [id])])[0];
  }

  function listClients(kind) {
    if (kind) {
      return rowsToRecords(conn.query("select * from gateway_clients where kind = ? order by updated_at desc", [kind]));
    }
    return rowsToRecords(conn.query("select * from gateway_clients order by updated_at desc"));
  }

  function createIMChannel(input) {
    let value = input || {};
    let id = value.id || ("imch-" + crypto.randomUUID());
    let createdAt = now();
    conn.exec(
      "insert into gateway_im_channels (id, platform, adapter, name, status, config, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        String(value.platform || ""),
        String(value.adapter || ""),
        String(value.name || id),
        String(value.status || "active"),
        jsonText(value.config || {}),
        createdAt,
        createdAt,
      ]
    );
    return getIMChannel(id);
  }

  function listIMChannels(limit) {
    let n = Number(limit || 50);
    return imRowsToRecords(conn.query("select * from gateway_im_channels order by updated_at desc limit ?", [n]));
  }

  function getIMChannel(id) {
    let row = conn.queryOne("select * from gateway_im_channels where id = ?", [id]);
    if (!row) {
      return undefined;
    }
    return imRowsToRecords([row])[0];
  }

  function updateIMChannel(id, patch) {
    let existing = getIMChannel(id);
    if (!existing) {
      return undefined;
    }
    let value = patch || {};
    let updatedAt = now();
    conn.exec(
      "update gateway_im_channels set platform = ?, adapter = ?, name = ?, status = ?, config = ?, updated_at = ? where id = ?",
      [
        ("platform" in value) ? String(value.platform || "") : existing.platform,
        ("adapter" in value) ? String(value.adapter || "") : existing.adapter,
        ("name" in value) ? String(value.name || "") : existing.name,
        ("status" in value) ? String(value.status || "") : existing.status,
        jsonText(("config" in value) ? value.config : existing.config),
        updatedAt,
        id,
      ]
    );
    return getIMChannel(id);
  }

  function removeIMChannel(id) {
    let existing = getIMChannel(id);
    if (!existing) {
      return undefined;
    }
    conn.exec("delete from gateway_im_channels where id = ?", [id]);
    return existing;
  }

  function upsertIMConversation(input) {
    let value = input || {};
    let id = value.id || (String(value.channelId || value.channel_id || "") + ":" + String(value.chatId || value.chat_id || ""));
    let channelId = String(value.channelId || value.channel_id || "");
    let chatId = String(value.chatId || value.chat_id || "");
    let senderId = String(value.senderId || value.sender_id || "");
    let existing = conn.queryOne("select id, meta, created_at from gateway_im_conversations where id = ?", [id]);
    let updatedAt = now();
    let lastAt = String(value.lastAt || value.last_at || updatedAt);
    if (existing) {
      conn.exec(
        "update gateway_im_conversations set channel_id = ?, chat_id = ?, sender_id = ?, subject = ?, status = ?, last_message_id = ?, last_text = ?, last_event_id = ?, last_at = ?, meta = ?, updated_at = ? where id = ?",
        [
          channelId,
          chatId,
          senderId,
          String(value.subject || chatId || senderId),
          String(value.status || "active"),
          String(value.lastMessageId || value.last_message_id || ""),
          String(value.lastText || value.last_text || ""),
          String(value.lastEventId || value.last_event_id || ""),
          lastAt,
          jsonText(value.meta || parseJSON(existing.meta, {})),
          updatedAt,
          id,
        ]
      );
    } else {
      conn.exec(
        "insert into gateway_im_conversations (id, channel_id, chat_id, sender_id, subject, status, last_message_id, last_text, last_event_id, last_at, meta, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          channelId,
          chatId,
          senderId,
          String(value.subject || chatId || senderId),
          String(value.status || "active"),
          String(value.lastMessageId || value.last_message_id || ""),
          String(value.lastText || value.last_text || ""),
          String(value.lastEventId || value.last_event_id || ""),
          lastAt,
          jsonText(value.meta || {}),
          updatedAt,
          updatedAt,
        ]
      );
    }
    return rowsToRecords([conn.queryOne("select * from gateway_im_conversations where id = ?", [id])])[0];
  }

  function listIMConversations(channelId, limit) {
    let n = Number(limit || 50);
    if (channelId) {
      return rowsToRecords(conn.query("select * from gateway_im_conversations where channel_id = ? order by last_at desc limit ?", [channelId, n]));
    }
    return rowsToRecords(conn.query("select * from gateway_im_conversations order by last_at desc limit ?", [n]));
  }

  function createIMReply(input) {
    let value = input || {};
    let id = value.id || ("imrep-" + crypto.randomUUID());
    let createdAt = now();
    conn.exec(
      "insert into gateway_im_replies (id, conversation_id, task_id, event_id, channel_id, chat_id, sender_id, message_id, text, status, payload, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        String(value.conversationId || value.conversation_id || ""),
        String(value.taskId || value.task_id || ""),
        String(value.eventId || value.event_id || ""),
        String(value.channelId || value.channel_id || ""),
        String(value.chatId || value.chat_id || ""),
        String(value.senderId || value.sender_id || ""),
        String(value.messageId || value.message_id || ""),
        String(value.text || ""),
        String(value.status || "pending"),
        jsonText(value.payload || {}),
        createdAt,
        createdAt,
      ]
    );
    return rowsToRecords([conn.queryOne("select * from gateway_im_replies where id = ?", [id])])[0];
  }

  function updateIMReply(id, patch) {
    let existingRow = conn.queryOne("select * from gateway_im_replies where id = ?", [id]);
    if (!existingRow) {
      return undefined;
    }
    let existing = rowsToRecords([existingRow])[0];
    let value = patch || {};
    let updatedAt = now();
    conn.exec(
      "update gateway_im_replies set conversation_id = ?, task_id = ?, event_id = ?, channel_id = ?, chat_id = ?, sender_id = ?, message_id = ?, text = ?, status = ?, payload = ?, updated_at = ? where id = ?",
      [
        ("conversationId" in value) ? String(value.conversationId || "") : existing.conversation_id,
        ("taskId" in value) ? String(value.taskId || "") : existing.task_id,
        ("eventId" in value) ? String(value.eventId || "") : existing.event_id,
        ("channelId" in value) ? String(value.channelId || "") : existing.channel_id,
        ("chatId" in value) ? String(value.chatId || "") : existing.chat_id,
        ("senderId" in value) ? String(value.senderId || "") : existing.sender_id,
        ("messageId" in value) ? String(value.messageId || "") : existing.message_id,
        ("text" in value) ? String(value.text || "") : existing.text,
        ("status" in value) ? String(value.status || "") : existing.status,
        jsonText(("payload" in value) ? value.payload : existing.payload),
        updatedAt,
        id,
      ]
    );
    return rowsToRecords([conn.queryOne("select * from gateway_im_replies where id = ?", [id])])[0];
  }

  return {
    addEvent: addEvent,
    listEvents: listEvents,
    createTask: createTask,
    getTask: getTask,
    listTasks: listTasks,
    updateTask: updateTask,
    createSchedule: createSchedule,
    listSchedules: listSchedules,
    getSchedule: getSchedule,
    updateSchedule: updateSchedule,
    removeSchedule: removeSchedule,
    upsertClient: upsertClient,
    listClients: listClients,
    createIMChannel: createIMChannel,
    listIMChannels: listIMChannels,
    getIMChannel: getIMChannel,
    updateIMChannel: updateIMChannel,
    removeIMChannel: removeIMChannel,
    upsertIMConversation: upsertIMConversation,
    listIMConversations: listIMConversations,
    createIMReply: createIMReply,
    updateIMReply: updateIMReply,
  };
}
