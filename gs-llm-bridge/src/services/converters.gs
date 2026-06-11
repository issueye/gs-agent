import { ProtocolAnthropic, ProtocolOpenAIChat } from "@/services/protocols";

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function objectBody(value) {
  if (!value) {
    return {};
  }
  let text = String(value || "").trim();
  if (text === "") {
    return {};
  }
  if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
    try {
      return JSON.parse(text);
    } catch (err) {
      return value;
    }
  }
  return value;
}

function textFromContent(content) {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  let parts = [];
  for (let item of content) {
    if (typeof item === "string") {
      parts.push(item);
    } else if (item && item.type === "text") {
      parts.push(String(item.text || ""));
    }
  }
  return parts.join("");
}

function anthropicContentFromOpenAI(content) {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return String(content || "");
  }
  let out = [];
  for (let item of content) {
    if (!item) {
      continue;
    }
    if (typeof item === "string") {
      out.push({
        type: "text",
        text: item,
      });
    } else if (item.type === "text") {
      out.push({
        type: "text",
        text: String(item.text || ""),
      });
    } else if (item.type === "image_url" && item.image_url && item.image_url.url) {
      out.push({
        type: "image",
        source: {
          type: "url",
          url: item.image_url.url,
        },
      });
    }
  }
  if (out.length === 0) {
    return "";
  }
  return out;
}

function openAIContentFromAnthropic(content) {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  let parts = [];
  for (let item of content) {
    if (!item) {
      continue;
    }
    if (typeof item === "string") {
      parts.push(item);
    } else if (item.type === "text") {
      parts.push(String(item.text || ""));
    }
  }
  return parts.join("");
}

function anthropicToolsFromOpenAI(tools) {
  if (!Array.isArray(tools)) {
    return undefined;
  }
  let out = [];
  for (let tool of tools) {
    if (!tool || tool.type !== "function" || !tool.function) {
      continue;
    }
    out.push({
      name: tool.function.name || "",
      description: tool.function.description || "",
      input_schema: tool.function.parameters || {
        type: "object",
        properties: {},
      },
    });
  }
  if (out.length === 0) {
    return undefined;
  }
  return out;
}

function convertOpenAIChatRequestToAnthropic(body, model, defaultMaxTokens) {
  let input = objectBody(body);
  let out = {
    model: model,
    messages: [],
  };
  let systemParts = [];
  let messages = input.messages || [];
  for (let message of messages) {
    if (!message) {
      continue;
    }
    let role = String(message.role || "user");
    if (role === "system") {
      systemParts.push(textFromContent(message.content));
      continue;
    }
    if (role !== "assistant") {
      role = "user";
    }
    out.messages.push({
      role: role,
      content: anthropicContentFromOpenAI(message.content),
    });
  }
  if (systemParts.length > 0) {
    out.system = systemParts.join("\n");
  }
  out.max_tokens = Number(input.max_tokens || input.max_completion_tokens || defaultMaxTokens || 1024);
  if ("temperature" in input) {
    out.temperature = input.temperature;
  }
  if ("top_p" in input) {
    out.top_p = input.top_p;
  }
  if ("stream" in input) {
    out.stream = input.stream;
  }
  if ("stop" in input) {
    out.stop_sequences = Array.isArray(input.stop) ? input.stop : [input.stop];
  }
  let tools = anthropicToolsFromOpenAI(input.tools);
  if (tools) {
    out.tools = tools;
  }
  if (input.metadata) {
    out.metadata = input.metadata;
  }
  return out;
}

function convertAnthropicRequestToOpenAIChat(body, model) {
  let input = objectBody(body);
  let out = {
    model: model,
    messages: [],
  };
  if (input.system) {
    out.messages.push({
      role: "system",
      content: textFromContent(input.system),
    });
  }
  for (let message of input.messages || []) {
    if (!message) {
      continue;
    }
    out.messages.push({
      role: String(message.role || "user"),
      content: openAIContentFromAnthropic(message.content),
    });
  }
  if ("max_tokens" in input) {
    out.max_tokens = input.max_tokens;
  }
  if ("temperature" in input) {
    out.temperature = input.temperature;
  }
  if ("top_p" in input) {
    out.top_p = input.top_p;
  }
  if ("stream" in input) {
    out.stream = input.stream;
  }
  if ("stop_sequences" in input) {
    out.stop = input.stop_sequences;
  }
  return out;
}

function sameProtocolRequest(body, model) {
  let out = clone(objectBody(body));
  out.model = model;
  return out;
}

function finishReasonFromAnthropic(reason) {
  if (reason === "end_turn") {
    return "stop";
  }
  if (reason === "max_tokens") {
    return "length";
  }
  if (reason === "tool_use") {
    return "tool_calls";
  }
  if (reason === "stop_sequence") {
    return "stop";
  }
  return reason || "stop";
}

function convertAnthropicResponseToOpenAIChat(body, model) {
  let input = objectBody(body);
  let created = Math.floor((new Date()).getTime() / 1000);
  return {
    id: input.id || "",
    object: "chat.completion",
    created: created,
    model: model || input.model || "",
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: openAIContentFromAnthropic(input.content),
      },
      finish_reason: finishReasonFromAnthropic(input.stop_reason),
    }],
    usage: extractUsage(input),
  };
}

function convertOpenAIChatResponseToAnthropic(body, model) {
  let input = objectBody(body);
  let choice = (input.choices || [])[0] || {};
  let message = choice.message || {};
  let usage = extractUsage(input);
  return {
    id: input.id || "",
    type: "message",
    role: "assistant",
    model: model || input.model || "",
    content: [{
      type: "text",
      text: String(message.content || ""),
    }],
    stop_reason: choice.finish_reason || "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
    },
  };
}

export function convertRequest(downstream, upstream, body, model, defaultMaxTokens) {
  if (downstream === upstream) {
    return sameProtocolRequest(body, model);
  }
  if (downstream === ProtocolOpenAIChat && upstream === ProtocolAnthropic) {
    return convertOpenAIChatRequestToAnthropic(body, model, defaultMaxTokens);
  }
  if (downstream === ProtocolAnthropic && upstream === ProtocolOpenAIChat) {
    return convertAnthropicRequestToOpenAIChat(body, model);
  }
  return sameProtocolRequest(body, model);
}

export function convertResponse(downstream, upstream, body, model) {
  if (downstream === upstream) {
    return sameProtocolRequest(body, model);
  }
  if (downstream === ProtocolOpenAIChat && upstream === ProtocolAnthropic) {
    return convertAnthropicResponseToOpenAIChat(body, model);
  }
  if (downstream === ProtocolAnthropic && upstream === ProtocolOpenAIChat) {
    return convertOpenAIChatResponseToAnthropic(body, model);
  }
  return sameProtocolRequest(body, model);
}

export function extractUsage(body) {
  let input = objectBody(body);
  let usage = input ? input.usage || {} : {};
  let inputTokens = Number(usage.prompt_tokens || usage.input_tokens || 0);
  let outputTokens = Number(usage.completion_tokens || usage.output_tokens || 0);
  let totalTokens = Number(usage.total_tokens || 0);
  if (totalTokens <= 0) {
    totalTokens = inputTokens + outputTokens;
  }
  return {
    prompt_tokens: inputTokens,
    completion_tokens: outputTokens,
    total_tokens: totalTokens,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  };
}
