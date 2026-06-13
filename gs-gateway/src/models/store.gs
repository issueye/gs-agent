import orm from "@std/orm";

let fs = require("@std/fs");
let path = require("@std/path");
let crypto = require("@std/crypto");
let process = require("@std/process");

let TABLES = {
  events: "gateway_events",
  tasks: "gateway_tasks",
  clients: "gateway_clients",
  providers: "gateway_providers",
  agents: "gateway_agents",
  agentInstances: "gateway_agent_instances",
  schedules: "gateway_schedules",
  imChannels: "gateway_im_channels",
  imConversations: "gateway_im_conversations",
  imReplies: "gateway_im_replies",
};

let GATEWAY_SCHEMA = [
  {
    table: TABLES.events,
    columns: [
      { name: "id", type: "text", primaryKey: true },
      { name: "source", type: "text", notNull: true },
      { name: "type", type: "text", notNull: true },
      { name: "subject", type: "text" },
      { name: "payload", type: "text", notNull: true },
      { name: "status", type: "text", notNull: true },
      { name: "created_at", type: "text", notNull: true },
    ],
  },
  {
    table: TABLES.tasks,
    columns: [
      { name: "id", type: "text", primaryKey: true },
      { name: "name", type: "text", notNull: true },
      { name: "kind", type: "text", notNull: true },
      { name: "status", type: "text", notNull: true },
      { name: "schedule", type: "text" },
      { name: "payload", type: "text", notNull: true },
      { name: "result", type: "text" },
      { name: "created_at", type: "text", notNull: true },
      { name: "updated_at", type: "text", notNull: true },
    ],
  },
  {
    table: TABLES.clients,
    columns: [
      { name: "id", type: "text", primaryKey: true },
      { name: "kind", type: "text", notNull: true },
      { name: "name", type: "text", notNull: true },
      { name: "status", type: "text", notNull: true },
      { name: "meta", type: "text", notNull: true },
      { name: "created_at", type: "text", notNull: true },
      { name: "updated_at", type: "text", notNull: true },
    ],
  },
  {
    table: TABLES.providers,
    columns: [
      { name: "id", type: "text", primaryKey: true },
      { name: "name", type: "text", notNull: true },
      { name: "type", type: "text", notNull: true },
      { name: "enabled", type: "integer", notNull: true },
      { name: "config", type: "text", notNull: true },
      { name: "created_at", type: "text", notNull: true },
      { name: "updated_at", type: "text", notNull: true },
    ],
  },
  {
    table: TABLES.agents,
    columns: [
      { name: "id", type: "text", primaryKey: true },
      { name: "name", type: "text", notNull: true },
      { name: "provider_id", type: "text" },
      { name: "model_provider", type: "text", notNull: true },
      { name: "model_name", type: "text" },
      { name: "transport", type: "text", notNull: true },
      { name: "enabled", type: "integer", notNull: true },
      { name: "config", type: "text", notNull: true },
      { name: "created_at", type: "text", notNull: true },
      { name: "updated_at", type: "text", notNull: true },
    ],
  },
  {
    table: TABLES.agentInstances,
    columns: [
      { name: "id", type: "text", primaryKey: true },
      { name: "agent_id", type: "text", notNull: true },
      { name: "name", type: "text", notNull: true },
      { name: "status", type: "text", notNull: true },
      { name: "config", type: "text", notNull: true },
      { name: "created_at", type: "text", notNull: true },
      { name: "updated_at", type: "text", notNull: true },
    ],
  },
  {
    table: TABLES.schedules,
    columns: [
      { name: "id", type: "text", primaryKey: true },
      { name: "name", type: "text", notNull: true },
      { name: "kind", type: "text", notNull: true },
      { name: "status", type: "text", notNull: true },
      { name: "schedule", type: "text", notNull: true },
      { name: "payload", type: "text", notNull: true },
      { name: "created_at", type: "text", notNull: true },
      { name: "updated_at", type: "text", notNull: true },
    ],
  },
  {
    table: TABLES.imChannels,
    columns: [
      { name: "id", type: "text", primaryKey: true },
      { name: "platform", type: "text", notNull: true },
      { name: "adapter", type: "text", notNull: true },
      { name: "name", type: "text", notNull: true },
      { name: "status", type: "text", notNull: true },
      { name: "config", type: "text", notNull: true },
      { name: "created_at", type: "text", notNull: true },
      { name: "updated_at", type: "text", notNull: true },
    ],
  },
  {
    table: TABLES.imConversations,
    columns: [
      { name: "id", type: "text", primaryKey: true },
      { name: "channel_id", type: "text", notNull: true },
      { name: "chat_id", type: "text", notNull: true },
      { name: "sender_id", type: "text", notNull: true },
      { name: "subject", type: "text", notNull: true },
      { name: "status", type: "text", notNull: true },
      { name: "last_message_id", type: "text", notNull: true },
      { name: "last_text", type: "text", notNull: true },
      { name: "last_event_id", type: "text", notNull: true },
      { name: "last_at", type: "text", notNull: true },
      { name: "meta", type: "text", notNull: true },
      { name: "created_at", type: "text", notNull: true },
      { name: "updated_at", type: "text", notNull: true },
    ],
  },
  {
    table: TABLES.imReplies,
    columns: [
      { name: "id", type: "text", primaryKey: true },
      { name: "conversation_id", type: "text", notNull: true },
      { name: "task_id", type: "text" },
      { name: "event_id", type: "text" },
      { name: "channel_id", type: "text", notNull: true },
      { name: "chat_id", type: "text", notNull: true },
      { name: "sender_id", type: "text", notNull: true },
      { name: "message_id", type: "text" },
      { name: "text", type: "text", notNull: true },
      { name: "status", type: "text", notNull: true },
      { name: "payload", type: "text", notNull: true },
      { name: "created_at", type: "text", notNull: true },
      { name: "updated_at", type: "text", notNull: true },
    ],
  },
];

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

