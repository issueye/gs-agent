import { messagesUrl } from "@/agent/llm/anthropic-url";
import { appendJsonLog } from "@/agent/log";

let http = require("@std/net/http/client");
let sse = require("@std/sse");
let timers = require("@std/timers");

// Anthropic 消息 content 可以是字符串或结构化块；工具结果统一转成文本。
function asTextContent(content) {
  if (typeof content === "string") {
    return content;
  }
  return JSON.stringify(content);
}

// 将本项目内部消息格式转换为 Anthropic Messages API 格式。
function toAnthropicMessages(messages) {
  let out = [];
  for (let message of messages) {
    if (message.kind === "tool_call") {
      out.push({
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: message.id,
            name: message.name,
            input: message.args,
          },
        ],
      });
      continue;
    }

    if (message.role === "tool") {
      out.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: message.id,
            content: asTextContent(message.content),
          },
        ],
      });
      continue;
    }

    if (message.role === "user" || message.role === "assistant") {
      out.push({
        role: message.role,
        content: asTextContent(message.content),
      });
    }
  }
  return out;
}

// registry 暴露的是 JSON Schema；Anthropic 工具 schema 字段名为 input_schema。
function toAnthropicTools(tools) {
  return tools.map(function(tool) {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    };
  });
}

// 当前非流式 provider 只取文本块；流式验证见 stream-test.gs。
function firstText(blocks) {
  let text = "";
  for (let block of blocks) {
    if (block.type === "text") {
      text = text + block.text;
    }
  }
  return text;
}

// 模型如果选择工具，会在 content 里返回第一个 tool_use 块。
function firstToolUse(blocks) {
  for (let block of blocks) {
    if (block.type === "tool_use") {
      return block;
    }
  }
  return undefined;
}

// 创建 Anthropic 兼容 provider；DeepSeek 的 /anthropic endpoint 也走同一协议。
export function anthropicRequestBody(options, messages, tools, turnOptions) {
  if (!turnOptions) {
    turnOptions = {};
  }

  let maxTokens = options.maxTokens;
  if (!maxTokens) {
    maxTokens = 1024;
  }

  let system = options.system;
  if (!system) {
    system = "You are a concise coding assistant.";
  }

  let body = {
    model: options.model || "claude-3-5-sonnet-latest",
    max_tokens: maxTokens,
    system: system,
    thinking: {
      type: options.thinking || "disabled",
    },
    messages: toAnthropicMessages(messages),
  };

  if (turnOptions.allowTools && tools.length > 0) {
    body.tools = toAnthropicTools(tools);
  }

  if ("temperature" in options) {
    body.temperature = options.temperature;
  }
  if (options.stream) {
    body.stream = true;
  }

  return body;
}

function logRequestBody(options, url, body) {
  if (!options.requestBodyLogFile) {
    return;
  }

  appendJsonLog(options.requestBodyLogFile, {
    time: (new Date()).toISOString(),
    provider: "anthropic",
    url: url,
    body: body,
  });
}

function retryCount(options) {
  let value = options.retryCount;
  if (value === undefined) {
    value = options.retries;
  }
  if (value === undefined) {
    value = 3;
  }
  if (value < 1) {
    return 1;
  }
  return Math.floor(value);
}

function retryDelayMs(options) {
  let value = options.retryDelayMs;
  if (value === undefined) {
    value = 500;
  }
  if (value < 0) {
    return 0;
  }
  return value;
}

function retryBackoffMs(options, attempt) {
  let delay = retryDelayMs(options);
  if (delay <= 0) {
    return 0;
  }
  let factor = 1;
  for (let i = 1; i < attempt; i = i + 1) {
    factor = factor * 2;
  }
  return delay * factor;
}

export function isRetryableAnthropicError(err) {
  let text = String(err || "").toLowerCase();
  if (text.includes("empty body") || text.includes("invalid json")) {
    return true;
  }
  if (text.includes("timeout") || text.includes("timed out") || text.includes("econnreset") || text.includes("socket") || text.includes("network")) {
    return true;
  }
  if (text.includes("anthropic request failed: 429")) {
    return true;
  }
  if (text.includes("anthropic request failed: 5")) {
    return true;
  }
  return false;
}

function logRetry(options, url, attempt, maxAttempts, err, delayMs) {
  let event = {
    attempt: attempt,
    maxAttempts: maxAttempts,
    delayMs: delayMs,
    error: String(err),
  };
  if (options.onRetry) {
    options.onRetry(event);
  }
  if (!options.requestBodyLogFile) {
    return;
  }
  appendJsonLog(options.requestBodyLogFile, {
    time: (new Date()).toISOString(),
    provider: "anthropic",
    url: url,
    retry: event,
  });
}

export function parseAnthropicPayload(response) {
  let body = String(response.body || "");
  if (body.trim() === "") {
    throw new Error("Anthropic request returned empty body: status=" + String(response.status));
  }

  try {
    return JSON.parse(body);
  } catch (err) {
    throw new Error("Anthropic request returned invalid JSON: status=" + String(response.status) + " bodyPrefix=" + body.slice(0, 240));
  }
}

