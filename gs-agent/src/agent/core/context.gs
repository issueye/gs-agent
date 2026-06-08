export function modelMessageLevel(message) {
  if (!message) {
    return "audit";
  }
  if (message.kind === "tool_call" || message.role === "tool") {
    return "working";
  }
  if (message.role === "user" || message.role === "assistant") {
    return "primary";
  }
  return "audit";
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

function lastAssistantIndex(messages) {
  let index = -1;
  for (let i = 0; i < messages.length; i = i + 1) {
    if (messages[i]) {
      if (messages[i].role === "assistant") {
        index = i;
      }
    }
  }
  return index;
}

function shortText(value, max) {
  let text = String(value || "").replaceAll("\r", " ").replaceAll("\n", " ");
  while (text.indexOf("  ") >= 0) {
    text = text.replaceAll("  ", " ");
  }
  if (text.length > max) {
    return text.slice(0, max) + "...";
  }
  return text;
}

function messageTokenEstimate(message) {
  if (!message) {
    return 0;
  }

  let text = "";
  if ("content" in message) {
    text = String(message.content || "");
  } else {
    text = JSON.stringify(message);
  }

  // 粗略估算：英文模型常见约 4 字符/token；中日韩字符更接近 1 字/token。
  // 这里偏保守，避免上下文已经接近窗口时才开始压缩。
  let tokens = Math.ceil(text.length / 3);
  if (message.kind === "tool_call") {
    tokens = tokens + Math.ceil(JSON.stringify(message.args || {}).length / 3);
  }
  tokens = tokens + 12;
  return tokens;
}

export function estimateContextTokens(messages) {
  if (!messages) {
    return 0;
  }
  let total = 0;
  for (let message of messages) {
    total = total + messageTokenEstimate(message);
  }
  return total;
}

function recentTurnStart(messages, turns) {
  if (!turns || turns < 1) {
    return 0;
  }

  let seen = 0;
  for (let i = messages.length - 1; i >= 0; i = i - 1) {
    if (messages[i]) {
      if (messages[i].role === "user") {
        seen = seen + 1;
        if (seen >= turns) {
          return i;
        }
      }
    }
  }
  return 0;
}

function belowTokenThreshold(messages, threshold) {
  if (threshold === undefined) {
    return false;
  }
  if (threshold <= 0) {
    return false;
  }
  return estimateContextTokens(messages) < threshold;
}

function summarizePrimaryMessages(messages, options) {
  if (!messages || messages.length === 0) {
    return undefined;
  }

  let maxMessages = options.summaryMessages || 18;
  let maxPerMessage = options.summaryMessageChars || 260;
  let maxSummaryChars = options.summaryChars || 2400;
  let start = 0;
  if (messages.length > maxMessages) {
    start = messages.length - maxMessages;
  }

  let lines = [];
  if (start > 0) {
    lines.push("- " + String(start) + " older mainline messages omitted from this compact summary.");
  }
  for (let i = start; i < messages.length; i = i + 1) {
    let message = messages[i];
    if (message) {
      let role = message.role || message.kind || "message";
      lines.push("- " + role + ": " + shortText(message.content, maxPerMessage));
    }
  }

  let text = "Earlier conversation summary before the recent full turns:\n" + lines.join("\n") + "\n\nExact original messages are stored in the session archive. Use the search_session_archive tool if exact wording, older decisions, or old tool output is needed.";
  if (text.length > maxSummaryChars) {
    text = text.slice(0, maxSummaryChars) + "...";
  }

  return {
    role: "user",
    content: text,
  };
}

export function selectLeveledContext(messages, options) {
  if (!messages) {
    return [];
  }

  if (!options) {
    options = {};
  }

  let levels = options.levels;
  if (!levels) {
    levels = ["primary"];
  }

  let working = options.working;
  if (!working) {
    working = "recent";
  }

  let threshold = options.tokenThreshold;
  if (threshold === undefined) {
    threshold = options.contextTokenThreshold;
  }
  if (belowTokenThreshold(messages, threshold)) {
    let full = [];
    for (let message of messages) {
      if (contains(levels, modelMessageLevel(message))) {
        full.push(message);
      }
    }
    return full;
  }

  let activeStart = lastAssistantIndex(messages);
  let hotStart = recentTurnStart(messages, options.recentTurns || 4);
  let selected = [];
  let summarySource = [];

  for (let i = 0; i < messages.length; i = i + 1) {
    let message = messages[i];
    let level = modelMessageLevel(message);

    if (i < hotStart) {
      if (level === "primary") {
        summarySource.push(message);
      }
      continue;
    }

    if (level === "working") {
      if (!contains(levels, "working")) {
        continue;
      }
      if (working === "all" || working === "recent" || i > activeStart) {
        selected.push(message);
      }
    } else if (contains(levels, level)) {
      selected.push(message);
    }
  }

  if (options.summary !== false && summarySource.length > 0) {
    let summary = summarizePrimaryMessages(summarySource, options);
    if (summary) {
      selected.unshift(summary);
    }
  }

  return selected;
}

export function createLeveledContextSelector(options) {
  return function(messages) {
    return selectLeveledContext(messages, options);
  };
}
