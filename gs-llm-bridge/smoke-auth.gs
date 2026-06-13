let http = require("@std/net/http/client");
let process = require("@std/process");

let port = Number(process.getenv("GS_LLM_BRIDGE_SMOKE_PORT") || 18182);
let base = "http://127.0.0.1:" + String(port);
let suffix = String((new Date()).getTime());
let adminKeyId = "smoke-auth-admin-" + suffix;
let proxyKeyId = "smoke-auth-proxy-" + suffix;
let starKeyId = "smoke-auth-star-" + suffix;
let adminSecret = "sk-smoke-admin-" + suffix;
let proxySecret = "sk-smoke-proxy-" + suffix;
let starSecret = "sk-smoke-star-" + suffix;

function parse(text, context) {
  try {
    return JSON.parse(String(text || "{}"));
  } catch (err) {
    throw new Error(String(context || "parse") + " returned non-json body: " + String(text || ""));
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function request(method, path, body, headers) {
  let merged = {
    "Content-Type": "application/json",
  };
  for (let key in headers || {}) {
    merged[key] = headers[key];
  }
  let options = {
    url: base + path,
    method: method,
    headers: merged,
  };
  if (body !== undefined) {
    options.body = body;
  }
  return http.request(options);
}

function jsonOK(method, path, body, headers) {
  let res = request(method, path, body, headers);
  let status = Number(res.status || 200);
  let payload = parse(res.body, method + " " + path);
  if (status < 200 || status >= 300 || payload.error) {
    throw new Error(method + " " + path + " failed: status=" + String(status) + " body=" + String(res.body || ""));
  }
  return payload;
}

function data(method, path, body, headers) {
  return jsonOK(method, path, body, headers).data;
}

function adminHeaders(secret) {
  return {
    "x-api-key": secret,
  };
}

function bearer(secret) {
  return {
    Authorization: "Bearer " + secret,
  };
}

function deleteIfExists(path, headers) {
  let res = request("DELETE", path, undefined, headers);
  let status = Number(res.status || 200);
  if (status !== 200 && status !== 404 && status !== 401) {
    throw new Error("DELETE " + path + " failed: status=" + String(status) + " body=" + String(res.body || ""));
  }
}

println("auth smoke target: " + base);

let runtimeNoAuth = request("GET", "/api/v1/runtime/state");
assert(Number(runtimeNoAuth.status || 0) === 401, "admin runtime without key should be 401 when local auth is disabled");

let proxyNoAuth = request("POST", "/v1/chat/completions", {
  model: "missing",
  messages: [{
    role: "user",
    content: "hello",
  }],
});
assert(Number(proxyNoAuth.status || 0) === 401, "proxy without key should be 401 when local auth is disabled");

data("POST", "/api/v1/api-keys", {
  id: adminKeyId,
  name: "Smoke Auth Admin",
  secret: adminSecret,
  scopes: "admin",
  enabled: true,
}, adminHeaders("local-admin"));

data("POST", "/api/v1/api-keys", {
  id: proxyKeyId,
  name: "Smoke Auth Proxy",
  secret: proxySecret,
  scopes: "proxy",
  enabled: true,
}, adminHeaders(adminSecret));

data("POST", "/api/v1/api-keys", {
  id: starKeyId,
  name: "Smoke Auth Star",
  secret: starSecret,
  scopes: "*",
  enabled: true,
}, bearer(adminSecret));

let adminWithBearer = jsonOK("GET", "/api/v1/runtime/state", undefined, bearer(adminSecret));
assert(adminWithBearer.data.service === "gs-llm-bridge", "admin bearer key should work");

let adminWithProxyScope = request("GET", "/api/v1/runtime/state", undefined, adminHeaders(proxySecret));
assert(Number(adminWithProxyScope.status || 0) === 401, "proxy scoped key should not pass admin auth");

let adminWithStar = jsonOK("GET", "/api/v1/runtime/state", undefined, adminHeaders(starSecret));
assert(adminWithStar.data.service === "gs-llm-bridge", "star scoped key should pass admin auth");

let proxyWithAdminScope = request("POST", "/v1/chat/completions", {
  model: "missing",
  messages: [{
    role: "user",
    content: "hello",
  }],
}, bearer(adminSecret));
assert(Number(proxyWithAdminScope.status || 0) === 401, "admin scoped key should not pass proxy auth");

let proxyWithProxyScope = request("POST", "/v1/chat/completions", {
  model: "missing",
  messages: [{
    role: "user",
    content: "hello",
  }],
}, bearer(proxySecret));
assert(Number(proxyWithProxyScope.status || 0) === 400, "proxy scoped key should pass auth and reach route resolution");

let proxyWithStar = request("POST", "/v1/chat/completions", {
  model: "missing",
  messages: [{
    role: "user",
    content: "hello",
  }],
}, adminHeaders(starSecret));
assert(Number(proxyWithStar.status || 0) === 400, "star scoped key should pass proxy auth and reach route resolution");

deleteIfExists("/api/v1/api-keys/" + encodeURIComponent(proxyKeyId), adminHeaders(adminSecret));
deleteIfExists("/api/v1/api-keys/" + encodeURIComponent(starKeyId), adminHeaders(adminSecret));
deleteIfExists("/api/v1/api-keys/" + encodeURIComponent(adminKeyId), adminHeaders("local-admin"));

println("auth smoke ok");
