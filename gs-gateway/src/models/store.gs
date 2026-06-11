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
  conn.exec("create table if not exists gateway_providers (id text primary key, name text not null, type text not null, enabled integer not null, config text not null, created_at text not null, updated_at text not null)");
  conn.exec("create table if not exists gateway_agents (id text primary key, name text not null, provider_id text, model_provider text not null, model_name text, transport text not null, enabled integer not null, config text not null, created_at text not null, updated_at text not null)");
  conn.exec("create table if not exists gateway_agent_instances (id text primary key, agent_id text not null, name text not null, status text not null, config text not null, created_at text not null, updated_at text not null)");
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

function providerRowsToRecords(rows) {
  let records = rowsToRecords(rows);
  let out = [];
  for (let item of records) {
    item.enabled = Number(item.enabled || 0) === 1;
    let config = parseJSON(item.config, {});
    out.push({
      id: item.id,
      name: item.name,
      type: item.type,
      enabled: item.enabled,
      baseUrl: config.baseUrl || "",
      defaultModel: config.defaultModel || "",
      apiKeySet: String(config.apiKey || "") !== "",
      apiKeyPreview: maskSecret(config.apiKey || ""),
      created_at: item.created_at,
      updated_at: item.updated_at,
    });
  }
  return out;
}

function agentRowsToRecords(rows) {
  let records = rowsToRecords(rows);
  let out = [];
  for (let item of records) {
    item.enabled = Number(item.enabled || 0) === 1;
    let config = parseJSON(item.config, {});
    out.push({
      id: item.id,
      name: item.name,
      providerId: item.provider_id || "",
      modelProvider: item.model_provider || "",
      modelName: item.model_name || "",
      transport: item.transport,
      enabled: item.enabled,
      baseUrl: config.baseUrl || "",
      commandArgs: config.commandArgs || [],
      systemPrompt: config.systemPrompt || "",
      maxIterations: Number(config.maxIterations || 0),
      toolWhitelist: config.toolWhitelist || [],
      networkAllow: config.networkAllow || [],
      mcpServerIds: config.mcpServerIds || [],
      skillIds: config.skillIds || [],
      created_at: item.created_at,
      updated_at: item.updated_at,
    });
  }
  return out;
}

function agentInstanceRowsToRecords(rows) {
  let records = rowsToRecords(rows);
  let out = [];
  for (let item of records) {
    let config = parseJSON(item.config, {});
    out.push({
      id: item.id,
      agentId: item.agent_id || "",
      name: item.name,
      status: item.status,
      baseUrl: config.baseUrl || "",
      transport: config.transport || "websocket",
      commandArgs: config.commandArgs || [],
      providerId: config.providerId || "",
      modelProvider: config.modelProvider || "",
      modelName: config.modelName || "",
      modelBaseUrl: config.modelBaseUrl || "",
      apiKeySet: Boolean(config.apiKeySet),
      pid: Number(config.pid || 0),
      host: config.host || "127.0.0.1",
      port: Number(config.port || 0),
      lastHeartbeatAt: config.lastHeartbeatAt || item.updated_at || "",
      lastError: config.lastError || "",
      inflight: Number(config.inflight || 0),
      created_at: item.created_at,
      updated_at: item.updated_at,
    });
  }
  return out;
}

function maskSecret(value) {
  let text = String(value || "");
  if (text === "") {
    return "";
  }
  if (text.length <= 8) {
    return "****";
  }
  return text.slice(0, 4) + "..." + text.slice(text.length - 4);
}

