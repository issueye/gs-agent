import { ProtocolAnthropic, ProtocolOpenAIChat, ProtocolOpenAIResponses } from "@/services/protocols";

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

function parseToolArguments(value) {
  if (!value) {
    return {};
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (err) {
      return {};
    }
  }
  return value;
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

function anthropicToolUses(content) {
  let out = [];
  if (!Array.isArray(content)) {
    return out;
  }
  for (let item of content) {
    if (!item || item.type !== "tool_use") {
      continue;
    }
    out.push({
      id: item.id || "",
      name: item.name || "",
      input: item.input || {},
    });
  }
  return out;
}

function chatToolCallsFromAnthropic(content) {
  let out = [];
  for (let item of anthropicToolUses(content)) {
    let toolCall = {
      id: item.id,
      type: "function",
    };
    toolCall["function"] = {
      name: item.name,
      arguments: JSON.stringify(item.input || {}),
    };
    out.push(toolCall);
  }
  return out;
}

function responsePartText(part) {
  if (!part) {
    return "";
  }
  return String(part.text || part.output_text || part.input_text || "");
}

function responseContentText(content) {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return String(content || "");
  }
  let out = [];
  for (let part of content) {
    let text = responsePartText(part);
    if (text !== "") {
      out.push(text);
    }
  }
  return out.join("");
}

function responsesInputToMessages(input) {
  if (typeof input === "string") {
    return [{
      role: "user",
      content: input,
    }];
  }
  if (!Array.isArray(input)) {
    return [{
      role: "user",
      content: String(input || ""),
    }];
  }
  let messages = [];
  for (let item of input) {
    if (!item) {
      continue;
    }
    let role = String(item.role || "user");
    if (role === "developer") {
      role = "system";
    }
    if (role !== "system" && role !== "assistant") {
      role = "user";
    }
    messages.push({
      role: role,
      content: responseContentText(item.content),
    });
  }
  if (messages.length === 0) {
    messages.push({
      role: "user",
      content: "",
    });
  }
  return messages;
}

function chatMessagesToResponsesInput(messages) {
  let input = [];
  for (let message of messages || []) {
    if (!message) {
      continue;
    }
    let role = String(message.role || "user");
    if (role === "system") {
      role = "developer";
    }
    let contentType = role === "assistant" ? "output_text" : "input_text";
    input.push({
      type: "message",
      role: role,
      content: [{
        type: contentType,
        text: textFromContent(message.content),
      }],
    });
    if (role === "assistant") {
      for (let toolCall of message.tool_calls || []) {
        let fn = toolCall["function"] || {};
        input.push({
          type: "function_call",
          call_id: toolCall.id || "",
          name: fn.name || "",
          arguments: String(fn.arguments || "{}"),
        });
      }
    }
    if (role === "tool") {
      input.push({
        type: "function_call_output",
        call_id: message.tool_call_id || "",
        output: textFromContent(message.content),
      });
    }
  }
  return input;
}

function anthropicMessagesToResponsesInput(system, messages) {
  let input = [];
  let sys = textFromContent(system);
  if (sys !== "") {
    input.push({
      type: "message",
      role: "developer",
      content: [{
        type: "input_text",
        text: sys,
      }],
    });
  }
  for (let message of messages || []) {
    if (!message) {
      continue;
    }
    let role = String(message.role || "user");
    let contentType = role === "assistant" ? "output_text" : "input_text";
    input.push({
      type: "message",
      role: role,
      content: [{
        type: contentType,
        text: openAIContentFromAnthropic(message.content),
      }],
    });
    if (role === "assistant") {
      for (let toolUse of anthropicToolUses(message.content)) {
        input.push({
          type: "function_call",
          call_id: toolUse.id,
          name: toolUse.name,
          arguments: JSON.stringify(toolUse.input || {}),
        });
      }
    }
  }
  return input;
}