export function createAnthropicProvider(options) {
  if (!options) {
    options = {};
  }

  let apiKey = options.apiKey;
  if (!apiKey) {
    throw new ReferenceError("createAnthropicProvider requires options.apiKey");
  }

  let baseUrl = options.baseUrl;
  if (!baseUrl) {
    baseUrl = "https://api.anthropic.com";
  }

  function requestOnce(body, url) {
    let response = http.request({
      method: "POST",
      url: url,
      timeoutMs: options.timeoutMs || 60000,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error("Anthropic request failed: " + String(response.status) + " " + response.body);
    }

    return parseAnthropicPayload(response);
  }

  function requestWithRetry(body, url) {
    let maxAttempts = retryCount(options);
    let lastErr = undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt = attempt + 1) {
      try {
        return requestOnce(body, url);
      } catch (err) {
        lastErr = err;
        if (attempt >= maxAttempts || !isRetryableAnthropicError(err)) {
          throw err;
        }
        let delay = retryBackoffMs(options, attempt);
        logRetry(options, url, attempt, maxAttempts, err, delay);
        if (delay > 0) {
          timers.sleep(delay);
        }
      }
    }
    throw lastErr;
  }

  function payloadFromEvent(event) {
    if (!event || !event.data) {
      return undefined;
    }
    let data = String(event.data || "");
    if (data === "[DONE]") {
      return undefined;
    }
    try {
      return JSON.parse(data);
    } catch (error) {
      return undefined;
    }
  }

  function streamBlockFromStart(payload) {
    let block = payload.content_block || {};
    if (block.type === "tool_use") {
      return {
        type: "tool_use",
        id: block.id,
        name: block.name,
        input: block.input || {},
        inputJson: "",
      };
    }
    if (block.type === "text") {
      return {
        type: "text",
        text: String(block.text || ""),
      };
    }
    if (block.type === "thinking") {
      return undefined;
    }
    return undefined;
  }

  function ensureTextBlock(blocks) {
    let last = blocks.length > 0 ? blocks[blocks.length - 1] : undefined;
    if (last && last.type === "text") {
      return last;
    }
    let block = {
      type: "text",
      text: "",
    };
    blocks.push(block);
    return block;
  }

  function ensureTextBlockAt(blocks, index) {
    if (index === undefined || index === null || index < 0) {
      let block = {
        type: "text",
        text: "",
      };
      blocks.push(block);
      return block;
    }
    let block = blocks[index];
    if (block) {
      if (block.type === "text") {
        return block;
      }
    }
    block = {
      type: "text",
      text: "",
    };
    blocks[index] = block;
    return block;
  }

  function finishStreamBlocks(blocks) {
    let out = [];
    for (let block of blocks) {
      if (block.type === "tool_use") {
        let input = block.input || {};
        if (block.inputJson && block.inputJson !== "") {
          try {
            input = JSON.parse(block.inputJson);
          } catch (error) {
            input = {};
          }
        }
        out.push({
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: input,
        });
      } else if (block.type === "text") {
        out.push({
          type: "text",
          text: String(block.text || ""),
        });
      }
    }
    if (out.length === 0) {
      out.push({
        type: "text",
        text: "",
      });
    }
    return out;
  }

  function requestStream(body, url) {
    let response = http.stream({
      method: "POST",
      url: url,
      timeoutMs: options.timeoutMs || 60000,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorBody = "";
      if (response.body) {
        errorBody = response.body.readAll();
      }
      if (response.close) {
        response.close();
      }
      throw new Error("Anthropic request failed: " + String(response.status) + " " + errorBody);
    }

    let reader = sse.reader(response.body);
    let text = "";
    let blocks = [];
    while (true) {
      let event = reader.next();
      if (event === null) {
        break;
      }
      let payload = payloadFromEvent(event);
      if (!payload) {
        continue;
      }
      if (payload.type === "content_block_start") {
        let started = streamBlockFromStart(payload);
        if (started) {
          blocks[payload.index] = started;
        }
        continue;
      }
      if (payload.type !== "content_block_delta") {
        continue;
      }

      let index = payload.index;
      let delta = payload.delta || {};
      if (delta.text) {
        let textDelta = String(delta.text);
        text = text + textDelta;
        let block = blocks[index];
        if (!block) {
          block = ensureTextBlockAt(blocks, index);
        }
        block.text = String(block.text || "") + textDelta;
        if (options.onDelta) {
          options.onDelta({
            text: textDelta,
            content: text,
          });
        }
      } else if (delta.partial_json) {
        let toolBlock = blocks[index];
        if (!toolBlock) {
          toolBlock = ensureTextBlockAt(blocks, index);
        }
        if (toolBlock.type === "tool_use") {
          toolBlock.inputJson = String(toolBlock.inputJson || "") + String(delta.partial_json);
        }
      }
    }
    if (response.close) {
      response.close();
    }
    return {
      content: finishStreamBlocks(blocks),
    };
  }

  function next(messages, tools, turnOptions) {
    let body = anthropicRequestBody(options, messages, tools, turnOptions);
    let url = messagesUrl(baseUrl);
    logRequestBody(options, url, body);

    let payload = options.stream ? requestStream(body, url) : requestWithRetry(body, url);
    let toolUse = firstToolUse(payload.content);
    if (toolUse) {
      return {
        kind: "tool_call",
        id: toolUse.id,
        name: toolUse.name,
        args: toolUse.input,
      };
    }

    return {
      role: "assistant",
      content: firstText(payload.content),
    };
  }

  return {
    next: next,
  };
}
