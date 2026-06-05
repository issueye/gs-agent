export function createAgent(options) {
  let provider = options.provider;
  let registry = options.registry;
  let session = options.session;
  let maxTurns = options.maxTurns;
  let onEvent = options.onEvent;

  if (!maxTurns) {
    maxTurns = 8;
  }

  // 所有关键事件统一从这里发出，同时写入 JSONL session。
  function emit(kind, payload) {
    let event = {
      kind: kind,
      payload: payload,
    };

    if (session) {
      session.append(kind, payload);
    }

    if (onEvent) {
      onEvent(event);
    }

    return event;
  }

  // 对话入口：调用方传入同一个 messages 数组即可保留多轮上下文。
  function runMessages(messages, input) {
    if (!messages) {
      messages = [];
    }

    if (input) {
      let userMessage = { role: "user", content: input };
      messages.push(userMessage);
      emit("message", userMessage);
    }

    for (let turn = 0; turn < maxTurns; turn = turn + 1) {
      emit("turn_start", { turn: turn });
      let allowTools = true;
      let requestMessages = messages;

      // 最后一轮给模型明确收束信号，避免真实模型持续探索工具直到 maxTurns 用尽。
      if (turn === maxTurns - 1) {
        allowTools = false;
        requestMessages = messages.slice(0);
        let finalInstruction = {
          role: "user",
          content: "This is the final turn. Do not call tools. Provide the best concise final answer from the information already available.",
        };
        // 收束提示只参与本次请求，不写入长期对话历史，避免后续追问被内部提示污染。
        requestMessages.push(finalInstruction);
      }

      let tools = registry.list();
      if (!allowTools) {
        tools = [];
      }
      let next = provider.next(requestMessages, tools, { allowTools: allowTools });
      let textToolCall = parseTextToolCall(next.content, turn);
      if (textToolCall) {
        next = textToolCall;
      }

      // provider 返回 tool_call 时，registry 负责参数校验、执行和错误包装。
      if (next.kind === "tool_call") {
        if (!allowTools) {
          let blocked = blockedToolAnswer(next.source || "structured tool call");
          messages.push(blocked);
          emit("message", blocked);
          emit("turn_end", { turn: turn, stop: "tool_call_blocked" });
          return blocked;
        }

        if (!next.id) {
          next.id = "tool_" + String(turn);
        }
        emit("tool_call", next);
        messages.push(next);

        let result = registry.safeCall(next.name, next.args);
        let toolMessage = {
          role: "tool",
          id: next.id,
          name: next.name,
          content: JSON.stringify(result),
        };
        messages.push(toolMessage);
        emit("tool_result", toolMessage);
        emit("turn_end", { turn: turn, stop: "tool_call" });
        continue;
      }

      if (looksLikeTextToolCall(next.content)) {
        let blocked = blockedToolAnswer("text tool call");
        messages.push(blocked);
        emit("message", blocked);
        emit("turn_end", { turn: turn, stop: "text_tool_call_blocked" });
        return blocked;
      }

      // 非工具调用即视为最终回答，结束本轮 agent run。
      messages.push(next);
      emit("message", next);
      emit("turn_end", { turn: turn, stop: "message" });
      return next;
    }

    // 理论上最后一轮提醒会促成回答；这里仍保留硬停止兜底。
    let fallback = {
      role: "assistant",
      content: "Agent stopped after maxTurns=" + String(maxTurns),
    };
    messages.push(fallback);
    emit("message", fallback);
    return fallback;
  }

  // 一次性任务入口保持原有语义：每次调用都从新的上下文开始。
  function run(input) {
    return runMessages([], input);
  }

  return {
    run: run,
    runMessages: runMessages,
  };
}

function looksLikeTextToolCall(content) {
  if (!content) {
    return false;
  }
  let text = String(content);
  return (text.indexOf("DSML") >= 0 && text.indexOf("tool_calls") >= 0) || text.indexOf("<tool_call") >= 0 || text.indexOf("\"tool_calls\"") >= 0;
}

function blockedToolAnswer(kind) {
  return {
    role: "assistant",
    content: "Agent stopped because the model attempted a " + kind + " after tools were disabled for the final turn. Increase maxTurns or narrow the task so the agent can finish earlier.",
  };
}

function between(text, start, end, startAt) {
  let startIndex = text.indexOf(start, startAt);
  if (startIndex < 0) {
    return undefined;
  }
  let valueStart = startIndex + start.length;
  let endIndex = text.indexOf(end, valueStart);
  if (endIndex < 0) {
    return undefined;
  }
  return {
    value: text.slice(valueStart, endIndex),
    next: endIndex + end.length,
  };
}

function parseTextToolCall(content, turn) {
  if (!looksLikeTextToolCall(content)) {
    return undefined;
  }
  content = String(content);

  let namePart = between(content, "invoke name=\"", "\"", 0);
  if (!namePart) {
    namePart = between(content, "<tool_call name=\"", "\"", 0);
  }
  if (!namePart) {
    return undefined;
  }

  let args = {};
  let search = 0;
  while (true) {
    let param = between(content, "parameter name=\"", "\"", search);
    if (!param) {
      break;
    }

    let valueStart = content.indexOf(">", param.next);
    if (valueStart < 0) {
      break;
    }

    let valueEnd = content.indexOf("</", valueStart + 1);
    if (valueEnd < 0) {
      break;
    }

    args[param.value] = content.slice(valueStart + 1, valueEnd).trim();
    search = valueEnd + 2;
  }

  return {
    kind: "tool_call",
    source: "text tool call",
    id: "text_tool_" + String(turn),
    name: namePart.value,
    args: args,
  };
}