function anthropicToolsFromOpenAI(tools) {
  if (!Array.isArray(tools)) {
    return undefined;
  }
  let out = [];
  for (let tool of tools) {
    let fn = tool ? tool["function"] : undefined;
    if (!tool || tool.type !== "function" || !fn) {
      continue;
    }
    out.push({
      name: fn.name || "",
      description: fn.description || "",
      input_schema: fn.parameters || {
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
    let content = openAIContentFromAnthropic(message.content);
    if (content === "" && message.content !== undefined && message.content !== null) {
      content = String(message.content || "");
    }
    out.messages.push({
      role: String(message.role || "user"),
      content: content,
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

function convertResponsesRequestToOpenAIChat(body, model) {
  let input = objectBody(body);
  let out = {
    model: model,
    messages: responsesInputToMessages(input.input),
  };
  if (input.instructions) {
    out.messages.unshift({
      role: "system",
      content: String(input.instructions || ""),
    });
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
  if ("max_output_tokens" in input) {
    out.max_tokens = input.max_output_tokens;
  }
  return out;
}

function convertOpenAIChatRequestToResponses(body, model) {
  let input = objectBody(body);
  let out = {
    model: model,
    input: chatMessagesToResponsesInput(input.messages || []),
    stream: input.stream === true,
    store: false,
  };
  if (input.max_tokens || input.max_completion_tokens) {
    out.max_output_tokens = Number(input.max_completion_tokens || input.max_tokens);
  }
  if ("temperature" in input) {
    out.temperature = input.temperature;
  }
  if ("top_p" in input) {
    out.top_p = input.top_p;
  }
  return out;
}

function convertResponsesRequestToAnthropic(body, model, defaultMaxTokens) {
  let chat = convertResponsesRequestToOpenAIChat(body, model);
  return convertOpenAIChatRequestToAnthropic(chat, model, defaultMaxTokens);
}

function convertAnthropicRequestToResponses(body, model) {
  let input = objectBody(body);
  let out = {
    model: model,
    input: anthropicMessagesToResponsesInput(input.system, input.messages || []),
    stream: input.stream === true,
    store: false,
  };
  if (input.max_tokens) {
    out.max_output_tokens = input.max_tokens;
  }
  if ("temperature" in input) {
    out.temperature = input.temperature;
  }
  if ("top_p" in input) {
    out.top_p = input.top_p;
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
  let toolCalls = chatToolCallsFromAnthropic(input.content);
  let message = {
    role: "assistant",
    content: openAIContentFromAnthropic(input.content),
  };
  if (toolCalls.length > 0) {
    message.tool_calls = toolCalls;
  }
  return {
    id: input.id || "",
    object: "chat.completion",
    created: created,
    model: model || input.model || "",
    choices: [{
      index: 0,
      message: message,
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
  let content = [];
  let text = String(message.content || "");
  if (text !== "") {
    content.push({
      type: "text",
      text: text,
    });
  }
  for (let toolCall of message.tool_calls || []) {
    let fn = toolCall["function"] || {};
    content.push({
      type: "tool_use",
      id: toolCall.id || "",
      name: fn.name || "",
      input: parseToolArguments(fn.arguments),
    });
  }
  if (content.length === 0) {
    content.push({
      type: "text",
      text: "",
    });
  }
  return {
    id: input.id || "",
    type: "message",
    role: "assistant",
    model: model || input.model || "",
    content: content,
    stop_reason: choice.finish_reason || "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
    },
  };
}

function outputTextFromResponses(body) {
  let input = objectBody(body);
  let parts = [];
  for (let item of input.output || []) {
    if (!item || item.type !== "message") {
      continue;
    }
    for (let part of item.content || []) {
      if (part && part.type === "output_text") {
        parts.push(String(part.text || ""));
      }
    }
  }
  return parts.join("");
}

function responseFunctionCalls(body) {
  let input = objectBody(body);
  let out = [];
  for (let item of input.output || []) {
    if (!item || item.type !== "function_call") {
      continue;
    }
    out.push({
      call_id: item.call_id || item.callID || "",
      name: item.name || "",
      arguments: String(item.arguments || "{}"),
    });
  }
  return out;
}

function convertResponsesResponseToOpenAIChat(body, model) {
  let input = objectBody(body);
  let usage = extractUsage(input);
  let toolCalls = [];
  for (let item of responseFunctionCalls(input)) {
    let toolCall = {
      id: item.call_id,
      type: "function",
    };
    toolCall["function"] = {
      name: item.name,
      arguments: item.arguments,
    };
    toolCalls.push(toolCall);
  }
  let message = {
    role: "assistant",
    content: outputTextFromResponses(input),
  };
  if (toolCalls.length > 0) {
    message.tool_calls = toolCalls;
  }
  return {
    id: input.id || "chatcmpl-" + String((new Date()).getTime()),
    object: "chat.completion",
    created: Math.floor((new Date()).getTime() / 1000),
    model: model || input.model || "",
    choices: [{
      index: 0,
      message: message,
      finish_reason: toolCalls.length > 0 ? "tool_calls" : (input.status === "incomplete" ? "length" : "stop"),
    }],
    usage: usage,
  };
}

function convertOpenAIChatResponseToResponses(body, model) {
  let input = objectBody(body);
  let choice = (input.choices || [])[0] || {};
  let message = choice.message || {};
  let usage = extractUsage(input);
  let output = [];
  let text = String(message.content || "");
  if (text !== "") {
    output.push({
      type: "message",
      role: "assistant",
      content: [{
        type: "output_text",
        text: text,
      }],
    });
  }
  for (let toolCall of message.tool_calls || []) {
    let fn = toolCall["function"] || {};
    output.push({
      type: "function_call",
      call_id: toolCall.id || "",
      name: fn.name || "",
      arguments: String(fn.arguments || "{}"),
    });
  }
  if (output.length === 0) {
    output.push({
      type: "message",
      role: "assistant",
      content: [{
        type: "output_text",
        text: "",
      }],
    });
  }
  return {
    id: input.id || "resp-" + String((new Date()).getTime()),
    object: "response",
    status: "completed",
    model: model || input.model || "",
    output: output,
    usage: {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      total_tokens: usage.total_tokens,
    },
  };
}

function convertResponsesResponseToAnthropic(body, model) {
  let input = objectBody(body);
  let usage = extractUsage(input);
  let content = [];
  let text = outputTextFromResponses(input);
  if (text !== "") {
    content.push({
      type: "text",
      text: text,
    });
  }
  for (let item of responseFunctionCalls(input)) {
    content.push({
      type: "tool_use",
      id: item.call_id,
      name: item.name,
      input: parseToolArguments(item.arguments),
    });
  }
  if (content.length === 0) {
    content.push({
      type: "text",
      text: "",
    });
  }
  return {
    id: input.id || "msg-" + String((new Date()).getTime()),
    type: "message",
    role: "assistant",
    model: model || input.model || "",
    content: content,
    stop_reason: content.length > 0 && content[0].type === "tool_use" ? "tool_use" : (input.status === "incomplete" ? "max_tokens" : "end_turn"),
    stop_sequence: null,
    usage: {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
    },
  };
}

function convertAnthropicResponseToResponses(body, model) {
  let input = objectBody(body);
  let usage = extractUsage(input);
  let output = [];
  let text = openAIContentFromAnthropic(input.content);
  if (text !== "") {
    output.push({
      type: "message",
      role: "assistant",
      content: [{
        type: "output_text",
        text: text,
      }],
    });
  }
  for (let toolUse of anthropicToolUses(input.content)) {
    output.push({
      type: "function_call",
      call_id: toolUse.id,
      name: toolUse.name,
      arguments: JSON.stringify(toolUse.input || {}),
    });
  }
  if (output.length === 0) {
    output.push({
      type: "message",
      role: "assistant",
      content: [{
        type: "output_text",
        text: "",
      }],
    });
  }
  return {
    id: input.id || "resp-" + String((new Date()).getTime()),
    object: "response",
    status: "completed",
    model: model || input.model || "",
    output: output,
    usage: {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      total_tokens: usage.total_tokens,
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
  if (downstream === ProtocolOpenAIResponses && upstream === ProtocolOpenAIChat) {
    return convertResponsesRequestToOpenAIChat(body, model);
  }
  if (downstream === ProtocolOpenAIChat && upstream === ProtocolOpenAIResponses) {
    return convertOpenAIChatRequestToResponses(body, model);
  }
  if (downstream === ProtocolOpenAIResponses && upstream === ProtocolAnthropic) {
    return convertResponsesRequestToAnthropic(body, model, defaultMaxTokens);
  }
  if (downstream === ProtocolAnthropic && upstream === ProtocolOpenAIResponses) {
    return convertAnthropicRequestToResponses(body, model);
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
  if (downstream === ProtocolOpenAIResponses && upstream === ProtocolOpenAIChat) {
    return convertOpenAIChatResponseToResponses(body, model);
  }
  if (downstream === ProtocolOpenAIChat && upstream === ProtocolOpenAIResponses) {
    return convertResponsesResponseToOpenAIChat(body, model);
  }
  if (downstream === ProtocolOpenAIResponses && upstream === ProtocolAnthropic) {
    return convertAnthropicResponseToResponses(body, model);
  }
  if (downstream === ProtocolAnthropic && upstream === ProtocolOpenAIResponses) {
    return convertResponsesResponseToAnthropic(body, model);
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
