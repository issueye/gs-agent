import { messagesUrl } from "@/agent/llm/anthropic-url";
import { createRunLogger, eventLogFields } from "@/agent/log";

let http = require("@std/net/http/client");

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

  let model = options.model;
  if (!model) {
    model = "claude-3-5-sonnet-latest";
  }

  let maxTokens = options.maxTokens;
  if (!maxTokens) {
    maxTokens = 1024;
  }

  let system = options.system;
  if (!system) {
    system = "You are a concise coding assistant.";
  }

  function next(messages, tools, turnOptions) {
    if (!turnOptions) {
      turnOptions = {};
    }

    // DeepSeek v4 flash 的 thinking 模式默认可能要求回传 thinking block；
    // 这里默认 disabled，先保证普通工具调用闭环稳定。
    let body = {
      model: model,
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

    let response = http.request({
      method: "POST",
      url: messagesUrl(baseUrl),
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

    let payload = JSON.parse(response.body);
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
