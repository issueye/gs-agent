import { messagesUrl } from "@/agent/llm/anthropic-url";

let http = require("@std/net/http/client");
let sse = require("@std/sse");
let toml = require("@std/toml");

// 流式测试复用真实模型配置，但只读取 [llm.anthropic]。
function anthropicConfig() {
  let config = toml.readFileSync("agent.local.toml");
  if (!config.llm || !config.llm.anthropic) {
    throw new ReferenceError("agent.local.toml requires [llm.anthropic]");
  }
  return config.llm.anthropic;
}

// Anthropic streaming 的文本增量在 content_block_delta.delta.text 中。
function textDelta(payload) {
  if (payload.type !== "content_block_delta") {
    return "";
  }
  if (!payload.delta) {
    return "";
  }
  if (payload.delta.type !== "text_delta") {
    return "";
  }
  return payload.delta.text;
}

// 直接请求 streaming endpoint，并逐个消费 SSE event。
function main() {
  let config = anthropicConfig();
  let maxTokens = config.maxTokens;
  if (!maxTokens) {
    maxTokens = 512;
  }

  let timeoutMs = config.timeoutMs;
  if (!timeoutMs) {
    timeoutMs = 60000;
  }

  let body = {
    model: config.model,
    max_tokens: maxTokens,
    thinking: {
      type: config.thinking || "disabled",
    },
    stream: true,
    messages: [
      {
        role: "user",
        content: "Reply in one short paragraph. Include the words STREAM_OK at the end.",
      },
    ],
  };

  let response = http.stream({
    method: "POST",
    url: messagesUrl(config.baseUrl),
    timeoutMs: timeoutMs,
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorBody = response.body.readAll();
    response.close();
    throw new Error("stream request failed: " + String(response.status) + " " + errorBody);
  }

  let reader = sse.reader(response.body);
  let events = 0;
  let chunks = 0;
  let text = "";

  println("stream:start status=" + String(response.status));

  while (true) {
    let event = reader.next();
    if (event === null) {
      break;
    }

    events = events + 1;
    if (event.data === "[DONE]") {
      break;
    }

    let payload = JSON.parse(event.data);
    if (payload.type === "error") {
      response.close();
      throw new Error("stream event error: " + JSON.stringify(payload.error));
    }

    let delta = textDelta(payload);
    if (delta !== "") {
      chunks = chunks + 1;
      text = text + delta;
      print(delta);
    }

    if (payload.type === "message_stop") {
      break;
    }
  }

  response.close();

  println("");
  println("stream:events=" + String(events));
  println("stream:chunks=" + String(chunks));
  println("stream:contains_ok=" + String(text.includes("STREAM_OK")));
}

main();
