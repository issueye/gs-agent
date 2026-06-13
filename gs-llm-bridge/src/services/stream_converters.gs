import { ProtocolAnthropic, ProtocolOpenAIChat, ProtocolOpenAIResponses } from "@/services/protocols";

let sse = require("@std/sse");

function parseJSON(text) {
  try {
    return JSON.parse(String(text || ""));
  } catch (err) {
    return undefined;
  }
}

function streamResult() {
  return {
    usage: {},
    error: "",
  };
}

function noteInvalidJSON(result, event) {
  if (String((event || {}).data || "").trim() !== "" && result.error === "") {
    result.error = "invalid SSE JSON";
  }
}

function mergeUsage(target, usage) {
  let item = usage || {};
  let inputTokens = Number(item.prompt_tokens || item.input_tokens || 0);
  let outputTokens = Number(item.completion_tokens || item.output_tokens || 0);
  let totalTokens = Number(item.total_tokens || 0);
  if (inputTokens > 0) {
    target.input_tokens = inputTokens;
    target.prompt_tokens = inputTokens;
  }
  if (outputTokens > 0) {
    target.output_tokens = outputTokens;
    target.completion_tokens = outputTokens;
  }
  if (totalTokens > 0) {
    target.total_tokens = totalTokens;
  } else {
    let total = Number(target.input_tokens || target.prompt_tokens || 0) + Number(target.output_tokens || target.completion_tokens || 0);
    if (total > 0) {
      target.total_tokens = total;
    }
  }
}

function usageFromPayload(result, payload) {
  let body = payload || {};
  if (body.usage) {
    mergeUsage(result.usage, body.usage);
  }
  if (body.message && body.message.usage) {
    mergeUsage(result.usage, body.message.usage);
  }
  if (body.response && body.response.usage) {
    mergeUsage(result.usage, body.response.usage);
  }
}

function sseData(value) {
  return "data: " + JSON.stringify(value) + "\n\n";
}

function writeSSE(res, value) {
  res.write(sseData(value));
  res.flush();
}

function writeEvent(res, name, value) {
  res.write("event: " + name + "\n");
  res.write(sseData(value));
  res.flush();
}

function firstSSEEvent(text) {
  let events = sse.parse(String(text || ""));
  for (let event of events || []) {
    if (String((event || {}).data || "").trim() !== "") {
      return event;
    }
  }
  return undefined;
}

function errorMessageFromPayload(payload) {
  let body = payload || {};
  if (body.error) {
    if (typeof body.error === "string") {
      return body.error;
    }
    return String(body.error.message || body.error.type || JSON.stringify(body.error || {}));
  }
  if (body.type === "error") {
    return String(body.message || JSON.stringify(body || {}));
  }
  return "";
}

function usageForStream(body) {
  let value = (body || {}).usage || {};
  let inputTokens = Number(value.prompt_tokens || value.input_tokens || 0);
  let outputTokens = Number(value.completion_tokens || value.output_tokens || 0);
  let totalTokens = Number(value.total_tokens || 0);
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

function streamChatResponse(body, res, model, includeUsage) {
  let input = body || {};
  let choice = (input.choices || [])[0] || {};
  let message = choice.message || {};
  let id = input.id || "chatcmpl-" + String((new Date()).getTime());
  let created = Number(input.created || Math.floor((new Date()).getTime() / 1000));
  writeSSE(res, chatChunk(id, created, model || input.model || "", {
    role: "assistant",
  }));
  let text = String(message.content || "");
  if (text !== "") {
    writeSSE(res, chatChunk(id, created, model || input.model || "", {
      content: text,
    }));
  }
  for (let i = 0; i < (message.tool_calls || []).length; i = i + 1) {
    let toolCall = message.tool_calls[i] || {};
    let fn = toolCall["function"] || {};
    writeSSE(res, chatChunk(id, created, model || input.model || "", chatToolCallDelta(
      i,
      toolCall.id || "",
      fn.name || "",
      String(fn.arguments || "")
    )));
  }
  writeSSE(res, chatChunk(id, created, model || input.model || "", {}, choice.finish_reason || ((message.tool_calls || []).length > 0 ? "tool_calls" : "stop")));
  if (includeUsage) {
    res.write(sseData({
      id: id,
      object: "chat.completion.chunk",
      created: created,
      model: model || input.model || "",
      choices: [],
      usage: usageForStream(input),
    }));
    res.flush();
  }
  res.write("data: [DONE]\n\n");
  res.flush();
  res.end();
}

function streamAnthropicResponse(body, res, model) {
  let input = body || {};
  let usage = usageForStream(input);
  let id = input.id || "msg-" + String((new Date()).getTime());
  writeEvent(res, "message_start", {
    type: "message_start",
    message: {
      id: id,
      type: "message",
      role: "assistant",
      model: model || input.model || "",
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: usage.input_tokens,
        output_tokens: 0,
      },
    },
  });
  let index = 0;
  for (let item of input.content || []) {
    if (!item) {
      continue;
    }
    if (item.type === "tool_use") {
      writeEvent(res, "content_block_start", {
        type: "content_block_start",
        index: index,
        content_block: {
          type: "tool_use",
          id: item.id || "",
          name: item.name || "",
          input: {},
        },
      });
      writeEvent(res, "content_block_delta", {
        type: "content_block_delta",
        index: index,
        delta: {
          type: "input_json_delta",
          partial_json: JSON.stringify(item.input || {}),
        },
      });
    } else {
      writeEvent(res, "content_block_start", {
        type: "content_block_start",
        index: index,
        content_block: {
          type: "text",
          text: "",
        },
      });
      writeEvent(res, "content_block_delta", {
        type: "content_block_delta",
        index: index,
        delta: {
          type: "text_delta",
          text: String(item.text || ""),
        },
      });
    }
    writeEvent(res, "content_block_stop", {
      type: "content_block_stop",
      index: index,
    });
    index = index + 1;
  }
  writeEvent(res, "message_delta", {
    type: "message_delta",
    delta: {
      stop_reason: input.stop_reason || "end_turn",
      stop_sequence: input.stop_sequence || null,
    },
    usage: {
      output_tokens: usage.output_tokens,
    },
  });
  writeEvent(res, "message_stop", {
    type: "message_stop",
  });
  res.end();
}

