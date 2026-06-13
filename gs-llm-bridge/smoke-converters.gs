import { convertRequest, convertResponse } from "@/services/converters";
import { convertStream } from "@/services/stream_converters";
import { ProtocolAnthropic, ProtocolOpenAIChat, ProtocolOpenAIResponses } from "@/services/protocols";

let stream = require("@std/stream");

let model = "smoke-target-model";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message + ": expected=" + JSON.stringify(expected) + " actual=" + JSON.stringify(actual));
  }
}

function assertContains(text, expected, message) {
  if (String(text || "").indexOf(expected) < 0) {
    throw new Error(message + ": missing=" + JSON.stringify(expected) + " text=" + JSON.stringify(String(text || "")));
  }
}

function assertNotContains(text, expected, message) {
  if (String(text || "").indexOf(expected) >= 0) {
    throw new Error(message + ": unexpected=" + JSON.stringify(expected) + " text=" + JSON.stringify(String(text || "")));
  }
}

function parseJSON(text, message) {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(message + ": " + String(err));
  }
}

function outputItems(output, type) {
  let out = [];
  for (let item of output || []) {
    if (item && item.type === type) {
      out.push(item);
    }
  }
  return out;
}

function captureStream(downstream, upstream, sseText) {
  let chunks = [];
  let res = {
    write: function(text) {
      chunks.push(String(text || ""));
    },
    flush: function() {},
    end: function() {},
  };
  let result = convertStream(downstream, upstream, {
    body: stream.fromString(sseText),
  }, res, model) || {};
  return {
    body: chunks.join(""),
    result: result,
  };
}

let chatRequest = {
  model: "chat-source-model",
  messages: [
    {
      role: "system",
      content: "Answer tersely.",
    },
    {
      role: "user",
      content: "What is the weather in Paris?",
    },
  ],
  tools: [
    {
      type: "function",
      "function": {
        name: "get_weather",
        description: "Fetch weather.",
        parameters: {
          type: "object",
          properties: {
            city: {
              type: "string",
            },
          },
          required: ["city"],
        },
      },
    },
  ],
  max_tokens: 128,
};

let chatToAnthropic = convertRequest(ProtocolOpenAIChat, ProtocolAnthropic, chatRequest, model, 1024);
assertEqual(chatToAnthropic.model, model, "chat request to anthropic rewrites model");
assertEqual(chatToAnthropic.system, "Answer tersely.", "chat request to anthropic maps system");
assertEqual(chatToAnthropic.messages.length, 1, "chat request to anthropic keeps user message");
assertEqual(chatToAnthropic.messages[0].content, "What is the weather in Paris?", "chat request to anthropic maps text");
assertEqual(chatToAnthropic.tools.length, 1, "chat request to anthropic maps tools");
assertEqual(chatToAnthropic.tools[0].name, "get_weather", "chat request to anthropic maps tool name");

let responsesRequest = {
  model: "responses-source-model",
  instructions: "Use short sentences.",
  input: [
    {
      type: "message",
      role: "user",
      content: [
        {
          type: "input_text",
          text: "Summarize the plan.",
        },
      ],
    },
  ],
  max_output_tokens: 64,
};

let responsesToAnthropic = convertRequest(ProtocolOpenAIResponses, ProtocolAnthropic, responsesRequest, model, 1024);
assertEqual(responsesToAnthropic.model, model, "responses request to anthropic rewrites model");
assertEqual(responsesToAnthropic.system, "Use short sentences.", "responses request to anthropic maps instructions");
assertEqual(responsesToAnthropic.messages[0].content, "Summarize the plan.", "responses request to anthropic maps input text");
assertEqual(responsesToAnthropic.max_tokens, 64, "responses request to anthropic maps max output tokens");

let chatToolResultRequest = {
  model: "chat-source-model",
  messages: [
    {
      role: "user",
      content: "Look up two things.",
    },
    {
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id: "call_weather",
          type: "function",
          "function": {
            name: "get_weather",
            arguments: "{\"city\":\"Paris\"}",
          },
        },
        {
          id: "call_time",
          type: "function",
          "function": {
            name: "get_time",
            arguments: "{\"city\":\"Paris\"}",
          },
        },
      ],
    },
    {
      role: "tool",
      tool_call_id: "call_weather",
      content: "{\"temperature\":\"18C\"}",
    },
  ],
};

