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

  function listDueSchedules(nowIso, limit) {
    let n = Number(limit || 50);
    let dueAt = nowIso || now();
    let schedules = scheduleRowsToRecords(conn.query("select * from gateway_schedules where status = ? order by created_at asc", ["active"]));
    let due = [];
    for (let schedule of schedules) {
      if (schedule.schedule && schedule.schedule.dueAt && String(schedule.schedule.dueAt) <= dueAt) {
        due.push(schedule);
      }
      if (due.length >= n) {
        break;
      }
    }
    return due;
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
    listDueSchedules: listDueSchedules,
    upsertClient: upsertClient,
    listClients: listClients,
  };
}