function responseTextFromItem(item) {
  let parts = [];
  for (let part of (item || {}).content || []) {
    if (part && (part.type === "output_text" || part.type === "text")) {
      parts.push(String(part.text || ""));
    }
  }
  return parts.join("");
}

function streamResponsesResponse(body, res, model) {
  let input = body || {};
  let id = input.id || "resp-" + String((new Date()).getTime());
  writeEvent(res, "response.created", {
    type: "response.created",
    response: {
      id: id,
      object: "response",
      status: "in_progress",
      model: model || input.model || "",
      output: [],
    },
  });
  let outputIndex = 0;
  for (let item of input.output || []) {
    if (!item) {
      continue;
    }
    if (item.type === "function_call") {
      writeEvent(res, "response.output_item.added", {
        type: "response.output_item.added",
        output_index: outputIndex,
        item: responseFunctionItem(item.id || "fc_" + String(outputIndex), item.call_id || item.callID || "", item.name || "", ""),
      });
      writeEvent(res, "response.function_call_arguments.delta", {
        type: "response.function_call_arguments.delta",
        item_id: item.id || "fc_" + String(outputIndex),
        output_index: outputIndex,
        delta: String(item.arguments || ""),
      });
      writeEvent(res, "response.function_call_arguments.done", {
        type: "response.function_call_arguments.done",
        item_id: item.id || "fc_" + String(outputIndex),
        output_index: outputIndex,
        arguments: String(item.arguments || ""),
      });
      writeEvent(res, "response.output_item.done", {
        type: "response.output_item.done",
        output_index: outputIndex,
        item: responseFunctionItem(item.id || "fc_" + String(outputIndex), item.call_id || item.callID || "", item.name || "", String(item.arguments || "")),
      });
    } else {
      let text = responseTextFromItem(item);
      if (text !== "") {
        writeEvent(res, "response.output_text.delta", {
          type: "response.output_text.delta",
          delta: text,
        });
      }
    }
    outputIndex = outputIndex + 1;
  }
  writeEvent(res, "response.completed", {
    type: "response.completed",
    response: {
      id: id,
      object: "response",
      status: input.status || "completed",
      model: model || input.model || "",
      output: input.output || [],
      usage: input.usage || {},
    },
  });
  res.end();
}

function chatToolCallDelta(index, id, name, argumentsDelta) {
  let toolCall = {
    index: index,
    type: "function",
  };
  if (String(id || "") !== "") {
    toolCall.id = id;
  }
  let fn = {};
  if (name !== undefined) {
    fn.name = String(name || "");
  }
  if (argumentsDelta !== undefined) {
    fn.arguments = String(argumentsDelta || "");
  }
  toolCall["function"] = fn;
  return {
    tool_calls: [toolCall],
  };
}

function chatChunk(id, created, model, delta, finishReason) {
  let choice = {
    index: 0,
    delta: delta || {},
  };
  if (finishReason !== undefined) {
    choice.finish_reason = finishReason;
  }
  return {
    id: id,
    object: "chat.completion.chunk",
    created: created,
    model: model,
    choices: [choice],
  };
}

function findBlock(blocks, chatIndex) {
  for (let block of blocks) {
    if (block.chatIndex === chatIndex) {
      return block;
    }
  }
  return undefined;
}

function findResponseStreamCall(calls, chatIndex) {
  for (let call of calls) {
    if (call && call.chatIndex === chatIndex) {
      return call;
    }
  }
  return undefined;
}

function responseFunctionItem(id, callID, name, argumentsText) {
  return {
    id: id,
    type: "function_call",
    call_id: callID,
    name: name,
    arguments: argumentsText || "",
  };
}

function parseToolInput(value) {
  if (!value) {
    return {};
  }
  try {
    return JSON.parse(String(value || "{}"));
  } catch (err) {
    return {};
  }
}

