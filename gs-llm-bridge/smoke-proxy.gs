let http = require("@std/net/http/client");
let process = require("@std/process");
let web = require("@std/web");

let bridgePort = Number(process.getenv("GS_LLM_BRIDGE_SMOKE_PORT") || 18182);
let bridgeBase = "http://127.0.0.1:" + String(bridgePort);
let suffix = String((new Date()).getTime());
let proxySecret = "sk-smoke-proxy-" + suffix;

let openAIProviderId = "smoke-proxy-openai-provider-" + suffix;
let openAIModelId = "smoke-proxy-openai-model-" + suffix;
let openAITargetModel = "smoke-target-openai-" + suffix;
let openAIRuleId = "smoke-proxy-openai-rule-" + suffix;
let openAIRequestModel = "smoke-proxy-openai-request-" + suffix;

let anthropicProviderId = "smoke-proxy-anthropic-provider-" + suffix;
let anthropicModelId = "smoke-proxy-anthropic-model-" + suffix;
let anthropicTargetModel = "smoke-target-anthropic-" + suffix;
let anthropicRuleId = "smoke-proxy-anthropic-rule-" + suffix;
let anthropicRequestModel = "smoke-proxy-anthropic-request-" + suffix;
let apiKeyId = "smoke-proxy-key-" + suffix;

let mockRequests = [];
let app = web.createApp();
app.use(web.json());

