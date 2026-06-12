let http = require("@std/net/http/client");
let process = require("@std/process");
let web = require("@std/web");
let stream = require("@std/stream");

let bridgePort = Number(process.getenv("GS_LLM_BRIDGE_SMOKE_PORT") || 18182);
let bridgeBase = "http://127.0.0.1:" + String(bridgePort);
let suffix = String((new Date()).getTime());
let proxySecret = "sk-smoke-proxy-" + suffix;

let openAIProviderId = "smoke-proxy-openai-provider-" + suffix;
let openAIModelId = "smoke-proxy-openai-model-" + suffix;
let openAITargetModel = "smoke-target-openai-" + suffix;
let openAIRuleId = "smoke-proxy-openai-rule-" + suffix;
let openAIAnthropicRuleId = "smoke-proxy-openai-anthropic-rule-" + suffix;
let openAIRequestModel = "smoke-proxy-openai-request-" + suffix;

let anthropicProviderId = "smoke-proxy-anthropic-provider-" + suffix;
let anthropicModelId = "smoke-proxy-anthropic-model-" + suffix;
let anthropicTargetModel = "smoke-target-anthropic-" + suffix;
let anthropicRuleId = "smoke-proxy-anthropic-rule-" + suffix;
let anthropicRequestModel = "smoke-proxy-anthropic-request-" + suffix;

let responsesProviderId = "smoke-proxy-responses-provider-" + suffix;
let responsesModelId = "smoke-proxy-responses-model-" + suffix;
let responsesTargetModel = "smoke-target-responses-" + suffix;
let responsesRuleId = "smoke-proxy-responses-rule-" + suffix;
let responsesFromChatRuleId = "smoke-proxy-responses-from-chat-rule-" + suffix;
let responsesRequestModel = "smoke-proxy-responses-request-" + suffix;
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

function proxyChatStream(body) {
  return http.stream({
    url: bridgeBase + "/v1/chat/completions",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + proxySecret,
    },
    body: body,
  });
}

function proxyResponses(body) {
  return jsonRequest("POST", "/v1/responses", body, {
    Authorization: "Bearer " + proxySecret,
  });
}

function proxyResponsesStream(body) {
  return http.stream({
    url: bridgeBase + "/v1/responses",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + proxySecret,
    },
    body: body,
  });
}