function aggregateOpenAIChatStream(upstream, model) {
  let reader = sse.reader(upstream.body);
  let result = streamResult();
  let id = "chatcmpl-" + String((new Date()).getTime());
  let created = Math.floor((new Date()).getTime() / 1000);
  let content = "";
  let toolCalls = [];
  let finishReason = "stop";
  while (true) {
    let event = reader.next();
    if (event === null) {
      break;
    }
    if (String(event.data || "") === "[DONE]") {
      break;
    }
    let payload = parseJSON(event.data);
    if (!payload) {
      noteInvalidJSON(result, event);
      continue;
    }
    usageFromPayload(result, payload);
    id = payload.id || id;
    created = Number(payload.created || created);
    let choice = (payload.choices || [])[0] || {};
    let delta = choice.delta || {};
    content = content + String(delta.content || "");
    for (let toolCall of delta.tool_calls || []) {
      let index = Number(toolCall.index || 0);
      let existing = toolCalls[index];
      let fn = toolCall["function"] || {};
      if (!existing) {
        existing = {
          id: toolCall.id || "",
          type: "function",
        };
        existing["function"] = {
          name: "",
          arguments: "",
        };
        toolCalls[index] = existing;
      }
      if (String(toolCall.id || "") !== "") {
        existing.id = toolCall.id;
      }
      if (String(fn.name || "") !== "") {
        existing["function"].name = fn.name;
      }
      if (String(fn.arguments || "") !== "") {
        existing["function"].arguments = existing["function"].arguments + String(fn.arguments || "");
      }
    }
    if (choice.finish_reason) {
      finishReason = choice.finish_reason;
    }
  }
  let compactToolCalls = [];
  for (let item of toolCalls) {
    if (item) {
      compactToolCalls.push(item);
    }
  }
  let message = {
    role: "assistant",
    content: content,
  };
  if (compactToolCalls.length > 0) {
    message.tool_calls = compactToolCalls;
    if (finishReason === "stop") {
      finishReason = "tool_calls";
    }
  }
  result.body = {
    id: id,
    object: "chat.completion",
    created: created,
    model: model,
    choices: [{
      index: 0,
      message: message,
      finish_reason: finishReason,
    }],
    usage: result.usage,
  };
  return result;
}

function aggregateAnthropicStream(upstream, model) {
  let reader = sse.reader(upstream.body);
  let result = streamResult();
  let id = "msg-" + String((new Date()).getTime());
  let content = [];
  let blocks = [];
  let stopReason = "end_turn";
  while (true) {
    let event = reader.next();
    if (event === null) {
      break;
    }
    let payload = parseJSON(event.data);
    if (!payload) {
      noteInvalidJSON(result, event);
      continue;
    }
    usageFromPayload(result, payload);
    if (payload.type === "message_start") {
      let message = payload.message || {};
      id = message.id || id;
      continue;
    }
    if (payload.type === "content_block_start") {
      let index = Number(payload.index || 0);
      let block = payload.content_block || {};
      if (block.type === "tool_use") {
        blocks[index] = {
          type: "tool_use",
          id: block.id || "",
          name: block.name || "",
          inputText: "",
        };
      } else {
        blocks[index] = {
          type: "text",
          text: String(block.text || ""),
        };
      }
      continue;
    }
    if (payload.type === "content_block_delta") {
      let index = Number(payload.index || 0);
      let block = blocks[index];
      if (!block) {
        block = {
          type: "text",
          text: "",
        };
        blocks[index] = block;
      }
      let delta = payload.delta || {};
      if (delta.type === "input_json_delta" || delta.partial_json !== undefined) {
        block.type = "tool_use";
        block.inputText = String(block.inputText || "") + String(delta.partial_json || "");
      } else {
        block.text = String(block.text || "") + String(delta.text || "");
      }
      continue;
    }
    if (payload.type === "message_delta") {
      let delta = payload.delta || {};
      if (delta.stop_reason) {
        stopReason = delta.stop_reason;
      }
    }
  }
  for (let block of blocks) {
    if (!block) {
      continue;
    }
    if (block.type === "tool_use") {
      content.push({
        type: "tool_use",
        id: block.id || "",
        name: block.name || "",
        input: parseToolInput(block.inputText),
      });
    } else {
      content.push({
        type: "text",
        text: String(block.text || ""),
      });
    }
  }
  if (content.length === 0) {
    content.push({
      type: "text",
      text: "",
    });
  }
  result.body = {
    id: id,
    type: "message",
    role: "assistant",
    model: model,
    content: content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: Number(result.usage.input_tokens || result.usage.prompt_tokens || 0),
      output_tokens: Number(result.usage.output_tokens || result.usage.completion_tokens || 0),
    },
  };
  return result;
}

