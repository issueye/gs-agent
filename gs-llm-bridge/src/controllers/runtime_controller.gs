import { ok } from "@/views/response";

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

function sanitizeProvider(provider) {
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

function sanitizePlan(plan) {
  let out = JSON.parse(JSON.stringify(plan || {}));
  let candidates = out.candidates || [];
  for (let i = 0; i < candidates.length; i = i + 1) {
    if (candidates[i].provider) {
      candidates[i].provider = sanitizeProvider(candidates[i].provider);
    }
  }
  out.candidates = candidates;
  return out;
}

export function createRuntimeController(model) {
  function queryValue(req, snake, camel, fallback) {
    let query = (req || {}).query || {};
    return query[snake] || query[camel] || fallback || "";
  }

  function state(req, res) {
    return ok(res, {
      service: "gs-llm-bridge",
      started_at: model.startedAt,
      config: {
        host: model.config.host,
        port: model.config.port,
        data_dir: model.config.dataDir,
        store_path: model.config.storePath,
        allow_local_without_auth: model.config.allowLocalWithoutAuth,
        default_max_tokens: model.config.defaultMaxTokens,
      },
      counts: {
        providers: model.store.listProviders().length,
        routing_rules: model.store.listRoutingRules().length,
        api_keys: model.store.listAPIKeys().length,
        traffic: model.store.listTraffic(2000).length,
      },
    });
  }

  function routePlan(req, res) {
    let protocol = queryValue(req, "protocol", "downstreamProtocol", "");
    if (protocol === "") {
      protocol = queryValue(req, "downstream_protocol", "downstreamProtocol", "openai_chat");
    }
    let requestedModel = queryValue(req, "model", "requestedModel", "");
    if (requestedModel === "") {
      requestedModel = queryValue(req, "requested_model", "requestedModel", "");
    }
    let plan = model.resolver.plan(String(protocol || "openai_chat"), String(requestedModel || ""));
    return ok(res, sanitizePlan(plan));
  }

  return {
    state: state,
    routePlan: routePlan,
  };
}