function parse(text) {
  return JSON.parse(String(text || "{}"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function jsonRequest(method, path, body, extraHeaders) {
  let headers = {
    "Content-Type": "application/json",
  };
  for (let key in extraHeaders || {}) {
    headers[key] = extraHeaders[key];
  }
  let options = {
    url: bridgeBase + path,
    method: method,
    headers: headers,
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
  return jsonRequest(method, path, body).data;
}

function proxyChat(body) {
  return jsonRequest("POST", "/v1/chat/completions", body, {
    Authorization: "Bearer " + proxySecret,
  });
}

function deleteIfExists(path) {
  let res = http.request({
    url: bridgeBase + path,
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

function latestTrafficFor(model) {
  let traffic = data("GET", "/api/v1/traffic?limit=50");
  for (let item of traffic.items || []) {
    if (item.requested_model === model) {
      return item;
    }
  }
  return undefined;
}

function recordMock(path, body, headers) {
  mockRequests.push({
    path: path,
    body: body || {},
    headers: headers || {},
  });
}

app.post("/v1/chat/completions", function(req, res) {
  let body = req.body || {};
  recordMock(req.url, body, req.headers || {});
  if (body.model !== openAITargetModel) {
    return res.status(400).json({
      error: {
        message: "expected OpenAI target model " + openAITargetModel,
      },
    });
  }
  return res.json({
    id: "chatcmpl-smoke-openai-" + suffix,
    object: "chat.completion",
    created: 1710000000,
    model: body.model,
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: "openai upstream ok",
      },
      finish_reason: "stop",
    }],
    usage: {
      prompt_tokens: 11,
      completion_tokens: 7,
      total_tokens: 18,
    },
  });
});

app.post("/v1/messages", function(req, res) {
  let body = req.body || {};
  recordMock(req.url, body, req.headers || {});
  if (body.model !== anthropicTargetModel) {
    return res.status(400).json({
      type: "error",
      error: {
        type: "invalid_request_error",
        message: "expected Anthropic target model " + anthropicTargetModel,
      },
    });
  }
  return res.json({
    id: "msg-smoke-anthropic-" + suffix,
    type: "message",
    role: "assistant",
    model: body.model,
    content: [{
      type: "text",
      text: "anthropic upstream ok",
    }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: 13,
      output_tokens: 5,
    },
  });
});

let mockServer = app.listen(0);
let mockBase = "http://127.0.0.1:" + String(mockServer.port);

function cleanup() {
  deleteIfExists("/api/v1/api-keys/" + encodeURIComponent(apiKeyId));
  deleteIfExists("/api/v1/routing-rules/" + encodeURIComponent(openAIRuleId));
  deleteIfExists("/api/v1/routing-rules/" + encodeURIComponent(anthropicRuleId));
  deleteIfExists("/api/v1/providers/" + encodeURIComponent(openAIProviderId) + "/models/" + encodeURIComponent(openAIModelId));
  deleteIfExists("/api/v1/providers/" + encodeURIComponent(anthropicProviderId) + "/models/" + encodeURIComponent(anthropicModelId));
  deleteIfExists("/api/v1/providers/" + encodeURIComponent(openAIProviderId));
  deleteIfExists("/api/v1/providers/" + encodeURIComponent(anthropicProviderId));
}

try {
  println("bridge target: " + bridgeBase);
  println("mock upstream: " + mockBase);

  let health = jsonRequest("GET", "/healthz");
  assert(health.service === "gs-llm-bridge", "health service mismatch");
  assert(health.status === "ok", "health status mismatch");

  data("POST", "/api/v1/api-keys", {
    id: apiKeyId,
    name: "Smoke Proxy API Key",
    secret: proxySecret,
    scopes: "proxy",
    enabled: true,
  });

  data("POST", "/api/v1/providers", {
    id: openAIProviderId,
    name: "Smoke Proxy OpenAI Provider",
    protocol: "openai_chat",
    vendor: "openai",
    base_url: mockBase,
    api_key: "sk-mock-openai",
    enabled: true,
  });
  data("POST", "/api/v1/providers/" + encodeURIComponent(openAIProviderId) + "/models", {
    id: openAIModelId,
    name: openAITargetModel,
    max_tokens: 4096,
    enabled: true,
  });
  data("POST", "/api/v1/routing-rules", {
    id: openAIRuleId,
    name: "Smoke Proxy OpenAI Rule",
    priority: 1,
    match_protocol: "openai_chat",
    match_model_pattern: openAIRequestModel,
    upstream_protocol: "openai_chat",
    target_provider_id: openAIProviderId,
    target_model: openAITargetModel,
    enabled: true,
  });

  data("POST", "/api/v1/providers", {
    id: anthropicProviderId,
    name: "Smoke Proxy Anthropic Provider",
    protocol: "anthropic",
    vendor: "anthropic",
    base_url: mockBase,
    api_key: "sk-mock-anthropic",
    enabled: true,
  });
  data("POST", "/api/v1/providers/" + encodeURIComponent(anthropicProviderId) + "/models", {
    id: anthropicModelId,
    name: anthropicTargetModel,
    max_tokens: 4096,
    enabled: true,
  });
  data("POST", "/api/v1/routing-rules", {
    id: anthropicRuleId,
    name: "Smoke Proxy Anthropic Rule",
    priority: 2,
    match_protocol: "openai_chat",
    match_model_pattern: anthropicRequestModel,
    upstream_protocol: "anthropic",
    target_provider_id: anthropicProviderId,
    target_model: anthropicTargetModel,
    enabled: true,
  });

  let anthropicResponse = proxyChat({
    model: anthropicRequestModel,
    messages: [{
      role: "system",
      content: "be terse",
    }, {
      role: "user",
      content: "hello anthropic",
    }],
    max_tokens: 32,
  });
  assert(anthropicResponse.object === "chat.completion", "Anthropic conversion response object mismatch");
  assert(anthropicResponse.model === anthropicTargetModel, "Anthropic conversion response model mismatch");
  assert(anthropicResponse.choices[0].message.role === "assistant", "Anthropic conversion role mismatch");
  assert(
    anthropicResponse.choices[0].message.content === "anthropic upstream ok",
    "Anthropic conversion content mismatch: " + JSON.stringify(anthropicResponse)
  );
  assert(anthropicResponse.usage.prompt_tokens === 13, "Anthropic conversion prompt tokens mismatch");
  assert(anthropicResponse.usage.completion_tokens === 5, "Anthropic conversion completion tokens mismatch");
  assert(anthropicResponse.usage.total_tokens === 18, "Anthropic conversion total tokens mismatch");

  let anthropicTraffic = latestTrafficFor(anthropicRequestModel);
  assert(anthropicTraffic !== undefined, "Anthropic conversion traffic missing");
  assert(anthropicTraffic.input_tokens === 13, "Anthropic conversion input tokens missing");
  assert(anthropicTraffic.output_tokens === 5, "Anthropic conversion output tokens missing");
  assert(anthropicTraffic.total_tokens === 18, "Anthropic conversion total tokens missing");

  let openAIResponse = proxyChat({
    model: openAIRequestModel,
    messages: [{
      role: "user",
      content: "hello openai",
    }],
  });
  assert(openAIResponse.object === "chat.completion", "OpenAI proxy response object mismatch");
  assert(openAIResponse.model === openAITargetModel, "OpenAI proxy response model mismatch");
  assert(openAIResponse.choices[0].message.content === "openai upstream ok", "OpenAI proxy content mismatch");
  assert(openAIResponse.usage.total_tokens === 18, "OpenAI proxy usage mismatch");

  let openAITraffic = latestTrafficFor(openAIRequestModel);
  assert(openAITraffic !== undefined, "OpenAI proxy traffic missing");
  assert(openAITraffic.input_tokens === 11, "OpenAI proxy input tokens missing");
  assert(openAITraffic.output_tokens === 7, "OpenAI proxy output tokens missing");
  assert(openAITraffic.total_tokens === 18, "OpenAI proxy total tokens missing");

  let sawOpenAI = false;
  let sawAnthropic = false;
  for (let item of mockRequests) {
    if (item.path === "/v1/chat/completions" && item.body.model === openAITargetModel) {
      sawOpenAI = true;
    }
    if (item.path === "/v1/messages" && item.body.model === anthropicTargetModel && item.body.max_tokens === 32) {
      sawAnthropic = true;
    }
  }
  assert(sawOpenAI, "mock upstream did not receive OpenAI chat request");
  assert(sawAnthropic, "mock upstream did not receive converted Anthropic messages request");

  println("proxy smoke ok");
} finally {
  cleanup();
  mockServer.close();
}