function aggregateResponsesStream(upstream, model) {
  let reader = sse.reader(upstream.body);
  let result = streamResult();
  let id = "resp-" + String((new Date()).getTime());
  let status = "completed";
  let text = "";
  let output = [];
  let functionCalls = [];
  while (true) {
    let event = reader.next();
    if (event === null) {
      break;
    }
    let payload = parseJSON(event.data);
    if (!payload) {
      noteInvalidJSON(result, event);
      continue;
    }
    usageFromPayload(result, payload);
    if (payload.response) {
      id = payload.response.id || id;
      status = payload.response.status || status;
    }
    if (payload.type === "response.output_text.delta") {
      text = text + String(payload.delta || "");
      continue;
    }
    if (payload.type === "response.output_item.added" || payload.type === "response.output_item.done") {
      let item = responseFunctionItemFromPayload(payload);
      if (!item) {
        continue;
      }
      let outputIndex = responseOutputIndex(payload, functionCalls.length);
      let call = findResponseCall(functionCalls, item.id || "", outputIndex);
      if (!call) {
        call = {
          itemID: item.id || "",
          outputIndex: outputIndex,
          callID: item.call_id || item.callID || "",
          name: item.name || "",
          arguments: "",
        };
        functionCalls.push(call);
      }
      if (String(item.call_id || item.callID || "") !== "") {
        call.callID = item.call_id || item.callID || "";
      }
      if (String(item.name || "") !== "") {
        call.name = item.name || "";
      }
      if (String(item.arguments || "") !== "") {
        call.arguments = String(item.arguments || "");
      }
      continue;
    }
    if (payload.type === "response.function_call_arguments.delta") {
      let outputIndex = responseOutputIndex(payload, 0);
      let call = findResponseCall(functionCalls, payload.item_id || payload.itemId || "", outputIndex);
      if (!call) {
        call = {
          itemID: payload.item_id || payload.itemId || "",
          outputIndex: outputIndex,
          callID: "",
          name: "",
          arguments: "",
        };
        functionCalls.push(call);
      }
      call.arguments = call.arguments + String(payload.delta || "");
      continue;
    }
    if (payload.type === "response.function_call_arguments.done") {
      let outputIndex = responseOutputIndex(payload, 0);
      let call = findResponseCall(functionCalls, payload.item_id || payload.itemId || "", outputIndex);
      if (call && String(payload.arguments || "") !== "") {
        call.arguments = String(payload.arguments || "");
      }
      continue;
    }
  }
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
  for (let call of functionCalls) {
    if (!call) {
      continue;
    }
    output.push(responseFunctionItem(call.itemID || "fc_" + String(output.length), call.callID || call.itemID || "", call.name || "", call.arguments || ""));
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
  result.body = {
    id: id,
    object: "response",
    status: status === "in_progress" ? "completed" : status,
    model: model,
    output: output,
    usage: result.usage,
  };
  return result;
}

function responseOutputIndex(payload, fallback) {
  let value = payload.output_index;
  if (value === undefined) {
    value = payload.outputIndex;
  }
  let index = Number(value);
  if (index >= 0) {
    return index;
  }
  return fallback;
}

function responseFunctionItemFromPayload(payload) {
  let item = (payload || {}).item || (payload || {}).output_item || {};
  if (!item || item.type !== "function_call") {
    return undefined;
  }
  return item;
}

function findResponseCall(calls, itemID, outputIndex) {
  for (let call of calls) {
    if (String(itemID || "") !== "" && call.itemID === itemID) {
      return call;
    }
    if (call.outputIndex === outputIndex) {
      return call;
    }
  }
  return undefined;
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

function convertAnthropicStreamToOpenAIChat(upstream, res, model) {
  let reader = sse.reader(upstream.body);
  let result = streamResult();
  let id = "";
  let created = Math.floor((new Date()).getTime() / 1000);
  let wroteRole = false;
  let finalReason = "stop";
  let sawTool = false;
  while (true) {
    let event = reader.next();
    if (event === null) {
      break;
    }
    let payload = parseJSON(event.data);
    if (!payload) {
      noteInvalidJSON(result, event);
      continue;
    }
    usageFromPayload(result, payload);
    if (payload.type === "message_start") {
      let message = payload.message || {};
      id = message.id || id;
      if (!wroteRole) {
        writeSSE(res, chatChunk(id, created, model, {
          role: "assistant",
        }));
        wroteRole = true;
      }
      continue;
    }
    if (payload.type === "content_block_start") {
      let block = payload.content_block || {};
      if (block.type === "tool_use") {
        sawTool = true;
        writeSSE(res, chatChunk(id, created, model, chatToolCallDelta(
          Number(payload.index || 0),
          block.id || "",
          block.name || "",
          ""
        )));
      }
      continue;
    }
    if (payload.type === "content_block_delta") {
      let delta = payload.delta || {};
      if (delta.type === "input_json_delta" || delta.partial_json !== undefined) {
        sawTool = true;
        writeSSE(res, chatChunk(id, created, model, chatToolCallDelta(
          Number(payload.index || 0),
          "",
          undefined,
          delta.partial_json || ""
        )));
        continue;
      }
      let text = String(delta.text || "");
      if (text !== "") {
        writeSSE(res, chatChunk(id, created, model, {
          content: text,
        }));
      }
      continue;
    }
    if (payload.type === "message_delta") {
      let delta = payload.delta || {};
      if (delta.stop_reason) {
        finalReason = finishReasonFromAnthropic(delta.stop_reason);
      }
    }
  }
  if (sawTool && finalReason === "stop") {
    finalReason = "tool_calls";
  }
  writeSSE(res, chatChunk(id, created, model, {}, finalReason));
  res.write("data: [DONE]\n\n");
  res.flush();
  res.end();
  return result;
}

function convertOpenAIChatStreamToAnthropic(upstream, res, model) {
  let reader = sse.reader(upstream.body);
  let result = streamResult();
  let id = "msg-stream-" + String((new Date()).getTime());
  let nextIndex = 0;
  let textIndex = -1;
  let textOpen = false;
  let toolBlocks = [];
  writeEvent(res, "message_start", {
    type: "message_start",
    message: {
      id: id,
      type: "message",
      role: "assistant",
      model: model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
      },
    },
  });

  let finalReason = "end_turn";
  while (true) {
    let event = reader.next();
    if (event === null) {
      break;
    }
    if (String(event.data || "") === "[DONE]") {
      break;
    }
    let payload = parseJSON(event.data);
    if (!payload) {
      noteInvalidJSON(result, event);
      continue;
    }
    usageFromPayload(result, payload);
    let choice = (payload.choices || [])[0] || {};
    let delta = choice.delta || {};
    let text = String(delta.content || "");
    if (text !== "") {
      if (!textOpen) {
        textIndex = nextIndex;
        nextIndex = nextIndex + 1;
        writeEvent(res, "content_block_start", {
          type: "content_block_start",
          index: textIndex,
          content_block: {
            type: "text",
            text: "",
          },
        });
        textOpen = true;
      }
      writeEvent(res, "content_block_delta", {
        type: "content_block_delta",
        index: textIndex,
        delta: {
          type: "text_delta",
          text: text,
        },
      });
    }
    for (let toolCall of delta.tool_calls || []) {
      let chatIndex = Number(toolCall.index || 0);
      let fn = toolCall["function"] || {};
      let block = findBlock(toolBlocks, chatIndex);
      if (!block) {
        if (textOpen) {
          writeEvent(res, "content_block_stop", {
            type: "content_block_stop",
            index: textIndex,
          });
          textOpen = false;
        }
        block = {
          chatIndex: chatIndex,
          index: nextIndex,
          id: toolCall.id || "call_" + String(nextIndex),
          name: fn.name || "",
        };
        nextIndex = nextIndex + 1;
        toolBlocks.push(block);
        writeEvent(res, "content_block_start", {
          type: "content_block_start",
          index: block.index,
          content_block: {
            type: "tool_use",
            id: block.id,
            name: block.name,
            input: {},
          },
        });
      }
      if (String(fn.arguments || "") !== "") {
        writeEvent(res, "content_block_delta", {
          type: "content_block_delta",
          index: block.index,
          delta: {
            type: "input_json_delta",
            partial_json: String(fn.arguments || ""),
          },
        });
      }
    }
    if (choice.finish_reason) {
      if (choice.finish_reason === "length") {
        finalReason = "max_tokens";
      } else if (choice.finish_reason === "tool_calls") {
        finalReason = "tool_use";
      } else {
        finalReason = "end_turn";
      }
    }
  }

  if (textOpen) {
    writeEvent(res, "content_block_stop", {
      type: "content_block_stop",
      index: textIndex,
    });
  }
  for (let block of toolBlocks) {
    writeEvent(res, "content_block_stop", {
      type: "content_block_stop",
      index: block.index,
    });
  }
  writeEvent(res, "message_delta", {
    type: "message_delta",
    delta: {
      stop_reason: finalReason,
      stop_sequence: null,
    },
    usage: {
      output_tokens: 0,
    },
  });
  writeEvent(res, "message_stop", {
    type: "message_stop",
  });
  res.end();
  return result;
}

function convertResponsesStreamToOpenAIChat(upstream, res, model) {
  let reader = sse.reader(upstream.body);
  let result = streamResult();
  let id = "chatcmpl-" + String((new Date()).getTime());
  let created = Math.floor((new Date()).getTime() / 1000);
  let wroteRole = false;
  let functionCalls = [];
  let sawTool = false;
  let finalReason = "stop";
  function ensureRole() {
    if (wroteRole) {
      return;
    }
    writeSSE(res, chatChunk(id, created, model, {
      role: "assistant",
    }));
    wroteRole = true;
  }
  while (true) {
    let event = reader.next();
    if (event === null) {
      break;
    }
    let payload = parseJSON(event.data);
    if (!payload) {
      noteInvalidJSON(result, event);
      continue;
    }
    usageFromPayload(result, payload);
    if (payload.type === "response.created" && payload.response) {
      id = payload.response.id || id;
      ensureRole();
      continue;
    }
    if (payload.type === "response.output_text.delta") {
      let text = String(payload.delta || "");
      if (text !== "") {
        ensureRole();
        writeSSE(res, chatChunk(id, created, model, {
          content: text,
        }));
      }
      continue;
    }
    if (payload.type === "response.output_item.added" || payload.type === "response.output_item.done") {
      let item = responseFunctionItemFromPayload(payload);
      if (!item) {
        continue;
      }
      ensureRole();
      sawTool = true;
      let outputIndex = responseOutputIndex(payload, functionCalls.length);
      let call = findResponseCall(functionCalls, item.id || "", outputIndex);
      if (!call) {
        call = {
          itemID: item.id || "",
          outputIndex: outputIndex,
          arguments: "",
        };
        functionCalls.push(call);
        writeSSE(res, chatChunk(id, created, model, chatToolCallDelta(
          outputIndex,
          item.call_id || item.callID || "",
          item.name || "",
          ""
        )));
      }
      if (String(item.arguments || "") !== "" && call.arguments === "") {
        call.arguments = String(item.arguments || "");
        writeSSE(res, chatChunk(id, created, model, chatToolCallDelta(
          outputIndex,
          "",
          undefined,
          call.arguments
        )));
      }
      continue;
    }
    if (payload.type === "response.function_call_arguments.delta") {
      ensureRole();
      sawTool = true;
      let outputIndex = responseOutputIndex(payload, 0);
      let call = findResponseCall(functionCalls, payload.item_id || payload.itemId || "", outputIndex);
      if (!call) {
        call = {
          itemID: payload.item_id || payload.itemId || "",
          outputIndex: outputIndex,
          arguments: "",
        };
        functionCalls.push(call);
        writeSSE(res, chatChunk(id, created, model, chatToolCallDelta(outputIndex, "", "", "")));
      }
      let argsDelta = String(payload.delta || "");
      if (argsDelta !== "") {
        call.arguments = call.arguments + argsDelta;
        writeSSE(res, chatChunk(id, created, model, chatToolCallDelta(
          call.outputIndex,
          "",
          undefined,
          argsDelta
        )));
      }
      continue;
    }
    if (payload.type === "response.function_call_arguments.done") {
      sawTool = true;
      continue;
    }
    if (payload.type === "response.completed" || payload.type === "response.done" || payload.type === "response.incomplete") {
      if (payload.type === "response.incomplete") {
        finalReason = "length";
      }
      break;
    }
  }
  if (sawTool && finalReason === "stop") {
    finalReason = "tool_calls";
  }
  ensureRole();
  writeSSE(res, chatChunk(id, created, model, {}, finalReason));
  res.write("data: [DONE]\n\n");
  res.flush();
  res.end();
  return result;
}

function convertOpenAIChatStreamToResponses(upstream, res, model) {
  let reader = sse.reader(upstream.body);
  let result = streamResult();
  let id = "resp-" + String((new Date()).getTime());
  let output = [];
  let functionCalls = [];
  res.write("event: response.created\n");
  res.write(sseData({
    type: "response.created",
    response: {
      id: id,
      object: "response",
      status: "in_progress",
      model: model,
      output: [],
    },
  }));
  res.flush();
  while (true) {
    let event = reader.next();
    if (event === null) {
      break;
    }
    if (String(event.data || "") === "[DONE]") {
      break;
    }
    let payload = parseJSON(event.data);
    if (!payload) {
      noteInvalidJSON(result, event);
      continue;
    }
    usageFromPayload(result, payload);
    let choice = (payload.choices || [])[0] || {};
    let delta = choice.delta || {};
    let text = String(delta.content || "");
    if (text !== "") {
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
      res.write("event: response.output_text.delta\n");
      res.write(sseData({
        type: "response.output_text.delta",
        delta: text,
      }));
      res.flush();
    }
    for (let toolCall of delta.tool_calls || []) {
      let index = Number(toolCall.index || 0);
      let fn = toolCall["function"] || {};
      let existing = findResponseStreamCall(functionCalls, index);
      if (!existing) {
        existing = {
          id: "fc_" + String(index),
          chatIndex: index,
          outputIndex: output.length,
          call_id: toolCall.id || "call_" + String(index),
          name: fn.name || "",
          arguments: "",
        };
        functionCalls.push(existing);
        output.push(responseFunctionItem(existing.id, existing.call_id, existing.name, ""));
        writeEvent(res, "response.output_item.added", {
          type: "response.output_item.added",
          output_index: existing.outputIndex,
          item: responseFunctionItem(existing.id, existing.call_id, existing.name, ""),
        });
      }
      if (fn.name) {
        existing.name = fn.name;
      }
      let argsDelta = String(fn.arguments || "");
      if (argsDelta !== "") {
        existing.arguments = existing.arguments + argsDelta;
        writeEvent(res, "response.function_call_arguments.delta", {
          type: "response.function_call_arguments.delta",
          item_id: existing.id,
          output_index: existing.outputIndex,
          delta: argsDelta,
        });
      }
    }
  }
  for (let i = 0; i < functionCalls.length; i = i + 1) {
    let call = functionCalls[i];
    if (!call) {
      continue;
    }
    writeEvent(res, "response.function_call_arguments.done", {
      type: "response.function_call_arguments.done",
      item_id: call.id,
      output_index: call.outputIndex,
      arguments: call.arguments,
    });
  }
  res.write("event: response.completed\n");
  res.write(sseData({
    type: "response.completed",
    response: {
      id: id,
      object: "response",
      status: "completed",
      model: model,
      output: output,
    },
  }));
  res.flush();
  res.end();
  return result;
}

function convertResponsesStreamToAnthropic(upstream, res, model) {
  let reader = sse.reader(upstream.body);
  let result = streamResult();
  let id = "msg-stream-" + String((new Date()).getTime());
  let nextIndex = 0;
  let textIndex = -1;
  let textOpen = false;
  let toolBlocks = [];
  let sawTool = false;
  res.write("event: message_start\n");
  res.write(sseData({
    type: "message_start",
    message: {
      id: id,
      type: "message",
      role: "assistant",
      model: model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
      },
    },
  }));
  res.flush();
  function openTextBlock() {
    if (textOpen) {
      return;
    }
    textIndex = nextIndex;
    nextIndex = nextIndex + 1;
    writeEvent(res, "content_block_start", {
      type: "content_block_start",
      index: textIndex,
      content_block: {
        type: "text",
        text: "",
      },
    });
    textOpen = true;
  }
  function closeTextBlock() {
    if (!textOpen) {
      return;
    }
    writeEvent(res, "content_block_stop", {
      type: "content_block_stop",
      index: textIndex,
    });
    textOpen = false;
  }
  while (true) {
    let event = reader.next();
    if (event === null) {
      break;
    }
    let payload = parseJSON(event.data);
    if (!payload) {
      noteInvalidJSON(result, event);
      continue;
    }
    usageFromPayload(result, payload);
    if (payload.type === "response.output_text.delta") {
      let text = String(payload.delta || "");
      if (text !== "") {
        openTextBlock();
        writeEvent(res, "content_block_delta", {
          type: "content_block_delta",
          index: textIndex,
          delta: {
            type: "text_delta",
            text: text,
          },
        });
      }
      continue;
    }
    if (payload.type === "response.output_item.added" || payload.type === "response.output_item.done") {
      let item = responseFunctionItemFromPayload(payload);
      if (!item) {
        continue;
      }
      sawTool = true;
      closeTextBlock();
      let outputIndex = responseOutputIndex(payload, toolBlocks.length);
      let block = findResponseCall(toolBlocks, item.id || "", outputIndex);
      if (!block) {
        block = {
          itemID: item.id || "",
          outputIndex: outputIndex,
          index: nextIndex,
          arguments: "",
        };
        nextIndex = nextIndex + 1;
        toolBlocks.push(block);
        writeEvent(res, "content_block_start", {
          type: "content_block_start",
          index: block.index,
          content_block: {
            type: "tool_use",
            id: item.call_id || item.callID || item.id || "",
            name: item.name || "",
            input: {},
          },
        });
      }
      if (String(item.arguments || "") !== "" && block.arguments === "") {
        block.arguments = String(item.arguments || "");
        writeEvent(res, "content_block_delta", {
          type: "content_block_delta",
          index: block.index,
          delta: {
            type: "input_json_delta",
            partial_json: block.arguments,
          },
        });
      }
      continue;
    }
    if (payload.type === "response.function_call_arguments.delta") {
      sawTool = true;
      closeTextBlock();
      let outputIndex = responseOutputIndex(payload, 0);
      let block = findResponseCall(toolBlocks, payload.item_id || payload.itemId || "", outputIndex);
      if (!block) {
        block = {
          itemID: payload.item_id || payload.itemId || "",
          outputIndex: outputIndex,
          index: nextIndex,
          arguments: "",
        };
        nextIndex = nextIndex + 1;
        toolBlocks.push(block);
        writeEvent(res, "content_block_start", {
          type: "content_block_start",
          index: block.index,
          content_block: {
            type: "tool_use",
            id: block.itemID || "call_" + String(outputIndex),
            name: "",
            input: {},
          },
        });
      }
      let argsDelta = String(payload.delta || "");
      if (argsDelta !== "") {
        block.arguments = block.arguments + argsDelta;
        writeEvent(res, "content_block_delta", {
          type: "content_block_delta",
          index: block.index,
          delta: {
            type: "input_json_delta",
            partial_json: argsDelta,
          },
        });
      }
      continue;
    }
    if (payload.type === "response.function_call_arguments.done") {
      sawTool = true;
      continue;
    }
    if (payload.type === "response.completed" || payload.type === "response.done" || payload.type === "response.incomplete") {
      break;
    }
  }
  closeTextBlock();
  for (let block of toolBlocks) {
    writeEvent(res, "content_block_stop", {
      type: "content_block_stop",
      index: block.index,
    });
  }
  writeEvent(res, "message_delta", {
    type: "message_delta",
    delta: {
      stop_reason: sawTool ? "tool_use" : "end_turn",
      stop_sequence: null,
    },
    usage: {
      output_tokens: 0,
    },
  });
  writeEvent(res, "message_stop", {
    type: "message_stop",
  });
  res.end();
  return result;
}

