// Session 里的事件分三层：
// primary 是可恢复的对话主线；working 是工具轮工作材料；audit 只做完整审计。
export function sessionRecordLevel(kind, payload) {
  if (kind === "message") {
    if (payload) {
      if (payload.role === "user" || payload.role === "assistant") {
        return "primary";
      }
    }
  }

  if (kind === "tool_call" || kind === "tool_result") {
    return "working";
  }

  return "audit";
}

export function messageFromSessionEvent(event) {
  if (!event) {
    return undefined;
  }

  let payload = event.payload;
  if (!payload) {
    return undefined;
  }

  if (event.kind === "message") {
    if (payload.role === "user" || payload.role === "assistant") {
      return {
        role: payload.role,
        content: payload.content,
      };
    }
  }

  if (event.kind === "tool_call") {
    return {
      kind: "tool_call",
      id: payload.id,
      name: payload.name,
      args: payload.args,
    };
  }

  if (event.kind === "tool_result") {
    return {
      role: "tool",
      id: payload.id,
      name: payload.name,
      content: payload.content,
    };
  }

  return undefined;
}

function contains(list, value) {
  if (!list) {
    return false;
  }
  for (let item of list) {
    if (item === value) {
      return true;
    }
  }
  return false;
}

export function messagesFromSessionEvents(events, options) {
  if (!events) {
    return [];
  }

  if (!options) {
    options = {};
  }

  let levels = options.levels;
  if (!levels) {
    levels = ["primary"];
  }

  let messages = [];
  for (let event of events) {
    let level = event.level;
    if (!level) {
      level = sessionRecordLevel(event.kind, event.payload);
    }
    if (contains(levels, level)) {
      let message = messageFromSessionEvent(event);
      if (message) {
        messages.push(message);
      }
    }
  }

  return messages;
}