function slug(value, fallback) {
  let text = String(value || fallback || "").trim().toLowerCase();
  let out = "";
  for (let i = 0; i < text.length; i = i + 1) {
    let ch = text[i];
    if ((ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9")) {
      out = out + ch;
    } else if (out !== "" && out[out.length - 1] !== "-") {
      out = out + "-";
    }
  }
  while (out.endsWith("-")) {
    out = out.slice(0, out.length - 1);
  }
  return out || String(fallback || "item");
}

function textList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter((item) => item !== "");
  }
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter((item) => item !== "");
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
    let payload = existing.payload || {};
    if ("payload" in patch) {
      payload = patch.payload || {};
    }
    let result = existing.result || {};
    if ("result" in patch) {
      result = patch.result;
    }
    let updatedAt = now();
    conn.exec(
      "update gateway_tasks set status = ?, payload = ?, result = ?, updated_at = ? where id = ?",
      [status, jsonText(payload), jsonText(result), updatedAt, id]
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

  function listProviders() {
    return providerRowsToRecords(conn.query("select * from gateway_providers order by updated_at desc"));
  }

  function getProvider(id) {
    let row = conn.queryOne("select * from gateway_providers where id = ?", [id]);
    if (!row) {
      return undefined;
    }
    return providerRowsToRecords([row])[0];
  }

  function getProviderSecret(id) {
    let row = conn.queryOne("select * from gateway_providers where id = ?", [id]);
    if (!row) {
      return undefined;
    }
    let config = parseJSON(row.config, {});
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      enabled: Number(row.enabled || 0) === 1,
      baseUrl: config.baseUrl || "",
      defaultModel: config.defaultModel || "",
      apiKey: config.apiKey || "",
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  function createProvider(input) {
    let value = input || {};
    let id = String(value.id || ("provider-" + slug(value.name || value.type, "provider"))).trim();
    let createdAt = now();
    conn.exec(
      "insert into gateway_providers (id, name, type, enabled, config, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        String(value.name || id),
        String(value.type || "openai"),
        value.enabled === false ? 0 : 1,
        jsonText({
          baseUrl: String(value.baseUrl || ""),
          defaultModel: String(value.defaultModel || ""),
          apiKey: String(value.apiKey || ""),
        }),
        createdAt,
        createdAt,
      ]
    );
    return getProvider(id);
  }

  function updateProvider(id, patch) {
    let existingRow = conn.queryOne("select * from gateway_providers where id = ?", [id]);
    if (!existingRow) {
      return undefined;
    }
    let existing = providerRowsToRecords([existingRow])[0];
    let existingConfig = parseJSON(existingRow.config, {});
    let value = patch || {};
    let nextConfig = {
      baseUrl: ("baseUrl" in value) ? String(value.baseUrl || "") : existingConfig.baseUrl || "",
      defaultModel: ("defaultModel" in value) ? String(value.defaultModel || "") : existingConfig.defaultModel || "",
      apiKey: existingConfig.apiKey || "",
    };
    if ("apiKey" in value && String(value.apiKey || "") !== "") {
      nextConfig.apiKey = String(value.apiKey || "");
    }
    let updatedAt = now();
    conn.exec(
      "update gateway_providers set name = ?, type = ?, enabled = ?, config = ?, updated_at = ? where id = ?",
      [
        ("name" in value) ? String(value.name || existing.name) : existing.name,
        ("type" in value) ? String(value.type || existing.type) : existing.type,
        ("enabled" in value) ? (value.enabled === false ? 0 : 1) : (existing.enabled ? 1 : 0),
        jsonText(nextConfig),
        updatedAt,
        id,
      ]
    );
    return getProvider(id);
  }

  function removeProvider(id) {
    let existing = getProvider(id);
    if (!existing) {
      return undefined;
    }
    conn.exec("delete from gateway_providers where id = ?", [id]);
    return existing;
  }

  function listAgents() {
    return agentRowsToRecords(conn.query("select * from gateway_agents order by updated_at desc"));
  }

  function getAgent(id) {
    let row = conn.queryOne("select * from gateway_agents where id = ?", [id]);
    if (!row) {
      return undefined;
    }
    return agentRowsToRecords([row])[0];
  }

  function createAgent(input) {
    let value = input || {};
    let id = String(value.id || ("agent-" + slug(value.name, "agent"))).trim();
    let createdAt = now();
    conn.exec(
      "insert into gateway_agents (id, name, provider_id, model_provider, model_name, transport, enabled, config, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        String(value.name || id),
        String(value.providerId || value.provider_id || ""),
        String(value.modelProvider || value.model_provider || "openai"),
        String(value.modelName || value.model_name || ""),
        String(value.transport || "websocket"),
        value.enabled === false ? 0 : 1,
        jsonText({
          baseUrl: String(value.baseUrl || ""),
          commandArgs: textList(value.commandArgs),
          systemPrompt: String(value.systemPrompt || ""),
          maxIterations: Number(value.maxIterations || 0),
          toolWhitelist: textList(value.toolWhitelist),
          networkAllow: textList(value.networkAllow),
          mcpServerIds: textList(value.mcpServerIds),
          skillIds: textList(value.skillIds),
        }),
        createdAt,
        createdAt,
      ]
    );
    return getAgent(id);
  }

  function updateAgent(id, patch) {
    let existingRow = conn.queryOne("select * from gateway_agents where id = ?", [id]);
    if (!existingRow) {
      return undefined;
    }
    let existing = agentRowsToRecords([existingRow])[0];
    let existingConfig = parseJSON(existingRow.config, {});
    let value = patch || {};
    let nextConfig = {
      baseUrl: ("baseUrl" in value) ? String(value.baseUrl || "") : existingConfig.baseUrl || "",
      commandArgs: ("commandArgs" in value) ? textList(value.commandArgs) : existingConfig.commandArgs || [],
      systemPrompt: ("systemPrompt" in value) ? String(value.systemPrompt || "") : existingConfig.systemPrompt || "",
      maxIterations: ("maxIterations" in value) ? Number(value.maxIterations || 0) : Number(existingConfig.maxIterations || 0),
      toolWhitelist: ("toolWhitelist" in value) ? textList(value.toolWhitelist) : existingConfig.toolWhitelist || [],
      networkAllow: ("networkAllow" in value) ? textList(value.networkAllow) : existingConfig.networkAllow || [],
      mcpServerIds: ("mcpServerIds" in value) ? textList(value.mcpServerIds) : existingConfig.mcpServerIds || [],
      skillIds: ("skillIds" in value) ? textList(value.skillIds) : existingConfig.skillIds || [],
    };
    let updatedAt = now();
    conn.exec(
      "update gateway_agents set name = ?, provider_id = ?, model_provider = ?, model_name = ?, transport = ?, enabled = ?, config = ?, updated_at = ? where id = ?",
      [
        ("name" in value) ? String(value.name || existing.name) : existing.name,
        ("providerId" in value || "provider_id" in value) ? String(value.providerId || value.provider_id || "") : existing.providerId,
        ("modelProvider" in value || "model_provider" in value) ? String(value.modelProvider || value.model_provider || existing.modelProvider) : existing.modelProvider,
        ("modelName" in value || "model_name" in value) ? String(value.modelName || value.model_name || "") : existing.modelName,
        ("transport" in value) ? String(value.transport || existing.transport) : existing.transport,
        ("enabled" in value) ? (value.enabled === false ? 0 : 1) : (existing.enabled ? 1 : 0),
        jsonText(nextConfig),
        updatedAt,
        id,
      ]
    );
    return getAgent(id);
  }

  function removeAgent(id) {
    let existing = getAgent(id);
    if (!existing) {
      return undefined;
    }
    conn.exec("delete from gateway_agents where id = ?", [id]);
    return existing;
  }

  function listAgentInstances() {
    return agentInstanceRowsToRecords(conn.query("select * from gateway_agent_instances order by updated_at desc"));
  }

  function getAgentInstance(id) {
    let row = conn.queryOne("select * from gateway_agent_instances where id = ?", [id]);
    if (!row) {
      return undefined;
    }
    return agentInstanceRowsToRecords([row])[0];
  }

  function createAgentInstance(input) {
    let value = input || {};
    let agentId = String(value.agentId || value.agent_id || "");
    let id = String(value.id || ("inst-" + crypto.randomUUID()));
    let createdAt = now();
    conn.exec(
      "insert into gateway_agent_instances (id, agent_id, name, status, config, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        agentId,
        String(value.name || agentId || id),
        String(value.status || "ready"),
        jsonText(value.config || {}),
        createdAt,
        createdAt,
      ]
    );
    return getAgentInstance(id);
  }

  function updateAgentInstance(id, patch) {
    let existingRow = conn.queryOne("select * from gateway_agent_instances where id = ?", [id]);
    if (!existingRow) {
      return undefined;
    }
    let existing = agentInstanceRowsToRecords([existingRow])[0];
    let config = parseJSON(existingRow.config, {});
    let value = patch || {};
    if ("config" in value) {
      let nextConfig = value.config || {};
      for (let key in nextConfig) {
        config[key] = nextConfig[key];
      }
    }
    let updatedAt = now();
    conn.exec(
      "update gateway_agent_instances set name = ?, status = ?, config = ?, updated_at = ? where id = ?",
      [
        ("name" in value) ? String(value.name || existing.name) : existing.name,
        ("status" in value) ? String(value.status || existing.status) : existing.status,
        jsonText(config),
        updatedAt,
        id,
      ]
    );
    return getAgentInstance(id);
  }

  function removeAgentInstance(id) {
    let existing = getAgentInstance(id);
    if (!existing) {
      return undefined;
    }
    conn.exec("delete from gateway_agent_instances where id = ?", [id]);
    return existing;
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

  function getIMConversation(id) {
    let row = conn.queryOne("select * from gateway_im_conversations where id = ?", [id]);
    if (!row) {
      return undefined;
    }
    return rowsToRecords([row])[0];
  }

  function removeIMConversation(id) {
    let existing = getIMConversation(id);
    if (!existing) {
      return undefined;
    }
    conn.exec("delete from gateway_im_replies where conversation_id = ?", [id]);
    conn.exec("delete from gateway_im_conversations where id = ?", [id]);
    return existing;
  }

  function hasObjectFields(value) {
    if (!value || typeof value !== "object") {
      return false;
    }
    for (let key in value) {
      return true;
    }
    return false;
  }

  function hasGatewayTaskToolCall(toolCalls, taskId) {
    for (let tc of toolCalls || []) {
      if (String(tc.id || "") === String(taskId || "")) {
        return true;
      }
    }
    return false;
  }

  function listIMConversationMessages(id) {
    let conversation = getIMConversation(id);
    if (!conversation) {
      conversation = getIMConversation("desktop:wails:" + String(id || ""));
    }
    if (!conversation) {
      return undefined;
    }

    let tasks = rowsToRecords(conn.query("select * from gateway_tasks where kind = ? order by created_at asc", ["agent.im"]));
    let messages = [];
    for (let task of tasks) {
      let payload = task.payload || {};
      let input = payload.input || {};
      let im = input.im || {};
      let source = payload.source || {};
      let matchesConversation = source.conversationId === id ||
        source.conversationId === conversation.id ||
        String(im.conversationId || im.conversation_id || "") === id ||
        String(im.conversationId || im.conversation_id || "") === conversation.id ||
        String(im.chatId || im.chat || "") === id ||
        (String(im.channelId || "") === String(conversation.channel_id || "") && String(im.chatId || im.chat || "") === String(conversation.chat_id || ""));
      if (!matchesConversation) {
        continue;
      }

      let text = String(input.text || im.text || "");
      let result = task.result || {};
      let answer = String(result.answer || "");
      let toolCalls = payload.tool_calls || [];
      if (text !== "") {
        messages.push({
          id: task.id + ":user",
          role: "user",
          content: text,
          metadata: {
            taskId: task.id,
          },
          created_at: task.created_at,
        });
      }

      if (!hasGatewayTaskToolCall(toolCalls, task.id)) {
        messages.push({
          id: task.id + ":tool",
          role: "assistant",
          content: "",
          tool_calls: [{
            ID: String(task.id || ""),
            Name: String(task.kind || "agent.im"),
            Title: "网关任务",
            Kind: String(task.kind || "agent.im"),
            Status: String(task.status || "pending"),
            Arguments: text,
            Result: hasObjectFields(result) ? result : "",
          }],
          metadata: { taskId: task.id },
          created_at: task.created_at,
        });
      }

      for (let tc of toolCalls) {
        messages.push({
          id: task.id + ":tool:" + String(tc.id || ""),
          role: "assistant",
          content: "",
          tool_calls: [{
            ID: String(tc.id || ""),
            Name: String(tc.name || "tool"),
            Title: String(tc.title || tc.name || "工具"),
            Kind: String(tc.kind || tc.name || "tool"),
            Status: String(tc.status || "completed"),
            Arguments: tc.arguments || "",
            Result: tc.result || "",
          }],
          metadata: { taskId: task.id },
          created_at: task.created_at,
        });
      }

      if (answer !== "") {
        messages.push({
          id: task.id + ":assistant",
          role: "assistant",
          content: answer,
          metadata: {
            taskId: task.id,
          },
          created_at: task.updated_at || task.created_at,
        });
        continue;
      }

      if (task.status === "failed" && result.error) {
        messages.push({
          id: task.id + ":error",
          role: "assistant",
          content: String(result.error.message || result.error || "任务执行失败"),
          metadata: {
            taskId: task.id,
          },
          error: true,
          created_at: task.updated_at || task.created_at,
        });
      }
    }
    return messages;
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
    listProviders: listProviders,
    getProvider: getProvider,
    getProviderSecret: getProviderSecret,
    createProvider: createProvider,
    updateProvider: updateProvider,
    removeProvider: removeProvider,
    listAgents: listAgents,
    getAgent: getAgent,
    createAgent: createAgent,
    updateAgent: updateAgent,
    removeAgent: removeAgent,
    listAgentInstances: listAgentInstances,
    getAgentInstance: getAgentInstance,
    createAgentInstance: createAgentInstance,
    updateAgentInstance: updateAgentInstance,
    removeAgentInstance: removeAgentInstance,
    createIMChannel: createIMChannel,
    listIMChannels: listIMChannels,
    getIMChannel: getIMChannel,
    updateIMChannel: updateIMChannel,
    removeIMChannel: removeIMChannel,
    upsertIMConversation: upsertIMConversation,
    listIMConversations: listIMConversations,
    getIMConversation: getIMConversation,
    removeIMConversation: removeIMConversation,
    listIMConversationMessages: listIMConversationMessages,
    createIMReply: createIMReply,
    updateIMReply: updateIMReply,
  };
}
