let http = require("@std/net/http/client");
let process = require("@std/process");

let port = Number(process.getenv("GS_LLM_BRIDGE_SMOKE_PORT") || 18182);
let base = "http://127.0.0.1:" + String(port);
let suffix = String((new Date()).getTime());
let providerId = "smoke-provider-" + suffix;
let modelId = "smoke-model-" + suffix;
let ruleId = "smoke-rule-" + suffix;
let apiKeyId = "smoke-key-" + suffix;

function parse(text) {
  return JSON.parse(String(text || "{}"));
}

function request(method, path, body) {
  let options = {
    url: base + path,
    method: method,
    headers: {
      "Content-Type": "application/json",
    },
  };
  if (body !== undefined) {
    options.body = body;
  }
  let res = http.request(options);
  let status = Number(res.status || 200);
  let payload = parse(res.body);
  if (status < 200 || status >= 300 || payload.error) {
    throw new Error(method + " " + path + " failed: status=" + String(status) + " body=" + String(res.body || ""));
  }
  return payload;
}

function data(method, path, body) {
  return request(method, path, body).data;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function deleteIfExists(path) {
  let res = http.request({
    url: base + path,
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });
  let status = Number(res.status || 200);
  if (status !== 200 && status !== 404) {
    throw new Error("DELETE " + path + " failed: status=" + String(status) + " body=" + String(res.body || ""));
  }
}

println("smoke target: " + base);

let health = request("GET", "/healthz");
assert(health.service === "gs-llm-bridge", "health service mismatch");
assert(health.status === "ok", "health status mismatch");

let initialRuntime = data("GET", "/api/v1/runtime/state");
assert(initialRuntime.service === "gs-llm-bridge", "runtime service mismatch");
assert(initialRuntime.config.port === port, "runtime port mismatch");

let provider = data("POST", "/api/v1/providers", {
  id: providerId,
  name: "Smoke Provider",
  protocol: "openai_chat",
  vendor: "openai",
  base_url: "https://api.example.test/v1",
  api_key: "sk-smoke-provider",
  enabled: true,
});
assert(provider.id === providerId, "provider id mismatch");
assert(provider.api_key_set === true, "provider api key should be masked");

let providers = data("GET", "/api/v1/providers");
assert(providers.total >= 1, "provider list should not be empty");

let model = data("POST", "/api/v1/providers/" + encodeURIComponent(providerId) + "/models", {
  id: modelId,
  name: "gpt-smoke",
  max_tokens: 4096,
  enabled: true,
});
assert(model.id === modelId, "model id mismatch");
assert(model.provider_id === providerId, "model provider mismatch");

let models = data("GET", "/api/v1/providers/" + encodeURIComponent(providerId) + "/models");
assert(models.total >= 1, "model list should not be empty");

let rule = data("POST", "/api/v1/routing-rules", {
  id: ruleId,
  name: "Smoke Rule",
  priority: 10,
  match_protocol: "openai_chat",
  match_model_pattern: "smoke-*",
  upstream_protocol: "openai_chat",
  target_provider_id: providerId,
  target_model: "gpt-smoke",
  enabled: true,
});
assert(rule.id === ruleId, "routing rule id mismatch");
assert(rule.target_provider_id === providerId, "routing rule provider mismatch");

let rules = data("GET", "/api/v1/routing-rules");
assert(rules.total >= 1, "routing rule list should not be empty");

let apiKey = data("POST", "/api/v1/api-keys", {
  id: apiKeyId,
  name: "Smoke API Key",
  secret: "sk-smoke-admin",
  scopes: "admin,proxy",
  enabled: true,
});
assert(apiKey.id === apiKeyId, "api key id mismatch");
assert(apiKey.can_reveal === true, "api key should be revealable");

let apiKeys = data("GET", "/api/v1/api-keys");
assert(apiKeys.total >= 1, "api key list should not be empty");

let secret = data("GET", "/api/v1/api-keys/" + encodeURIComponent(apiKeyId) + "/secret");
assert(secret.secret === "sk-smoke-admin", "api key secret mismatch");

let proxyFailure = http.request({
  url: base + "/v1/chat/completions",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: {
    model: "smoke-request",
    messages: [
      {
        role: "user",
        content: "smoke",
      },
    ],
  },
});
assert(Number(proxyFailure.status || 0) === 502, "proxy failure should record traffic with status 502");

let traffic = data("GET", "/api/v1/traffic?limit=5");
assert(traffic.total >= 1, "traffic list should include the proxy attempt");

data("DELETE", "/api/v1/traffic");
let clearedTraffic = data("GET", "/api/v1/traffic?limit=5");
assert(clearedTraffic.total === 0, "traffic should be cleared");

deleteIfExists("/api/v1/api-keys/" + encodeURIComponent(apiKeyId));
deleteIfExists("/api/v1/routing-rules/" + encodeURIComponent(ruleId));
deleteIfExists("/api/v1/providers/" + encodeURIComponent(providerId) + "/models/" + encodeURIComponent(modelId));
deleteIfExists("/api/v1/providers/" + encodeURIComponent(providerId));

let finalRuntime = data("GET", "/api/v1/runtime/state");
assert(finalRuntime.counts.providers >= 0, "final runtime counts missing");

println("management smoke ok");