function convertAnthropicStreamToResponses(upstream, res, model) {
  let reader = sse.reader(upstream.body);
  let result = streamResult();
  let id = "resp-" + String((new Date()).getTime());
  res.write("event: response.created\n");
  res.write(sseData({
    type: "response.created",
    response: {
      id: id,
      object: "response",
      status: "in_progress",
      model: model,
      output: [],
    },
  }));
  res.flush();
  while (true) {
    let event = reader.next();
    if (event === null) {
      break;
    }
    let payload = parseJSON(event.data);
    if (!payload) {
      noteInvalidJSON(result, event);
      continue;
    }
    usageFromPayload(result, payload);
    if (payload.type === "content_block_delta") {
      let delta = payload.delta || {};
      let text = String(delta.text || "");
      if (text !== "") {
        res.write("event: response.output_text.delta\n");
        res.write(sseData({
          type: "response.output_text.delta",
          delta: text,
        }));
        res.flush();
      }
      continue;
    }
    if (payload.type === "message_stop") {
      break;
    }
  }
  res.write("event: response.completed\n");
  res.write(sseData({
    type: "response.completed",
    response: {
      id: id,
      object: "response",
      status: "completed",
      model: model,
      output: [],
    },
  }));
  res.flush();
  res.end();
  return result;
}

