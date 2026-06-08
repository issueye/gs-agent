let http = require("@std/net/http/client");

let base = "http://127.0.0.1:18878";
let suffix = String((new Date()).getTime());
let providerId = "provider-smoke-" + suffix;
let agentId = "agent-smoke-" + suffix;

function parse(text) {
  return JSON.parse(String(text || "{}"));
}

function request(method, path, body) {
  let headers = {
    headers: {
      "Content-Type": "application/json",
    },
  };
  let res;
  if (method === "POST") {
    res = http.post(base + path, body || {}, headers);
  } else {
    let options = {
      url: base + path,
      method: method,
      headers: headers.headers,
    };
    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }
    res = http.request(options);
  }
  let payload = parse(res.body);
  if (!payload.ok) {
    throw new Error(method + " " + path + " failed: " + JSON.stringify(payload.error || payload));
  }
  return payload.data;
}

let provider = request("POST", "/api/providers", {
  id: providerId,
  name: "Smoke Provider",
  type: "openai",
  baseUrl: "https://api.example.test/v1",
  defaultModel: "smoke-model",
  apiKey: "sk-smoke-test",
  enabled: true,
});
if (provider.id !== providerId || !provider.apiKeySet) {
  throw new Error("provider create mismatch");
}

let agent = request("POST", "/api/agents", {
  id: agentId,
  name: "Smoke Agent",
  providerId: providerId,
  modelProvider: "openai",
  modelName: "smoke-model",
  transport: "websocket",
  enabled: true,
});
if (agent.id !== agentId || agent.providerId !== providerId) {
  throw new Error("agent create mismatch");
}

let instance = request("POST", "/api/agent-instances", {
  agentId: agentId,
  name: "Smoke Instance",
});
if (instance.agentId !== agentId || instance.status !== "ready") {
  throw new Error("instance start mismatch");
}

let stopped = request("PATCH", "/api/agent-instances/" + encodeURIComponent(instance.id) + "/stop");
if (stopped.status !== "stopped") {
  throw new Error("instance stop mismatch");
}

request("DELETE", "/api/agent-instances/" + encodeURIComponent(instance.id));
request("DELETE", "/api/agents/" + encodeURIComponent(agentId));
request("DELETE", "/api/providers/" + encodeURIComponent(providerId));

println("management smoke ok");