let chatToolResultToResponses = convertRequest(ProtocolOpenAIChat, ProtocolOpenAIResponses, chatToolResultRequest, model, 1024);
let responseFunctionCalls = outputItems(chatToolResultToResponses.input, "function_call");
let responseToolResults = outputItems(chatToolResultToResponses.input, "function_call_output");
assertEqual(chatToolResultToResponses.model, model, "chat tool-result request to responses rewrites model");
assertEqual(responseFunctionCalls.length, 2, "chat tool-result request to responses maps multiple tool calls");
assertEqual(responseFunctionCalls[0].call_id, "call_weather", "chat tool-result request to responses maps first call id");
assertEqual(responseFunctionCalls[1].name, "get_time", "chat tool-result request to responses maps second call name");
assertEqual(responseToolResults.length, 1, "chat tool-result request to responses maps tool result");
assertEqual(responseToolResults[0].call_id, "call_weather", "chat tool-result request to responses maps tool result call id");

let anthropicToolRequest = {
  model: "anthropic-source-model",
  system: "Use tools when useful.",
  messages: [
    {
      role: "user",
      content: "Check Paris.",
    },
    {
      role: "assistant",
      content: [
        {
          type: "text",
          text: "I will check.",
        },
        {
          type: "tool_use",
          id: "toolu_weather",
          name: "get_weather",
          input: {
            city: "Paris",
          },
        },
      ],
    },
  ],
  max_tokens: 200,
};

let anthropicToolToResponses = convertRequest(ProtocolAnthropic, ProtocolOpenAIResponses, anthropicToolRequest, model, 1024);
let anthropicResponseCalls = outputItems(anthropicToolToResponses.input, "function_call");
assertEqual(anthropicToolToResponses.model, model, "anthropic tool request to responses rewrites model");
assertEqual(anthropicResponseCalls.length, 1, "anthropic tool request to responses maps tool use");
assertEqual(anthropicResponseCalls[0].call_id, "toolu_weather", "anthropic tool request to responses maps call id");
assertEqual(parseJSON(anthropicResponseCalls[0].arguments, "anthropic tool arguments").city, "Paris", "anthropic tool request to responses maps arguments");

let anthropicToolResponse = {
  id: "msg_tool_multi",
  type: "message",
  role: "assistant",
  model: "anthropic-source-model",
  content: [
    {
      type: "text",
      text: "Need two lookups.",
    },
    {
      type: "tool_use",
      id: "toolu_weather",
      name: "get_weather",
      input: {
        city: "Paris",
      },
    },
    {
      type: "tool_use",
      id: "toolu_time",
      name: "get_time",
      input: {
        city: "Paris",
      },
    },
  ],
  stop_reason: "tool_use",
  usage: {
    input_tokens: 11,
    output_tokens: 7,
  },
};

let anthropicToChat = convertResponse(ProtocolOpenAIChat, ProtocolAnthropic, anthropicToolResponse, model);
let chatToolCalls = anthropicToChat.choices[0].message.tool_calls || [];
assertEqual(anthropicToChat.model, model, "anthropic response to chat rewrites model");
assertEqual(anthropicToChat.choices[0].message.content, "Need two lookups.", "anthropic response to chat maps text");
assertEqual(chatToolCalls.length, 2, "anthropic response to chat maps multiple tool calls");
assertEqual(chatToolCalls[0].id, "toolu_weather", "anthropic response to chat maps first tool id");
assertEqual(parseJSON(chatToolCalls[1]["function"].arguments, "chat tool arguments").city, "Paris", "anthropic response to chat maps second tool arguments");
assertEqual(anthropicToChat.choices[0].finish_reason, "tool_calls", "anthropic response to chat maps tool finish reason");