export function canConvertStream(downstream, upstream) {
  return (downstream === ProtocolOpenAIChat && upstream === ProtocolAnthropic) ||
    (downstream === ProtocolAnthropic && upstream === ProtocolOpenAIChat) ||
    (downstream === ProtocolOpenAIChat && upstream === ProtocolOpenAIResponses) ||
    (downstream === ProtocolOpenAIResponses && upstream === ProtocolOpenAIChat) ||
    (downstream === ProtocolAnthropic && upstream === ProtocolOpenAIResponses) ||
    (downstream === ProtocolOpenAIResponses && upstream === ProtocolAnthropic);
}

export function convertStream(downstream, upstream, upstreamResponse, res, model) {
  if (downstream === ProtocolOpenAIChat && upstream === ProtocolAnthropic) {
    return convertAnthropicStreamToOpenAIChat(upstreamResponse, res, model);
  }
  if (downstream === ProtocolAnthropic && upstream === ProtocolOpenAIChat) {
    return convertOpenAIChatStreamToAnthropic(upstreamResponse, res, model);
  }
  if (downstream === ProtocolOpenAIChat && upstream === ProtocolOpenAIResponses) {
    return convertResponsesStreamToOpenAIChat(upstreamResponse, res, model);
  }
  if (downstream === ProtocolOpenAIResponses && upstream === ProtocolOpenAIChat) {
    return convertOpenAIChatStreamToResponses(upstreamResponse, res, model);
  }
  if (downstream === ProtocolAnthropic && upstream === ProtocolOpenAIResponses) {
    return convertResponsesStreamToAnthropic(upstreamResponse, res, model);
  }
  if (downstream === ProtocolOpenAIResponses && upstream === ProtocolAnthropic) {
    return convertAnthropicStreamToResponses(upstreamResponse, res, model);
  }
  return res.stream(upstreamResponse.body);
}