function ensureSchema(storeDb) {
  storeDb.autoMigrate(GATEWAY_SCHEMA);
}

function table(storeDb, name) {
  return storeDb.table(name);
}

function findById(storeDb, tableName, id) {
  return table(storeDb, tableName).where("id = ?", id).first();
}

function deleteById(storeDb, tableName, id) {
  return table(storeDb, tableName).where("id = ?", id).delete();
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
  let conn = orm.connect("sqlite", databaseFile);
  ensureSchema(conn);

  function addEvent(source, type, subject, payload, status) {
    let id = "evt-" + crypto.randomUUID();
    let createdAt = now();
    table(conn, TABLES.events).insert({
      id: id,
      source: source,
      type: type,
      subject: subject || "",
      payload: jsonText(payload),
      status: status || "received",
      created_at: createdAt,
    });
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
    return rowsToRecords(table(conn, TABLES.events).orderBy("created_at desc").limit(n).find());
  }

  function createTask(input) {
    let id = "task-" + crypto.randomUUID();
    let createdAt = now();
    let status = input.status || "pending";
    table(conn, TABLES.tasks).insert({
      id: id,
      name: input.name || "task",
      kind: input.kind || "agent",
      status: status,
      schedule: input.schedule || "",
      payload: jsonText(input.payload || {}),
      result: "",
      created_at: createdAt,
      updated_at: createdAt,
    });
    return getTask(id);
  }

  function getTask(id) {
    let row = findById(conn, TABLES.tasks, id);
    if (!row) {
      return undefined;
    }
    return rowsToRecords([row])[0];
  }

  function listTasks(status, limit) {
    let n = Number(limit || 50);
    if (status) {
      return rowsToRecords(table(conn, TABLES.tasks).where("status = ?", status).orderBy("created_at desc").limit(n).find());
    }
    return rowsToRecords(table(conn, TABLES.tasks).orderBy("created_at desc").limit(n).find());
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
    table(conn, TABLES.tasks).where("id = ?", id).update({
      status: status,
      payload: jsonText(payload),
      result: jsonText(result),
      updated_at: updatedAt,
    });
    return getTask(id);
  }

  function createSchedule(input) {
    let id = "sch-" + crypto.randomUUID();
    let createdAt = now();
    table(conn, TABLES.schedules).insert({
      id: id,
      name: input.name || "schedule",
      kind: input.kind || "agent",
      status: input.status || "active",
      schedule: jsonText(input.schedule || {}),
      payload: jsonText(input.payload || {}),
      created_at: createdAt,
      updated_at: createdAt,
    });
    return getSchedule(id);
  }

  function listSchedules(status, limit) {
    let n = Number(limit || 50);
    if (status) {
      return scheduleRowsToRecords(table(conn, TABLES.schedules).where("status = ?", status).orderBy("created_at desc").limit(n).find());
    }
    return scheduleRowsToRecords(table(conn, TABLES.schedules).orderBy("created_at desc").limit(n).find());
  }

  function getSchedule(id) {
    let row = findById(conn, TABLES.schedules, id);
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
    table(conn, TABLES.schedules).where("id = ?", id).update({
      name: patch.name || existing.name,
      kind: patch.kind || existing.kind,
      status: patch.status || existing.status,
      schedule: jsonText(("schedule" in patch) ? patch.schedule : existing.schedule),
      payload: jsonText(("payload" in patch) ? patch.payload : existing.payload),
      updated_at: updatedAt,
    });
    return getSchedule(id);
  }

  function removeSchedule(id) {
    let existing = getSchedule(id);
    if (!existing) {
      return undefined;
    }
    deleteById(conn, TABLES.schedules, id);
    return existing;
  }

  function upsertClient(kind, name, meta) {
    let id = String(kind) + ":" + String(name);
    let existing = findById(conn, TABLES.clients, id);
    let updatedAt = now();
    if (existing) {
      table(conn, TABLES.clients).where("id = ?", id).update({
        status: "online",
        meta: jsonText(meta || {}),
        updated_at: updatedAt,
      });
    } else {
      table(conn, TABLES.clients).insert({
        id: id,
        kind: kind,
        name: name,
        status: "online",
        meta: jsonText(meta || {}),
        created_at: updatedAt,
        updated_at: updatedAt,
      });
    }
    return rowsToRecords([findById(conn, TABLES.clients, id)])[0];
  }

  function listClients(kind) {
    if (kind) {
      return rowsToRecords(table(conn, TABLES.clients).where("kind = ?", kind).orderBy("updated_at desc").find());
    }
    return rowsToRecords(table(conn, TABLES.clients).orderBy("updated_at desc").find());
  }

  function listProviders() {
    return providerRowsToRecords(table(conn, TABLES.providers).orderBy("updated_at desc").find());
  }

  function getProvider(id) {
    let row = findById(conn, TABLES.providers, id);
    if (!row) {
      return undefined;
    }
    return providerRowsToRecords([row])[0];
  }

  function getProviderSecret(id) {
    let row = findById(conn, TABLES.providers, id);
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
    table(conn, TABLES.providers).insert({
      id: id,
      name: String(value.name || id),
      type: String(value.type || "openai"),
      enabled: value.enabled === false ? 0 : 1,
      config: jsonText({
        baseUrl: String(value.baseUrl || ""),
        defaultModel: String(value.defaultModel || ""),
        apiKey: String(value.apiKey || ""),
      }),
      created_at: createdAt,
      updated_at: createdAt,
    });
    return getProvider(id);
  }

  function updateProvider(id, patch) {
    let existingRow = findById(conn, TABLES.providers, id);
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
    table(conn, TABLES.providers).where("id = ?", id).update({
      name: ("name" in value) ? String(value.name || existing.name) : existing.name,
      type: ("type" in value) ? String(value.type || existing.type) : existing.type,
      enabled: ("enabled" in value) ? (value.enabled === false ? 0 : 1) : (existing.enabled ? 1 : 0),
      config: jsonText(nextConfig),
      updated_at: updatedAt,
    });
    return getProvider(id);
  }

  function removeProvider(id) {
    let existing = getProvider(id);
    if (!existing) {
      return undefined;
    }
    deleteById(conn, TABLES.providers, id);
    return existing;
  }

  function listAgents() {
    return agentRowsToRecords(table(conn, TABLES.agents).orderBy("updated_at desc").find());
  }

  function getAgent(id) {
    let row = findById(conn, TABLES.agents, id);
    if (!row) {
      return undefined;
    }
    return agentRowsToRecords([row])[0];
  }

  function createAgent(input) {
    let value = input || {};
    let id = String(value.id || ("agent-" + slug(value.name, "agent"))).trim();
    let createdAt = now();
    table(conn, TABLES.agents).insert({
      id: id,
      name: String(value.name || id),
      provider_id: String(value.providerId || value.provider_id || ""),
      model_provider: String(value.modelProvider || value.model_provider || "openai"),
      model_name: String(value.modelName || value.model_name || ""),
      transport: String(value.transport || "websocket"),
      enabled: value.enabled === false ? 0 : 1,
      config: jsonText({
        baseUrl: String(value.baseUrl || ""),
        commandArgs: textList(value.commandArgs),
        systemPrompt: String(value.systemPrompt || ""),
        maxIterations: Number(value.maxIterations || 0),
        toolWhitelist: textList(value.toolWhitelist),
        networkAllow: textList(value.networkAllow),
        mcpServerIds: textList(value.mcpServerIds),
        skillIds: textList(value.skillIds),
      }),
      created_at: createdAt,
      updated_at: createdAt,
    });
    return getAgent(id);
  }

  function updateAgent(id, patch) {
    let existingRow = findById(conn, TABLES.agents, id);
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
    table(conn, TABLES.agents).where("id = ?", id).update({
      name: ("name" in value) ? String(value.name || existing.name) : existing.name,
      provider_id: ("providerId" in value || "provider_id" in value) ? String(value.providerId || value.provider_id || "") : existing.providerId,
      model_provider: ("modelProvider" in value || "model_provider" in value) ? String(value.modelProvider || value.model_provider || existing.modelProvider) : existing.modelProvider,
      model_name: ("modelName" in value || "model_name" in value) ? String(value.modelName || value.model_name || "") : existing.modelName,
      transport: ("transport" in value) ? String(value.transport || existing.transport) : existing.transport,
      enabled: ("enabled" in value) ? (value.enabled === false ? 0 : 1) : (existing.enabled ? 1 : 0),
      config: jsonText(nextConfig),
      updated_at: updatedAt,
    });
    return getAgent(id);
  }

  function removeAgent(id) {
    let existing = getAgent(id);
    if (!existing) {
      return undefined;
    }
    deleteById(conn, TABLES.agents, id);
    return existing;
  }

  function listAgentInstances() {
    return agentInstanceRowsToRecords(table(conn, TABLES.agentInstances).orderBy("updated_at desc").find());
  }

  function getAgentInstance(id) {
    let row = findById(conn, TABLES.agentInstances, id);
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
    table(conn, TABLES.agentInstances).insert({
      id: id,
      agent_id: agentId,
      name: String(value.name || agentId || id),
      status: String(value.status || "ready"),
      config: jsonText(value.config || {}),
      created_at: createdAt,
      updated_at: createdAt,
    });
    return getAgentInstance(id);
  }

  function updateAgentInstance(id, patch) {
    let existingRow = findById(conn, TABLES.agentInstances, id);
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
    table(conn, TABLES.agentInstances).where("id = ?", id).update({
      name: ("name" in value) ? String(value.name || existing.name) : existing.name,
      status: ("status" in value) ? String(value.status || existing.status) : existing.status,
      config: jsonText(config),
      updated_at: updatedAt,
    });
    return getAgentInstance(id);
  }

  function removeAgentInstance(id) {
    let existing = getAgentInstance(id);
    if (!existing) {
      return undefined;
    }
    deleteById(conn, TABLES.agentInstances, id);
    return existing;
  }

  function createIMChannel(input) {
    let value = input || {};
    let id = value.id || ("imch-" + crypto.randomUUID());
    let createdAt = now();
    table(conn, TABLES.imChannels).insert({
      id: id,
      platform: String(value.platform || ""),
      adapter: String(value.adapter || ""),
      name: String(value.name || id),
      status: String(value.status || "active"),
      config: jsonText(value.config || {}),
      created_at: createdAt,
      updated_at: createdAt,
    });
    return getIMChannel(id);
  }

  function listIMChannels(limit) {
    let n = Number(limit || 50);
    return imRowsToRecords(table(conn, TABLES.imChannels).orderBy("updated_at desc").limit(n).find());
  }

  function getIMChannel(id) {
    let row = findById(conn, TABLES.imChannels, id);
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
    table(conn, TABLES.imChannels).where("id = ?", id).update({
      platform: ("platform" in value) ? String(value.platform || "") : existing.platform,
      adapter: ("adapter" in value) ? String(value.adapter || "") : existing.adapter,
      name: ("name" in value) ? String(value.name || "") : existing.name,
      status: ("status" in value) ? String(value.status || "") : existing.status,
      config: jsonText(("config" in value) ? value.config : existing.config),
      updated_at: updatedAt,
    });
    return getIMChannel(id);
  }

  function removeIMChannel(id) {
    let existing = getIMChannel(id);
    if (!existing) {
      return undefined;
    }
    deleteById(conn, TABLES.imChannels, id);
    return existing;
  }

  function upsertIMConversation(input) {
    let value = input || {};
    let id = value.id || (String(value.channelId || value.channel_id || "") + ":" + String(value.chatId || value.chat_id || ""));
    let channelId = String(value.channelId || value.channel_id || "");
    let chatId = String(value.chatId || value.chat_id || "");
    let senderId = String(value.senderId || value.sender_id || "");
    let existing = findById(conn, TABLES.imConversations, id);
    let updatedAt = now();
    let lastAt = String(value.lastAt || value.last_at || updatedAt);
    if (existing) {
      table(conn, TABLES.imConversations).where("id = ?", id).update({
        channel_id: channelId,
        chat_id: chatId,
        sender_id: senderId,
        subject: String(value.subject || chatId || senderId),
        status: String(value.status || "active"),
        last_message_id: String(value.lastMessageId || value.last_message_id || ""),
        last_text: String(value.lastText || value.last_text || ""),
        last_event_id: String(value.lastEventId || value.last_event_id || ""),
        last_at: lastAt,
        meta: jsonText(value.meta || parseJSON(existing.meta, {})),
        updated_at: updatedAt,
      });
    } else {
      table(conn, TABLES.imConversations).insert({
        id: id,
        channel_id: channelId,
        chat_id: chatId,
        sender_id: senderId,
        subject: String(value.subject || chatId || senderId),
        status: String(value.status || "active"),
        last_message_id: String(value.lastMessageId || value.last_message_id || ""),
        last_text: String(value.lastText || value.last_text || ""),
        last_event_id: String(value.lastEventId || value.last_event_id || ""),
        last_at: lastAt,
        meta: jsonText(value.meta || {}),
        created_at: updatedAt,
        updated_at: updatedAt,
      });
    }
    return rowsToRecords([findById(conn, TABLES.imConversations, id)])[0];
  }

  function listIMConversations(channelId, limit) {
    let n = Number(limit || 50);
    if (channelId) {
      return rowsToRecords(table(conn, TABLES.imConversations).where("channel_id = ?", channelId).orderBy("last_at desc").limit(n).find());
    }
    return rowsToRecords(table(conn, TABLES.imConversations).orderBy("last_at desc").limit(n).find());
  }

  function getIMConversation(id) {
    let row = findById(conn, TABLES.imConversations, id);
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
    table(conn, TABLES.imReplies).where("conversation_id = ?", id).delete();
    deleteById(conn, TABLES.imConversations, id);
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

    let tasks = rowsToRecords(table(conn, TABLES.tasks).where("kind = ?", "agent.im").orderBy("created_at asc").find());
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
    table(conn, TABLES.imReplies).insert({
      id: id,
      conversation_id: String(value.conversationId || value.conversation_id || ""),
      task_id: String(value.taskId || value.task_id || ""),
      event_id: String(value.eventId || value.event_id || ""),
      channel_id: String(value.channelId || value.channel_id || ""),
      chat_id: String(value.chatId || value.chat_id || ""),
      sender_id: String(value.senderId || value.sender_id || ""),
      message_id: String(value.messageId || value.message_id || ""),
      text: String(value.text || ""),
      status: String(value.status || "pending"),
      payload: jsonText(value.payload || {}),
      created_at: createdAt,
      updated_at: createdAt,
    });
    return rowsToRecords([findById(conn, TABLES.imReplies, id)])[0];
  }

  function updateIMReply(id, patch) {
    let existingRow = findById(conn, TABLES.imReplies, id);
    if (!existingRow) {
      return undefined;
    }
    let existing = rowsToRecords([existingRow])[0];
    let value = patch || {};
    let updatedAt = now();
    table(conn, TABLES.imReplies).where("id = ?", id).update({
      conversation_id: ("conversationId" in value) ? String(value.conversationId || "") : existing.conversation_id,
      task_id: ("taskId" in value) ? String(value.taskId || "") : existing.task_id,
      event_id: ("eventId" in value) ? String(value.eventId || "") : existing.event_id,
      channel_id: ("channelId" in value) ? String(value.channelId || "") : existing.channel_id,
      chat_id: ("chatId" in value) ? String(value.chatId || "") : existing.chat_id,
      sender_id: ("senderId" in value) ? String(value.senderId || "") : existing.sender_id,
      message_id: ("messageId" in value) ? String(value.messageId || "") : existing.message_id,
      text: ("text" in value) ? String(value.text || "") : existing.text,
      status: ("status" in value) ? String(value.status || "") : existing.status,
      payload: jsonText(("payload" in value) ? value.payload : existing.payload),
      updated_at: updatedAt,
    });
    return rowsToRecords([findById(conn, TABLES.imReplies, id)])[0];
  }

  function listIMReplies(status, limit) {
    let n = Number(limit || 50);
    if (status) {
      return rowsToRecords(table(conn, TABLES.imReplies).where("status = ?", status).orderBy("created_at asc").limit(n).find());
    }
    return rowsToRecords(table(conn, TABLES.imReplies).orderBy("created_at desc").limit(n).find());
  }

  function getIMReply(id) {
    let row = findById(conn, TABLES.imReplies, id);
    if (!row) {
      return undefined;
    }
    return rowsToRecords([row])[0];
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
    listIMReplies: listIMReplies,
    getIMReply: getIMReply,
  };
}

