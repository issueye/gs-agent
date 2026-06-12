import { ProtocolAnthropic, ProtocolOpenAIChat, ProtocolOpenAIResponses } from "@/services/protocols";

let sse = require("@std/sse");

function parseJSON(text) {
  try {
    return JSON.parse(String(text || ""));
  } catch (err) {
    return undefined;
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

function responseFunctionItem(id, callID, name, argumentsText) {
  return {
    id: id,
    type: "function_call",
    call_id: callID,
    name: name,
    arguments: argumentsText || "",
  };
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
      continue;
    }
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
}

function convertOpenAIChatStreamToAnthropic(upstream, res, model) {
  let reader = sse.reader(upstream.body);
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
      continue;
    }
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
}

function convertResponsesStreamToOpenAIChat(upstream, res, model) {
  let reader = sse.reader(upstream.body);
  let id = "chatcmpl-" + String((new Date()).getTime());
  let created = Math.floor((new Date()).getTime() / 1000);
  let wroteRole = false;
  while (true) {
    let event = reader.next();
    if (event === null) {
      break;
    }
    let payload = parseJSON(event.data);
    if (!payload) {
      continue;
    }
    if (payload.type === "response.created" && payload.response) {
      id = payload.response.id || id;
      if (!wroteRole) {
        writeSSE(res, {
          id: id,
          object: "chat.completion.chunk",
          created: created,
          model: model,
          choices: [{
            index: 0,
            delta: {
              role: "assistant",
            },
          }],
        });
        wroteRole = true;
      }
      continue;
    }
    if (payload.type === "response.output_text.delta") {
      let text = String(payload.delta || "");
      if (text !== "") {
        writeSSE(res, {
          id: id,
          object: "chat.completion.chunk",
          created: created,
          model: model,
          choices: [{
            index: 0,
            delta: {
              content: text,
            },
          }],
        });
      }
      continue;
    }
    if (payload.type === "response.completed" || payload.type === "response.done" || payload.type === "response.incomplete") {
      break;
    }
  }
  writeSSE(res, {
    id: id,
    object: "chat.completion.chunk",
    created: created,
    model: model,
    choices: [{
      index: 0,
      delta: {},
      finish_reason: "stop",
    }],
  });
  res.write("data: [DONE]\n\n");
  res.flush();
  res.end();
}

function convertOpenAIChatStreamToResponses(upstream, res, model) {
  let reader = sse.reader(upstream.body);
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
      continue;
    }
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
      let existing = functionCalls[index];
      if (!existing) {
        existing = {
          id: "fc_" + String(index),
          call_id: toolCall.id || "call_" + String(index),
          name: fn.name || "",
          arguments: "",
        };
        functionCalls[index] = existing;
        output.push(responseFunctionItem(existing.id, existing.call_id, existing.name, ""));
        writeEvent(res, "response.output_item.added", {
          type: "response.output_item.added",
          output_index: output.length - 1,
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
          output_index: index,
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
      output_index: i,
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
}

function convertResponsesStreamToAnthropic(upstream, res, model) {
  let reader = sse.reader(upstream.body);
  let id = "msg-stream-" + String((new Date()).getTime());
  let index = 0;
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
  res.write("event: content_block_start\n");
  res.write(sseData({
    type: "content_block_start",
    index: index,
    content_block: {
      type: "text",
      text: "",
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
      continue;
    }
    if (payload.type === "response.output_text.delta") {
      let text = String(payload.delta || "");
      if (text !== "") {
        res.write("event: content_block_delta\n");
        res.write(sseData({
          type: "content_block_delta",
          index: index,
          delta: {
            type: "text_delta",
            text: text,
          },
        }));
        res.flush();
      }
      continue;
    }
    if (payload.type === "response.completed" || payload.type === "response.done" || payload.type === "response.incomplete") {
      break;
    }
  }
  res.write("event: content_block_stop\n");
  res.write(sseData({
    type: "content_block_stop",
    index: index,
  }));
  res.write("event: message_delta\n");
  res.write(sseData({
    type: "message_delta",
    delta: {
      stop_reason: "end_turn",
      stop_sequence: null,
    },
    usage: {
      output_tokens: 0,
    },
  }));
  res.write("event: message_stop\n");
  res.write(sseData({
    type: "message_stop",
  }));
  res.flush();
  res.end();
}

function convertAnthropicStreamToResponses(upstream, res, model) {
  let reader = sse.reader(upstream.body);
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
      continue;
    }
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