export function streamPreflightError(text) {
  if (String(text || "").trim() === "") {
    return "empty upstream stream";
  }
  let event = firstSSEEvent(text);
  if (!event) {
    return "empty upstream stream";
  }
  if (String(event.type || "") === "error") {
    let payload = parseJSON(event.data);
    let message = errorMessageFromPayload(payload);
    if (message !== "") {
      return "upstream stream error: " + message;
    }
    return "upstream stream error";
  }
  let payload = parseJSON(event.data);
  let message = errorMessageFromPayload(payload);
  if (message !== "") {
    return "upstream stream error: " + message;
  }
  return "";
}

export function streamResponseFromBody(downstream, body, res, model, includeUsage) {
  if (downstream === ProtocolOpenAIChat) {
    streamChatResponse(body || {}, res, model, includeUsage === true);
    return;
  }
  if (downstream === ProtocolAnthropic) {
    streamAnthropicResponse(body || {}, res, model);
    return;
  }
  if (downstream === ProtocolOpenAIResponses) {
    streamResponsesResponse(body || {}, res, model);
    return;
  }
  res.end();
}

export function aggregateStreamResponse(upstream, upstreamResponse, model) {
  if (upstream === ProtocolOpenAIChat) {
    return aggregateOpenAIChatStream(upstreamResponse, model);
  }
  if (upstream === ProtocolAnthropic) {
    return aggregateAnthropicStream(upstreamResponse, model);
  }
  if (upstream === ProtocolOpenAIResponses) {
    return aggregateResponsesStream(upstreamResponse, model);
  }
  return {
    body: {},
    usage: {},
    error: "unsupported stream aggregation",
  };
}