let chatToolResponse = {
  id: "chatcmpl_tool_multi",
  object: "chat.completion",
  model: "chat-source-model",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: "Need two lookups.",
        tool_calls: [
          {
            id: "call_weather",
            type: "function",
            "function": {
              name: "get_weather",
              arguments: "{\"city\":\"Paris\"}",
            },
          },
          {
            id: "call_time",
            type: "function",
            "function": {
              name: "get_time",
              arguments: "{\"city\":\"Paris\"}",
            },
          },
        ],
      },
      finish_reason: "tool_calls",
    },
  ],
  usage: {
    prompt_tokens: 13,
    completion_tokens: 9,
    total_tokens: 22,
  },
};

let chatToAnthropicResponse = convertResponse(ProtocolAnthropic, ProtocolOpenAIChat, chatToolResponse, model);
assertEqual(chatToAnthropicResponse.model, model, "chat response to anthropic rewrites model");
assertEqual(chatToAnthropicResponse.content.length, 3, "chat response to anthropic maps text and multiple tool calls");
assertEqual(chatToAnthropicResponse.content[1].type, "tool_use", "chat response to anthropic maps tool use");
assertEqual(chatToAnthropicResponse.content[2].name, "get_time", "chat response to anthropic maps second tool name");
assertEqual(chatToAnthropicResponse.usage.input_tokens, 13, "chat response to anthropic maps usage");

let responsesToolResponse = {
  id: "resp_tool_multi",
  object: "response",
  status: "completed",
  model: "responses-source-model",
  output: [
    {
      type: "message",
      role: "assistant",
      content: [
        {
          type: "output_text",
          text: "Need two lookups.",
        },
      ],
    },
    {
      type: "function_call",
      call_id: "call_weather",
      name: "get_weather",
      arguments: "{\"city\":\"Paris\"}",
    },
    {
      type: "function_call",
      call_id: "call_time",
      name: "get_time",
      arguments: "{\"city\":\"Paris\"}",
    },
  ],
  usage: {
    input_tokens: 5,
    output_tokens: 8,
    total_tokens: 13,
  },
};

let responsesToChat = convertResponse(ProtocolOpenAIChat, ProtocolOpenAIResponses, responsesToolResponse, model);
assertEqual(responsesToChat.model, model, "responses response to chat rewrites model");
assertEqual(responsesToChat.choices[0].message.content, "Need two lookups.", "responses response to chat maps text");
assertEqual(responsesToChat.choices[0].message.tool_calls.length, 2, "responses response to chat maps multiple tool calls");
assertEqual(responsesToChat.choices[0].finish_reason, "tool_calls", "responses response to chat maps finish reason");

let anthropicTextResponse = {
  id: "msg_text",
  type: "message",
  role: "assistant",
  model: "anthropic-source-model",
  content: [
    {
      type: "text",
      text: "Plain text works.",
    },
  ],
  stop_reason: "end_turn",
  usage: {
    input_tokens: 3,
    output_tokens: 4,
  },
};

let anthropicTextToResponses = convertResponse(ProtocolOpenAIResponses, ProtocolAnthropic, anthropicTextResponse, model);
assertEqual(anthropicTextToResponses.model, model, "anthropic text response to responses rewrites model");
assertEqual(anthropicTextToResponses.output[0].content[0].text, "Plain text works.", "anthropic text response to responses maps text");
assertEqual(anthropicTextToResponses.usage.total_tokens, 7, "anthropic text response to responses maps total usage");