function proxyAnthropicStream(body) {
  return http.stream({
    url: bridgeBase + "/v1/messages",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": proxySecret,
    },
    body: body,
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

function contentText(content) {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return String(content || "");
  }
  let out = "";
  for (let item of content) {
    if (typeof item === "string") {
      out = out + item;
    } else if (item) {
      out = out + String(item.text || item.input_text || item.output_text || "");
    }
  }
  return out;
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
  let messageText = "";
  for (let message of body.messages || []) {
    messageText = messageText + contentText(message.content);
  }
  if (body.stream === true && messageText.indexOf("tool") >= 0) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    return res.stream(stream.fromString(
      "data: {\"id\":\"chatcmpl-tool-stream-" + suffix + "\",\"object\":\"chat.completion.chunk\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\"}}]}\n\n" +
      "data: {\"id\":\"chatcmpl-tool-stream-" + suffix + "\",\"object\":\"chat.completion.chunk\",\"choices\":[{\"index\":0,\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"call_weather_" + suffix + "\",\"type\":\"function\",\"function\":{\"name\":\"get_weather\",\"arguments\":\"\"}}]}}]}\n\n" +
      "data: {\"id\":\"chatcmpl-tool-stream-" + suffix + "\",\"object\":\"chat.completion.chunk\",\"choices\":[{\"index\":0,\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"arguments\":\"{\\\"city\\\":\"}}]}}]}\n\n" +
      "data: {\"id\":\"chatcmpl-tool-stream-" + suffix + "\",\"object\":\"chat.completion.chunk\",\"choices\":[{\"index\":0,\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"arguments\":\"\\\"Shanghai\\\"}\"}}]},\"finish_reason\":\"tool_calls\"}]}\n\n" +
      "data: [DONE]\n\n"
    ));
  }
  if (body.stream === true) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    return res.stream(stream.fromString(
      "data: {\"id\":\"chatcmpl-stream-" + suffix + "\",\"object\":\"chat.completion.chunk\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\"}}]}\n\n" +
      "data: {\"id\":\"chatcmpl-stream-" + suffix + "\",\"object\":\"chat.completion.chunk\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"stream ok\"},\"finish_reason\":\"stop\"}]}\n\n" +
      "data: [DONE]\n\n"
    ));
  }
  if (messageText.indexOf("tool") >= 0) {
    let toolCall = {
      id: "call_weather_" + suffix,
      type: "function",
    };
    toolCall["function"] = {
      name: "get_weather",
      arguments: "{\"city\":\"Shanghai\"}",
    };
    return res.json({
      id: "chatcmpl-tool-" + suffix,
      object: "chat.completion",
      created: 1710000000,
      model: body.model,
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: "",
          tool_calls: [toolCall],
        },
        finish_reason: "tool_calls",
      }],
      usage: {
        prompt_tokens: 12,
        completion_tokens: 3,
        total_tokens: 15,
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
  let firstAnthropicMessage = (body.messages || [])[0] || {};
  if (body.stream === true && String(firstAnthropicMessage.content || "").indexOf("tool") >= 0) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    return res.stream(stream.fromString(
      "event: message_start\n" +
      "data: {\"type\":\"message_start\",\"message\":{\"id\":\"msg-tool-stream-" + suffix + "\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\"" + body.model + "\",\"content\":[],\"stop_reason\":null,\"stop_sequence\":null,\"usage\":{\"input_tokens\":12,\"output_tokens\":0}}}\n\n" +
      "event: content_block_start\n" +
      "data: {\"type\":\"content_block_start\",\"index\":0,\"content_block\":{\"type\":\"tool_use\",\"id\":\"toolu_weather_" + suffix + "\",\"name\":\"get_weather\",\"input\":{}}}\n\n" +
      "event: content_block_delta\n" +
      "data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"input_json_delta\",\"partial_json\":\"{\\\"city\\\":\"}}\n\n" +
      "event: content_block_delta\n" +
      "data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"input_json_delta\",\"partial_json\":\"\\\"Shanghai\\\"}\"}}\n\n" +
      "event: content_block_stop\n" +
      "data: {\"type\":\"content_block_stop\",\"index\":0}\n\n" +
      "event: message_delta\n" +
      "data: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"tool_use\",\"stop_sequence\":null},\"usage\":{\"output_tokens\":3}}\n\n" +
      "event: message_stop\n" +
      "data: {\"type\":\"message_stop\"}\n\n"
    ));
  }
  if (body.stream === true) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    return res.stream(stream.fromString(
      "event: message_start\n" +
      "data: {\"type\":\"message_start\",\"message\":{\"id\":\"msg-stream-" + suffix + "\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\"" + body.model + "\",\"content\":[],\"stop_reason\":null,\"stop_sequence\":null,\"usage\":{\"input_tokens\":13,\"output_tokens\":0}}}\n\n" +
      "event: content_block_start\n" +
      "data: {\"type\":\"content_block_start\",\"index\":0,\"content_block\":{\"type\":\"text\",\"text\":\"\"}}\n\n" +
      "event: content_block_delta\n" +
      "data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"anthropic stream ok\"}}\n\n" +
      "event: content_block_stop\n" +
      "data: {\"type\":\"content_block_stop\",\"index\":0}\n\n" +
      "event: message_delta\n" +
      "data: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"end_turn\",\"stop_sequence\":null},\"usage\":{\"output_tokens\":5}}\n\n" +
      "event: message_stop\n" +
      "data: {\"type\":\"message_stop\"}\n\n"
    ));
  }
  if (String(firstAnthropicMessage.content || "").indexOf("tool") >= 0) {
    return res.json({
      id: "msg-tool-" + suffix,
      type: "message",
      role: "assistant",
      model: body.model,
      content: [{
        type: "tool_use",
        id: "toolu_weather_" + suffix,
        name: "get_weather",
        input: {
          city: "Shanghai",
        },
      }],
      stop_reason: "tool_use",
      stop_sequence: null,
      usage: {
        input_tokens: 12,
        output_tokens: 3,
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

app.post("/v1/responses", function(req, res) {
  let body = req.body || {};
  recordMock(req.url, body, req.headers || {});
  if (body.model !== responsesTargetModel) {
    return res.status(400).json({
      error: {
        message: "expected Responses target model " + responsesTargetModel,
      },
    });
  }
  if (body.stream === true) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    return res.stream(stream.fromString(
      "event: response.created\n" +
      "data: {\"type\":\"response.created\",\"response\":{\"id\":\"resp-stream-" + suffix + "\",\"object\":\"response\",\"status\":\"in_progress\",\"model\":\"" + body.model + "\",\"output\":[]}}\n\n" +
      "event: response.output_text.delta\n" +
      "data: {\"type\":\"response.output_text.delta\",\"delta\":\"responses stream ok\"}\n\n" +
      "event: response.completed\n" +
      "data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp-stream-" + suffix + "\",\"object\":\"response\",\"status\":\"completed\",\"model\":\"" + body.model + "\",\"output\":[]}}\n\n"
    ));
  }
  let inputText = "";
  for (let item of body.input || []) {
    inputText = inputText + JSON.stringify(item);
  }
  if (inputText.indexOf("tool") >= 0) {
    return res.json({
      id: "resp-tool-" + suffix,
      object: "response",
      status: "completed",
      model: body.model,
      output: [{
        type: "function_call",
        call_id: "call_weather_" + suffix,
        name: "get_weather",
        arguments: "{\"city\":\"Shanghai\"}",
      }],
      usage: {
        input_tokens: 12,
        output_tokens: 3,
        total_tokens: 15,
      },
    });
  }
  return res.json({
    id: "resp-smoke-" + suffix,
    object: "response",
    status: "completed",
    model: body.model,
    output: [{
      type: "message",
      role: "assistant",
      content: [{
        type: "output_text",
        text: "responses upstream ok",
      }],
    }],
    usage: {
      input_tokens: 17,
      output_tokens: 6,
      total_tokens: 23,
    },
  });
});

let mockServer = app.listen(0);
let mockBase = "http://127.0.0.1:" + String(mockServer.port);

function cleanup() {
  deleteIfExists("/api/v1/api-keys/" + encodeURIComponent(apiKeyId));
  deleteIfExists("/api/v1/routing-rules/" + encodeURIComponent(openAIRuleId));
  deleteIfExists("/api/v1/routing-rules/" + encodeURIComponent(openAIAnthropicRuleId));
  deleteIfExists("/api/v1/routing-rules/" + encodeURIComponent(anthropicRuleId));
  deleteIfExists("/api/v1/routing-rules/" + encodeURIComponent(responsesRuleId));
  deleteIfExists("/api/v1/routing-rules/" + encodeURIComponent(responsesFromChatRuleId));
  deleteIfExists("/api/v1/providers/" + encodeURIComponent(openAIProviderId) + "/models/" + encodeURIComponent(openAIModelId));
  deleteIfExists("/api/v1/providers/" + encodeURIComponent(anthropicProviderId) + "/models/" + encodeURIComponent(anthropicModelId));
  deleteIfExists("/api/v1/providers/" + encodeURIComponent(responsesProviderId) + "/models/" + encodeURIComponent(responsesModelId));
  deleteIfExists("/api/v1/providers/" + encodeURIComponent(openAIProviderId));
  deleteIfExists("/api/v1/providers/" + encodeURIComponent(anthropicProviderId));
  deleteIfExists("/api/v1/providers/" + encodeURIComponent(responsesProviderId));
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
  data("POST", "/api/v1/routing-rules", {
    id: openAIAnthropicRuleId,
    name: "Smoke Proxy OpenAI From Anthropic Rule",
    priority: 1,
    match_protocol: "anthropic",
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

  data("POST", "/api/v1/providers", {
    id: responsesProviderId,
    name: "Smoke Proxy Responses Provider",
    protocol: "openai_responses",
    vendor: "openai",
    base_url: mockBase,
    api_key: "sk-mock-responses",
    enabled: true,
  });
  data("POST", "/api/v1/providers/" + encodeURIComponent(responsesProviderId) + "/models", {
    id: responsesModelId,
    name: responsesTargetModel,
    max_tokens: 4096,
    enabled: true,
  });
  data("POST", "/api/v1/routing-rules", {
    id: responsesRuleId,
    name: "Smoke Proxy Responses Rule",
    priority: 3,
    match_protocol: "openai_responses",
    match_model_pattern: openAIRequestModel,
    upstream_protocol: "openai_chat",
    target_provider_id: openAIProviderId,
    target_model: openAITargetModel,
    enabled: true,
  });
  data("POST", "/api/v1/routing-rules", {
    id: responsesFromChatRuleId,
    name: "Smoke Proxy Chat To Responses Rule",
    priority: 3,
    match_protocol: "openai_chat",
    match_model_pattern: responsesRequestModel,
    upstream_protocol: "openai_responses",
    target_provider_id: responsesProviderId,
    target_model: responsesTargetModel,
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

  let streamResponse = proxyChatStream({
    model: openAIRequestModel,
    stream: true,
    messages: [{
      role: "user",
      content: "hello stream",
    }],
  });
  assert(Number(streamResponse.status || 0) === 200, "OpenAI stream status mismatch");
  assert(String(streamResponse.headers["Content-Type"] || streamResponse.headers["content-type"] || "").indexOf("text/event-stream") >= 0, "OpenAI stream content-type mismatch");
  let streamBody = streamResponse.body.readAll();
  if (streamResponse.close) {
    streamResponse.close();
  }
  assert(String(streamBody || "").indexOf("stream ok") >= 0, "OpenAI stream body mismatch: " + String(streamBody || ""));

  let streamTraffic = latestTrafficFor(openAIRequestModel);
  assert(streamTraffic !== undefined, "OpenAI stream traffic missing");
  assert(streamTraffic.status_code === 200, "OpenAI stream traffic status mismatch");

  let responsesViaChat = proxyResponses({
    model: openAIRequestModel,
    input: "hello responses via chat",
  });
  assert(responsesViaChat.object === "response", "Responses via Chat object mismatch");
  assert(responsesViaChat.model === openAITargetModel, "Responses via Chat model mismatch");
  assert(responsesViaChat.output[0].content[0].text === "openai upstream ok", "Responses via Chat content mismatch");

  let chatViaResponses = proxyChat({
    model: responsesRequestModel,
    messages: [{
      role: "user",
      content: "hello chat via responses",
    }],
  });
  assert(chatViaResponses.object === "chat.completion", "Chat via Responses object mismatch");
  assert(chatViaResponses.model === responsesTargetModel, "Chat via Responses model mismatch");
  assert(chatViaResponses.choices[0].message.content === "responses upstream ok", "Chat via Responses content mismatch");

  let chatToolViaAnthropic = proxyChat({
    model: anthropicRequestModel,
    messages: [{
      role: "user",
      content: "please use tool",
    }],
    max_tokens: 32,
  });
  assert(chatToolViaAnthropic.choices[0].message.tool_calls[0]["function"].name === "get_weather", "Chat tool via Anthropic name mismatch");
  assert(chatToolViaAnthropic.choices[0].finish_reason === "tool_calls", "Chat tool via Anthropic finish mismatch");

  let responsesToolViaChat = proxyResponses({
    model: openAIRequestModel,
    input: "please use tool",
  });
  assert(responsesToolViaChat.output[0].type === "function_call", "Responses tool via Chat type mismatch");
  assert(responsesToolViaChat.output[0].name === "get_weather", "Responses tool via Chat name mismatch");

  let anthropicToolViaOpenAI = jsonRequest("POST", "/v1/messages", {
    model: openAIRequestModel,
    messages: [{
      role: "user",
      content: "please use tool",
    }],
    max_tokens: 32,
  }, {
    "x-api-key": proxySecret,
  });
  assert(anthropicToolViaOpenAI.content[0].type === "tool_use", "Anthropic tool via OpenAI type mismatch: response=" + JSON.stringify(anthropicToolViaOpenAI) + " lastMock=" + JSON.stringify(mockRequests[mockRequests.length - 1] || {}));
  assert(anthropicToolViaOpenAI.content[0].name === "get_weather", "Anthropic tool via OpenAI name mismatch: " + JSON.stringify(anthropicToolViaOpenAI));

  let responsesStreamViaChat = proxyResponsesStream({
    model: openAIRequestModel,
    stream: true,
    input: "hello responses stream",
  });
  assert(Number(responsesStreamViaChat.status || 0) === 200, "Responses stream via Chat status mismatch");
  let responsesStreamViaChatBody = responsesStreamViaChat.body.readAll();
  if (responsesStreamViaChat.close) {
    responsesStreamViaChat.close();
  }
  assert(String(responsesStreamViaChatBody || "").indexOf("response.output_text.delta") >= 0, "Responses stream via Chat event mismatch");
  assert(String(responsesStreamViaChatBody || "").indexOf("stream ok") >= 0, "Responses stream via Chat body mismatch: " + String(responsesStreamViaChatBody || ""));

  let chatStreamViaResponses = proxyChatStream({
    model: responsesRequestModel,
    stream: true,
    messages: [{
      role: "user",
      content: "hello chat stream via responses",
    }],
  });
  assert(Number(chatStreamViaResponses.status || 0) === 200, "Chat stream via Responses status mismatch");
  let chatStreamViaResponsesBody = chatStreamViaResponses.body.readAll();
  if (chatStreamViaResponses.close) {
    chatStreamViaResponses.close();
  }
  assert(String(chatStreamViaResponsesBody || "").indexOf("chat.completion.chunk") >= 0, "Chat stream via Responses chunk mismatch");
  assert(String(chatStreamViaResponsesBody || "").indexOf("responses stream ok") >= 0, "Chat stream via Responses body mismatch: " + String(chatStreamViaResponsesBody || ""));

  let convertedAnthropicStreamResponse = proxyChatStream({
    model: anthropicRequestModel,
    stream: true,
    messages: [{
      role: "user",
      content: "hello converted stream",
    }],
    max_tokens: 32,
  });
  assert(Number(convertedAnthropicStreamResponse.status || 0) === 200, "Anthropic converted stream status mismatch");
  assert(String(convertedAnthropicStreamResponse.headers["Content-Type"] || convertedAnthropicStreamResponse.headers["content-type"] || "").indexOf("text/event-stream") >= 0, "Anthropic converted stream content-type mismatch");
  let convertedAnthropicStreamBody = convertedAnthropicStreamResponse.body.readAll();
  if (convertedAnthropicStreamResponse.close) {
    convertedAnthropicStreamResponse.close();
  }
  assert(String(convertedAnthropicStreamBody || "").indexOf("anthropic stream ok") >= 0, "Anthropic converted stream body mismatch: " + String(convertedAnthropicStreamBody || ""));
  assert(String(convertedAnthropicStreamBody || "").indexOf("chat.completion.chunk") >= 0, "Anthropic converted stream should be OpenAI chunks");

  let convertedOpenAIStreamResponse = proxyAnthropicStream({
    model: openAIRequestModel,
    stream: true,
    messages: [{
      role: "user",
      content: "hello anthropic downstream",
    }],
    max_tokens: 32,
  });
  assert(Number(convertedOpenAIStreamResponse.status || 0) === 200, "OpenAI converted stream status mismatch");
  assert(String(convertedOpenAIStreamResponse.headers["Content-Type"] || convertedOpenAIStreamResponse.headers["content-type"] || "").indexOf("text/event-stream") >= 0, "OpenAI converted stream content-type mismatch");
  let convertedOpenAIStreamBody = convertedOpenAIStreamResponse.body.readAll();
  if (convertedOpenAIStreamResponse.close) {
    convertedOpenAIStreamResponse.close();
  }
  assert(String(convertedOpenAIStreamBody || "").indexOf("content_block_delta") >= 0, "OpenAI converted stream should be Anthropic events");
  assert(String(convertedOpenAIStreamBody || "").indexOf("stream ok") >= 0, "OpenAI converted stream body mismatch: " + String(convertedOpenAIStreamBody || ""));

  let chatToolStreamViaAnthropic = proxyChatStream({
    model: anthropicRequestModel,
    stream: true,
    messages: [{
      role: "user",
      content: "please use tool stream",
    }],
    max_tokens: 32,
  });
  assert(Number(chatToolStreamViaAnthropic.status || 0) === 200, "Chat tool stream via Anthropic status mismatch");
  let chatToolStreamViaAnthropicBody = chatToolStreamViaAnthropic.body.readAll();
  if (chatToolStreamViaAnthropic.close) {
    chatToolStreamViaAnthropic.close();
  }
  assert(String(chatToolStreamViaAnthropicBody || "").indexOf("tool_calls") >= 0, "Chat tool stream via Anthropic missing tool_calls: " + String(chatToolStreamViaAnthropicBody || ""));
  assert(String(chatToolStreamViaAnthropicBody || "").indexOf("get_weather") >= 0, "Chat tool stream via Anthropic missing name: " + String(chatToolStreamViaAnthropicBody || ""));
  assert(String(chatToolStreamViaAnthropicBody || "").indexOf("tool_calls") >= 0, "Chat tool stream via Anthropic missing finish reason: " + String(chatToolStreamViaAnthropicBody || ""));

  let anthropicToolStreamViaOpenAI = proxyAnthropicStream({
    model: openAIRequestModel,
    stream: true,
    messages: [{
      role: "user",
      content: "please use tool stream",
    }],
    max_tokens: 32,
  });
  assert(Number(anthropicToolStreamViaOpenAI.status || 0) === 200, "Anthropic tool stream via OpenAI status mismatch");
  let anthropicToolStreamViaOpenAIBody = anthropicToolStreamViaOpenAI.body.readAll();
  if (anthropicToolStreamViaOpenAI.close) {
    anthropicToolStreamViaOpenAI.close();
  }
  assert(String(anthropicToolStreamViaOpenAIBody || "").indexOf("\"tool_use\"") >= 0, "Anthropic tool stream via OpenAI missing tool_use: " + String(anthropicToolStreamViaOpenAIBody || ""));
  assert(String(anthropicToolStreamViaOpenAIBody || "").indexOf("input_json_delta") >= 0, "Anthropic tool stream via OpenAI missing input_json_delta: " + String(anthropicToolStreamViaOpenAIBody || ""));
  assert(String(anthropicToolStreamViaOpenAIBody || "").indexOf("get_weather") >= 0, "Anthropic tool stream via OpenAI missing name: " + String(anthropicToolStreamViaOpenAIBody || ""));

  let responsesToolStreamViaChat = proxyResponsesStream({
    model: openAIRequestModel,
    stream: true,
    input: "please use tool stream",
  });
  assert(Number(responsesToolStreamViaChat.status || 0) === 200, "Responses tool stream via Chat status mismatch");
  let responsesToolStreamViaChatBody = responsesToolStreamViaChat.body.readAll();
  if (responsesToolStreamViaChat.close) {
    responsesToolStreamViaChat.close();
  }
  assert(String(responsesToolStreamViaChatBody || "").indexOf("response.output_item.added") >= 0, "Responses tool stream via Chat missing output item: " + String(responsesToolStreamViaChatBody || ""));
  assert(String(responsesToolStreamViaChatBody || "").indexOf("response.function_call_arguments.delta") >= 0, "Responses tool stream via Chat missing arguments delta: " + String(responsesToolStreamViaChatBody || ""));
  assert(String(responsesToolStreamViaChatBody || "").indexOf("get_weather") >= 0, "Responses tool stream via Chat missing name: " + String(responsesToolStreamViaChatBody || ""));

  let sawOpenAI = false;
  let sawAnthropic = false;
  let sawOpenAIStream = false;
  let sawAnthropicStream = false;
  let sawResponses = false;
  let sawResponsesStream = false;
  for (let item of mockRequests) {
    if (item.path === "/v1/chat/completions" && item.body.model === openAITargetModel) {
      sawOpenAI = true;
    }
    if (item.path === "/v1/chat/completions" && item.body.model === openAITargetModel && item.body.stream === true) {
      sawOpenAIStream = true;
    }
    if (item.path === "/v1/messages" && item.body.model === anthropicTargetModel && item.body.max_tokens === 32) {
      sawAnthropic = true;
    }
    if (item.path === "/v1/messages" && item.body.model === anthropicTargetModel && item.body.stream === true) {
      sawAnthropicStream = true;
    }
    if (item.path === "/v1/responses" && item.body.model === responsesTargetModel) {
      sawResponses = true;
    }
    if (item.path === "/v1/responses" && item.body.model === responsesTargetModel && item.body.stream === true) {
      sawResponsesStream = true;
    }
  }
  assert(sawOpenAI, "mock upstream did not receive OpenAI chat request");
  assert(sawOpenAIStream, "mock upstream did not receive OpenAI stream request");
  assert(sawAnthropic, "mock upstream did not receive converted Anthropic messages request");
  assert(sawAnthropicStream, "mock upstream did not receive converted Anthropic stream request");
  assert(sawResponses, "mock upstream did not receive Responses request");
  assert(sawResponsesStream, "mock upstream did not receive Responses stream request");

  println("proxy smoke ok");
} finally {
  cleanup();
  mockServer.close();
}
