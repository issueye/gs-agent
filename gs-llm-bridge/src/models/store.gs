let fs = require("@std/fs");
let path = require("@std/path");
let crypto = require("@std/crypto");
import { normalizeProtocol } from "@/services/protocols";

function now() {
  return (new Date()).toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function newID(prefix) {
  return prefix + "-" + crypto.randomUUID();
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

function defaultState(config) {
  let createdAt = now();
  return {
    providers: [],
    providerModels: [],
    endpoints: [
      {
        id: "anthropic-messages",
        path: "/v1/messages",
        downstream_protocol: "anthropic",
        enabled: true,
        protected: true,
        description: "Anthropic Messages compatible endpoint",
        created_at: createdAt,
        updated_at: createdAt,
      },
      {
        id: "openai-chat-completions",
        path: "/v1/chat/completions",
        downstream_protocol: "openai_chat",
        enabled: true,
        protected: true,
        description: "OpenAI Chat Completions compatible endpoint",
        created_at: createdAt,
        updated_at: createdAt,
      },
      {
        id: "openai-responses",
        path: "/v1/responses",
        downstream_protocol: "openai_responses",
        enabled: true,
        protected: true,
        description: "OpenAI Responses compatible endpoint",
        created_at: createdAt,
        updated_at: createdAt,
      },
    ],
    routingRules: [],
    apiKeys: [
      {
        id: "local-admin",
        name: "Local Admin",
        secret: "local-admin",
        scopes: "admin,proxy",
        enabled: true,
        created_at: createdAt,
        updated_at: createdAt,
      },
    ],
    traffic: [],
  };
}

function readState(file, config) {
  if (!fs.existsSync(file)) {
    return defaultState(config);
  }
  try {
    let parsed = JSON.parse(fs.readTextSync(file));
    let base = defaultState(config);
    for (let key in base) {
      if (!(key in parsed)) {
        parsed[key] = base[key];
      }
    }
    return parsed;
  } catch (err) {
    return defaultState(config);
  }
}

function sortByUpdated(items) {
  let copyItems = clone(items || []);
  copyItems.sort(function(a, b) {
    return String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""));
  });
  return copyItems;
}