let chatStreamToAnthropic = captureStream(
  ProtocolAnthropic,
  ProtocolOpenAIChat,
  "data: {\"id\":\"chatcmpl-stream\",\"object\":\"chat.completion.chunk\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\"}}]}\n\n" +
  "data: {\"id\":\"chatcmpl-stream\",\"object\":\"chat.completion.chunk\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"stream ok\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":21,\"completion_tokens\":8,\"total_tokens\":29}}\n\n" +
  "data: [DONE]\n\n" +
  "data: this should be ignored\n\n" +
  "data: {\"id\":\"chatcmpl-stream\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"after done\"}}]}\n\n"
);
assertContains(chatStreamToAnthropic.body, "event: content_block_delta", "chat stream to anthropic writes content delta");
assertContains(chatStreamToAnthropic.body, "stream ok", "chat stream to anthropic maps text");
assertNotContains(chatStreamToAnthropic.body, "after done", "chat stream to anthropic stops at DONE");
assertEqual(chatStreamToAnthropic.result.usage.input_tokens, 21, "chat stream to anthropic maps input usage");
assertEqual(chatStreamToAnthropic.result.usage.output_tokens, 8, "chat stream to anthropic maps output usage");
assertEqual(chatStreamToAnthropic.result.usage.total_tokens, 29, "chat stream to anthropic maps total usage");
assertEqual(chatStreamToAnthropic.result.error, "", "chat stream to anthropic ignores data after DONE");

let chatToolStreamToResponses = captureStream(
  ProtocolOpenAIResponses,
  ProtocolOpenAIChat,
  "data: {\"id\":\"chatcmpl-tool-stream\",\"object\":\"chat.completion.chunk\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\"}}]}\n\n" +
  "data: {\"id\":\"chatcmpl-tool-stream\",\"object\":\"chat.completion.chunk\",\"choices\":[{\"index\":0,\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"call_weather\",\"type\":\"function\",\"function\":{\"name\":\"get_weather\",\"arguments\":\"\"}}]}}]}\n\n" +
  "data: {\"id\":\"chatcmpl-tool-stream\",\"object\":\"chat.completion.chunk\",\"choices\":[{\"index\":0,\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"arguments\":\"{\\\"city\\\":\"}}]}}]}\n\n" +
  "data: {\"id\":\"chatcmpl-tool-stream\",\"object\":\"chat.completion.chunk\",\"choices\":[{\"index\":0,\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"arguments\":\"\\\"Paris\\\"}\"}}]},\"finish_reason\":\"tool_calls\"}],\"usage\":{\"prompt_tokens\":12,\"completion_tokens\":3}}\n\n" +
  "data: [DONE]\n\n" +
  "data: {\"id\":\"chatcmpl-tool-stream\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"after done\"}}]}\n\n"
);
assertContains(chatToolStreamToResponses.body, "event: response.output_item.added", "chat tool stream to responses starts function call");
assertContains(chatToolStreamToResponses.body, "\"name\":\"get_weather\"", "chat tool stream to responses maps tool name");
assertContains(chatToolStreamToResponses.body, "event: response.function_call_arguments.delta", "chat tool stream to responses maps argument delta");
assertContains(chatToolStreamToResponses.body, "event: response.function_call_arguments.done", "chat tool stream to responses closes arguments");
assertNotContains(chatToolStreamToResponses.body, "after done", "chat tool stream to responses stops at DONE");
assertEqual(chatToolStreamToResponses.result.usage.input_tokens, 12, "chat tool stream to responses maps input usage");
assertEqual(chatToolStreamToResponses.result.usage.output_tokens, 3, "chat tool stream to responses maps output usage");
assertEqual(chatToolStreamToResponses.result.usage.total_tokens, 15, "chat tool stream to responses calculates total usage");