// 网关启动时，如果数据库中没有任何 provider/agent，且配置启用了默认 agent，
// 则自动从环境变量读取 API key 并创建默认 provider + agent。
export function ensureDefaultAgent(store, config) {
  let defaultAgent = config.gateway.defaultAgent;
  if (!defaultAgent || defaultAgent.enabled === false) {
    return;
  }

  let apiKeyEnv = defaultAgent.apiKeyEnv || "GS_AGENT_API_KEY";
  let apiKey = String(process.env[apiKeyEnv] || "");
  if (!apiKey && defaultAgent.apiKey) {
    apiKey = String(defaultAgent.apiKey);
  }
  if (!apiKey) {
    console.warn("[gateway] default agent is enabled but api key is empty; set env " + apiKeyEnv);
    return;
  }

  let providers = store.listProviders();
  let providerId = "provider-default";
  if (providers.length === 0) {
    let provider = store.createProvider({
      id: providerId,
      name: "Default Provider",
      type: defaultAgent.modelProvider || "anthropic",
      enabled: true,
      baseUrl: defaultAgent.baseUrl || "",
      defaultModel: defaultAgent.modelName || "",
      apiKey: apiKey,
    });
    providerId = provider.id;
  } else {
    providerId = providers[0].id;
  }

  let agents = store.listAgents();
  if (agents.length === 0) {
    store.createAgent({
      id: "agent-default",
      name: defaultAgent.name || "Default Agent",
      providerId: providerId,
      modelProvider: defaultAgent.modelProvider || "anthropic",
      modelName: defaultAgent.modelName || "",
      transport: "websocket",
      enabled: true,
      baseUrl: defaultAgent.baseUrl || "",
      systemPrompt: defaultAgent.systemPrompt || "",
      maxIterations: defaultAgent.maxIterations || 10,
      toolWhitelist: defaultAgent.toolWhitelist || [],
      skillIds: defaultAgent.skillIds || [],
    });
  }
}