function withoutSecret(provider) {
  let item = provider || {};
  return {
    id: item.id,
    name: item.name,
    protocol: item.protocol,
    vendor: item.vendor,
    base_url: item.base_url,
    api_key_set: String(item.api_key || "") !== "",
    api_key_preview: maskSecret(item.api_key || ""),
    only_stream: item.only_stream === true,
    user_agent: item.user_agent,
    enabled: item.enabled !== false,
    description: item.description || "",
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

function apiKeyView(key) {
  return {
    id: key.id,
    name: key.name,
    secret_preview: maskSecret(key.secret),
    can_reveal: true,
    scopes: key.scopes || "",
    enabled: key.enabled !== false,
    created_at: key.created_at,
    updated_at: key.updated_at,
  };
}

function upsertByID(items, id, build) {
  let index = -1;
  for (let i = 0; i < items.length; i = i + 1) {
    if (items[i].id === id) {
      if (index < 0) {
        index = i;
      } else {
        items.splice(i, 1);
        i = i - 1;
      }
    }
  }
  let existing = index >= 0 ? items[index] : {};
  let next = build(existing);
  if (index >= 0) {
    items[index] = next;
  } else {
    items.push(next);
  }
  return next;
}

function upsertProviderModel(items, providerID, id, build) {
  let index = -1;
  for (let i = 0; i < items.length; i = i + 1) {
    if (items[i].provider_id === providerID && items[i].id === id) {
      if (index < 0) {
        index = i;
      } else {
        items.splice(i, 1);
        i = i - 1;
      }
    }
  }
  let existing = index >= 0 ? items[index] : {};
  let next = build(existing);
  if (index >= 0) {
    items[index] = next;
  } else {
    items.push(next);
  }
  return next;
}

function removeByID(items, id) {
  for (let i = 0; i < items.length; i = i + 1) {
    if (items[i].id === id) {
      let item = items[i];
      items.splice(i, 1);
      return item;
    }
  }
  return undefined;
}

function normalizeEndpointPath(value) {
  let text = String(value || "").trim();
  let queryIndex = text.indexOf("?");
  if (queryIndex >= 0) {
    text = text.slice(0, queryIndex);
  }
  if (text === "") {
    return "";
  }
  if (!text.startsWith("/")) {
    text = "/" + text;
  }
  while (text.length > 1 && text.endsWith("/")) {
    text = text.slice(0, text.length - 1);
  }
  return text;
}

export function openBridgeStore(file, config) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let state = readState(file, config);

  function save() {
    fs.writeFileAtomicSync(file, JSON.stringify(state, null, 2));
  }

  function listProviders() {
    return sortByUpdated(state.providers).map(withoutSecret);
  }

  function listProviderSecrets() {
    return clone(state.providers || []);
  }

  function getProvider(id) {
    for (let item of state.providers) {
      if (item.id === id || item.name === id) {
        return withoutSecret(item);
      }
    }
    return undefined;
  }

  function getProviderSecret(id) {
    for (let item of state.providers) {
      if (item.id === id || item.name === id) {
        return clone(item);
      }
    }
    return undefined;
  }

  function saveProvider(input) {
    let body = input || {};
    let id = String(body.id || body.provider_id || body.providerId || body.providerID || ("provider-" + slug(body.name || body.vendor || "provider", "provider")));
    let timestamp = now();
    let item = upsertByID(state.providers, id, function(existing) {
      let apiKey = existing.api_key || "";
      if ("api_key" in body && String(body.api_key || "") !== "") {
        apiKey = String(body.api_key || "");
      }
      if ("apiKey" in body && String(body.apiKey || "") !== "") {
        apiKey = String(body.apiKey || "");
      }
      return {
        id: id,
        name: String(body.name || existing.name || id),
        protocol: normalizeProtocol(body.protocol || existing.protocol || "openai_chat"),
        vendor: String(body.vendor || existing.vendor || "openai"),
        base_url: String(body.base_url || body.baseUrl || existing.base_url || ""),
        api_key: apiKey,
        only_stream: body.only_stream === true || body.onlyStream === true,
        user_agent: String(body.user_agent || body.userAgent || existing.user_agent || "gs-llm-bridge/0.1.0"),
        enabled: body.enabled === false ? false : (existing.enabled === false ? false : true),
        description: String(body.description || existing.description || ""),
        created_at: existing.created_at || timestamp,
        updated_at: timestamp,
      };
    });
    save();
    return withoutSecret(item);
  }

  function deleteProvider(id) {
    let item = removeByID(state.providers, id);
    if (item) {
      state.providerModels = state.providerModels.filter(function(model) {
        return model.provider_id !== id;
      });
      save();
      return withoutSecret(item);
    }
    return undefined;
  }

  function listProviderModels(providerID) {
    let provider = getProviderSecret(providerID);
    if (provider) {
      providerID = provider.id;
    }
    let out = [];
    for (let item of state.providerModels) {
      if (item.provider_id === providerID) {
        out.push(clone(item));
      }
    }
    return sortByUpdated(out);
  }

  function saveProviderModel(providerID, input) {
    let provider = getProviderSecret(providerID);
    if (!provider) {
      return undefined;
    }
    providerID = provider.id;
    let body = input || {};
    let id = String(body.id || body.model_id || body.modelId || body.modelID || ("model-" + slug(body.name || "model", "model")));
    let timestamp = now();
    let item = upsertProviderModel(state.providerModels, providerID, id, function(existing) {
      return {
        id: id,
        provider_id: providerID,
        name: String(body.name || existing.name || id),
        max_tokens: Number(body.max_tokens || body.maxTokens || existing.max_tokens || config.defaultMaxTokens),
        enabled: body.enabled === false ? false : (existing.enabled === false ? false : true),
        created_at: existing.created_at || timestamp,
        updated_at: timestamp,
      };
    });
    save();
    return clone(item);
  }

  function deleteProviderModel(providerID, id) {
    let provider = getProviderSecret(providerID);
    if (provider) {
      providerID = provider.id;
    }
    for (let i = 0; i < state.providerModels.length; i = i + 1) {
      let item = state.providerModels[i];
      if (item.provider_id === providerID && item.id === id) {
        state.providerModels.splice(i, 1);
        save();
        return clone(item);
      }
    }
    return undefined;
  }

  function listEndpoints() {
    return sortByUpdated(state.endpoints);
  }

  function findEnabledEndpointByPath(endpointPath) {
    let expected = normalizeEndpointPath(endpointPath);
    for (let item of state.endpoints || []) {
      if (item.enabled === false) {
        continue;
      }
      if (normalizeEndpointPath(item.path) === expected) {
        return clone(item);
      }
    }
    return undefined;
  }

  function saveEndpoint(input) {
    let body = input || {};
    let id = String(body.id || ("endpoint-" + slug(body.path || "endpoint", "endpoint")));
    let timestamp = now();
    let item = upsertByID(state.endpoints, id, function(existing) {
      return {
        id: id,
        path: normalizeEndpointPath(body.path || existing.path || ""),
        downstream_protocol: normalizeProtocol(body.downstream_protocol || body.downstreamProtocol || existing.downstream_protocol || "openai_chat"),
        enabled: body.enabled === false ? false : (existing.enabled === false ? false : true),
        protected: body.protected === false ? false : (existing.protected === false ? false : true),
        description: String(body.description || existing.description || ""),
        created_at: existing.created_at || timestamp,
        updated_at: timestamp,
      };
    });
    save();
    return clone(item);
  }

  function deleteEndpoint(id) {
    let item = removeByID(state.endpoints, id);
    if (item) {
      save();
      return clone(item);
    }
    return undefined;
  }

  function listRoutingRules() {
    return sortByUpdated(state.routingRules);
  }

  function listEnabledRoutingRules() {
    let out = [];
    for (let item of state.routingRules) {
      if (item.enabled !== false) {
        out.push(clone(item));
      }
    }
    out.sort(function(a, b) {
      return Number(a.priority || 0) - Number(b.priority || 0);
    });
    return out;
  }

  function saveRoutingRule(input) {
    let body = input || {};
    let id = String(body.id || ("rule-" + slug(body.name || "route", "route")));
    let timestamp = now();
    let item = upsertByID(state.routingRules, id, function(existing) {
      return {
        id: id,
        name: String(body.name || existing.name || id),
        priority: Number(body.priority || existing.priority || 100),
        match_protocol: normalizeProtocol(body.match_protocol || body.matchProtocol || existing.match_protocol || ""),
        match_model_pattern: String(body.match_model_pattern || body.matchModelPattern || existing.match_model_pattern || "*"),
        upstream_protocol: normalizeProtocol(body.upstream_protocol || body.upstreamProtocol || existing.upstream_protocol || ""),
        target_provider_id: String(body.target_provider_id || body.targetProviderId || body.targetProviderID || existing.target_provider_id || ""),
        target_model: String(body.target_model || body.targetModel || existing.target_model || ""),
        enabled: body.enabled === false ? false : (existing.enabled === false ? false : true),
        created_at: existing.created_at || timestamp,
        updated_at: timestamp,
      };
    });
    save();
    return clone(item);
  }

  function deleteRoutingRule(id) {
    let item = removeByID(state.routingRules, id);
    if (item) {
      save();
      return clone(item);
    }
    return undefined;
  }

  function listAPIKeys() {
    return sortByUpdated(state.apiKeys).map(apiKeyView);
  }

  function getAPIKeySecret(id) {
    for (let item of state.apiKeys) {
      if (item.id === id) {
        return { secret: item.secret || "" };
      }
    }
    return undefined;
  }

  function createAPIKey(input) {
    let body = input || {};
    let id = String(body.id || ("key-" + slug(body.name || "api-key", "api-key")));
    let timestamp = now();
    let item = upsertByID(state.apiKeys, id, function(existing) {
      let secret = String(body.secret || existing.secret || crypto.randomUUID());
      return {
        id: id,
        name: String(body.name || existing.name || id),
        secret: secret,
        scopes: String(body.scopes || existing.scopes || "proxy"),
        enabled: body.enabled === false ? false : (existing.enabled === false ? false : true),
        created_at: existing.created_at || timestamp,
        updated_at: timestamp,
      };
    });
    save();
    return apiKeyView(item);
  }

  function deleteAPIKey(id) {
    let item = removeByID(state.apiKeys, id);
    if (item) {
      save();
      return apiKeyView(item);
    }
    return undefined;
  }

  function verifyAPIKey(secret, scope) {
    let expectedScope = String(scope || "");
    for (let item of state.apiKeys) {
      if (item.enabled === false || String(item.secret || "") !== String(secret || "")) {
        continue;
      }
      let scopes = String(item.scopes || "").split(",");
      for (let scopeText of scopes) {
        let trimmed = String(scopeText || "").trim();
        if (trimmed === "*" || trimmed === expectedScope) {
          return true;
        }
      }
    }
    return false;
  }

  function recordTraffic(input) {
    let item = clone(input || {});
    if (!item.id) {
      item.id = newID("req");
    }
    item.created_at = item.created_at || now();
    state.traffic.unshift(item);
    if (state.traffic.length > 2000) {
      state.traffic = state.traffic.slice(0, 2000);
    }
    save();
    return clone(item);
  }

  function listTraffic(limit) {
    let n = Number(limit || 500);
    if (n <= 0) {
      n = 500;
    }
    return clone((state.traffic || []).slice(0, n));
  }

  function clearTraffic() {
    state.traffic = [];
    save();
  }

  return {
    listProviders: listProviders,
    listProviderSecrets: listProviderSecrets,
    getProvider: getProvider,
    getProviderSecret: getProviderSecret,
    saveProvider: saveProvider,
    deleteProvider: deleteProvider,
    listProviderModels: listProviderModels,
    saveProviderModel: saveProviderModel,
    deleteProviderModel: deleteProviderModel,
    listEndpoints: listEndpoints,
    findEnabledEndpointByPath: findEnabledEndpointByPath,
    saveEndpoint: saveEndpoint,
    deleteEndpoint: deleteEndpoint,
    listRoutingRules: listRoutingRules,
    listEnabledRoutingRules: listEnabledRoutingRules,
    saveRoutingRule: saveRoutingRule,
    deleteRoutingRule: deleteRoutingRule,
    listAPIKeys: listAPIKeys,
    getAPIKeySecret: getAPIKeySecret,
    createAPIKey: createAPIKey,
    deleteAPIKey: deleteAPIKey,
    verifyAPIKey: verifyAPIKey,
    recordTraffic: recordTraffic,
    listTraffic: listTraffic,
    clearTraffic: clearTraffic,
  };
}