let anthropicToolStreamToChat = captureStream(
  ProtocolOpenAIChat,
  ProtocolAnthropic,
  "event: message_start\n" +
  "data: {\"type\":\"message_start\",\"message\":{\"id\":\"msg-tool-stream\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\"anthropic-source-model\",\"content\":[],\"stop_reason\":null,\"stop_sequence\":null,\"usage\":{\"input_tokens\":12,\"output_tokens\":0}}}\n\n" +
  "data: this is not json\n\n" +
  "event: content_block_start\n" +
  "data: {\"type\":\"content_block_start\",\"index\":0,\"content_block\":{\"type\":\"tool_use\",\"id\":\"toolu_weather\",\"name\":\"get_weather\",\"input\":{}}}\n\n" +
  "event: content_block_delta\n" +
  "data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"input_json_delta\",\"partial_json\":\"{\\\"city\\\":\"}}\n\n" +
  "event: content_block_delta\n" +
  "data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"input_json_delta\",\"partial_json\":\"\\\"Paris\\\"}\"}}\n\n" +
  "event: message_delta\n" +
  "data: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"tool_use\",\"stop_sequence\":null},\"usage\":{\"output_tokens\":3}}\n\n" +
  "event: message_stop\n" +
  "data: {\"type\":\"message_stop\"}\n\n"
);
assertContains(anthropicToolStreamToChat.body, "\"tool_calls\"", "anthropic tool stream to chat maps tool calls");
assertContains(anthropicToolStreamToChat.body, "\"id\":\"toolu_weather\"", "anthropic tool stream to chat maps tool id");
assertContains(anthropicToolStreamToChat.body, "\"finish_reason\":\"tool_calls\"", "anthropic tool stream to chat maps tool finish reason");
assertContains(anthropicToolStreamToChat.body, "data: [DONE]", "anthropic tool stream to chat writes DONE");
assertEqual(anthropicToolStreamToChat.result.usage.input_tokens, 12, "anthropic tool stream to chat maps input usage");
assertEqual(anthropicToolStreamToChat.result.usage.output_tokens, 3, "anthropic tool stream to chat maps output usage");
assertEqual(anthropicToolStreamToChat.result.usage.total_tokens, 15, "anthropic tool stream to chat calculates total usage");
assertEqual(anthropicToolStreamToChat.result.error, "invalid SSE JSON", "anthropic tool stream to chat reports invalid SSE");

let responsesToolStreamToChat = captureStream(
  ProtocolOpenAIChat,
  ProtocolOpenAIResponses,
  "event: response.created\n" +
  "data: {\"type\":\"response.created\",\"response\":{\"id\":\"resp-tool-stream\",\"object\":\"response\",\"status\":\"in_progress\",\"model\":\"responses-source-model\",\"output\":[]}}\n\n" +
  "event: response.output_item.added\n" +
  "data: {\"type\":\"response.output_item.added\",\"output_index\":0,\"item\":{\"id\":\"fc_weather\",\"type\":\"function_call\",\"call_id\":\"call_weather\",\"name\":\"get_weather\",\"arguments\":\"\"}}\n\n" +
  "event: response.function_call_arguments.delta\n" +
  "data: {\"type\":\"response.function_call_arguments.delta\",\"item_id\":\"fc_weather\",\"output_index\":0,\"delta\":\"{\\\"city\\\":\"}\n\n" +
  "event: response.function_call_arguments.delta\n" +
  "data: {\"type\":\"response.function_call_arguments.delta\",\"item_id\":\"fc_weather\",\"output_index\":0,\"delta\":\"\\\"Paris\\\"}\"}\n\n" +
  "event: response.function_call_arguments.done\n" +
  "data: {\"type\":\"response.function_call_arguments.done\",\"item_id\":\"fc_weather\",\"output_index\":0,\"arguments\":\"{\\\"city\\\":\\\"Paris\\\"}\"}\n\n" +
  "event: response.completed\n" +
  "data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp-tool-stream\",\"object\":\"response\",\"status\":\"completed\",\"model\":\"responses-source-model\",\"output\":[],\"usage\":{\"input_tokens\":9,\"output_tokens\":4,\"total_tokens\":13}}}\n\n"
);
assertContains(responsesToolStreamToChat.body, "\"tool_calls\"", "responses tool stream to chat maps tool calls");
assertContains(responsesToolStreamToChat.body, "\"name\":\"get_weather\"", "responses tool stream to chat maps tool name");
assertContains(responsesToolStreamToChat.body, "\"finish_reason\":\"tool_calls\"", "responses tool stream to chat maps tool finish reason");
assertContains(responsesToolStreamToChat.body, "data: [DONE]", "responses tool stream to chat writes DONE");
assertEqual(responsesToolStreamToChat.result.usage.input_tokens, 9, "responses tool stream to chat maps input usage");
assertEqual(responsesToolStreamToChat.result.usage.output_tokens, 4, "responses tool stream to chat maps output usage");
assertEqual(responsesToolStreamToChat.result.usage.total_tokens, 13, "responses tool stream to chat maps total usage");

println("converter smoke ok");
