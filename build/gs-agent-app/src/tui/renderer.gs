import { INVERSE, RESET, chars, color, line, padRight, repeatText, styleText, truncateToWidth, visibleWidth } from "@/tui/ansi";
import { loadingFrame } from "@/tui/loading";
import { commandItems, tr } from "@/tui/i18n";
import { Input, Markdown } from "@/tui/components";
import { border, clampScroll, splitLines, takeLine, wrapText } from "@/tui/widgets";

function safeText(value) {
  if (!value) {
    return "";
  }
  return String(value);
}

function parseJsonText(text) {
  let value = undefined;
  try {
    value = JSON.parse(String(text));
  } catch (err) {
    return undefined;
  }
  return value;
}

function displayText(value) {
  let text = safeText(value);
  if (text === "") {
    return "";
  }
  let parsed = parseJsonText(text);
  if (typeof parsed === "string") {
    return parsed;
  }
  // 有些兼容接口会把最终回答包成 JSON 字符串文本；展示前解掉外层引号和常见转义。
  if (text.length >= 2) {
    if (text.slice(0, 1) === "\"" && text.slice(text.length - 1) === "\"") {
      text = text.slice(1, text.length - 1);
    }
  }
  text = text.replaceAll("\\r\\n", "\n");
  text = text.replaceAll("\\n", "\n");
  text = text.replaceAll("\\t", "  ");
  text = text.replaceAll("\\\"", "\"");
  return text;
}

function toolResultText(content) {
  let parsed = parseJsonText(content);
  if (!parsed) {
    return displayText(content);
  }

  if (parsed.ok === false) {
    if (parsed.error) {
      return "error: " + safeText(parsed.error);
    }
  }

  let result = parsed.result;
  if (!result) {
    return displayText(content);
  }
  if (typeof result === "string") {
    return result;
  }
  if (result.text) {
    return safeText(result.text);
  }
  if (result.content) {
    return safeText(result.content);
  }
  if (result.entries) {
    return safeText(result.path) + ": " + result.entries.join(", ");
  }
  if (result.path) {
    return safeText(result.path);
  }
  return JSON.stringify(result);
}

function toolResultOk(content) {
  let parsed = parseJsonText(content);
  if (!parsed) {
    return undefined;
  }
  if (parsed.ok === false) {
    return false;
  }
  if (parsed.result) {
    if (parsed.result.ok === false) {
      return false;
    }
  }
  return true;
}

function toolResultDot(content) {
  let ok = toolResultOk(content);
  if (ok === false) {
    return color("●", "error");
  }
  if (ok === true) {
    return color("●", "success");
  }
  return color("●", "muted");
}

function eventTitle(state, event) {
  if (!event) {
    return tr(state, "noEvent");
  }

  let kind = event.kind;
  let payload = event.payload;
  if (kind === "turn_start") {
    return "turn_start #" + String(payload.turn);
  }
  if (kind === "turn_end") {
    return "turn_end #" + String(payload.turn) + " " + safeText(payload.stop);
  }
  if (kind === "tool_call") {
    return "tool_call " + safeText(payload.name);
  }
  if (kind === "tool_result") {
    return "tool_result " + safeText(payload.name);
  }
  if (kind === "message") {
    return "message " + safeText(payload.role);
  }
  if (kind === "error") {
    return "error";
  }
  if (kind === "answer") {
    return "answer";
  }
  if (kind === "llm_retry") {
    return "llm_retry";
  }
  return safeText(kind);
}

export function eventSummary(event) {
  if (!event) {
    return "";
  }

  let title = eventTitle(undefined, event);
  let payload = event.payload;
  if (event.kind === "message" && payload.content) {
    return title + " - " + safeText(payload.content).split("\n")[0];
  }
  if (event.kind === "tool_call") {
    return title + " " + JSON.stringify(payload.args);
  }
  if (event.kind === "tool_result" && payload.content) {
    return toolResultDot(payload.content) + " " + title + " " + truncateToWidth(toolResultText(payload.content), 60);
  }
  if (event.kind === "error") {
    return title + " " + safeText(payload.message);
  }
  if (event.kind === "answer") {
    return title + " - " + safeText(payload.content).split("\n")[0];
  }
  if (event.kind === "llm_retry") {
    return "llm_retry " + String(payload.attempt) + "/" + String(payload.maxAttempts) + " " + safeText(payload.error);
  }
  return title;
}

export function eventDetails(state, event) {
  if (!event) {
    return tr(state, "noEventSelected");
  }
  if (event.kind === "answer") {
    return safeText(event.payload.content);
  }
  return JSON.stringify(event, null, 2);
}

function drawComposer(state, width, height) {
  let lines = splitLines(state.taskText);
  let bodyHeight = height - 4;
  if (bodyHeight < 1) {
    bodyHeight = 1;
  }
  let offset = state.taskScroll || 0;
  let current = takeLine(lines, state.cursorLine);
  let currentLine = state.cursorLine + 1;
  let hint = tr(state, "prompt") + "  line " + String(currentLine) + "/" + String(lines.length) + "  " + tr(state, "enterSend") + "  " + tr(state, "sendHelp") + "  / commands";
  let out = [];
  out.push(styleText(line(hint, width), { dim: true, fg: "muted" }));
  for (let i = 0; i < bodyHeight; i = i + 1) {
    let index = offset + i;
    let value = takeLine(lines, index);
    let prompt = "  ";
    let cursor = -1;
    let focused = false;
    if (index === state.cursorLine) {
      prompt = "> ";
      cursor = state.cursorCol;
      focused = state.focus === "task";
    }
    let inputRows = Input({
      width: width,
      title: "",
      value: value,
      cursor: cursor,
      focused: focused,
      prompt: prompt,
    });
    if (inputRows.length > 1) {
      out.push(inputRows[1]);
    } else {
      out.push(line(prompt + value, width));
    }
  }
  out.push(styleText(border(width, "─"), { fg: "border" }));
  if (height > 5) {
    let loading = "";
    if (state.running) {
      let label = tr(state, "running");
      if (state.cancelRequested) {
        label = tr(state, "cancelling");
      }
      loading = color(loadingFrame(state.tick || 0), "warning") + " " + styleText(label, { fg: "muted" });
    }
    out.push(line(loading, width));
  }

  if (height > 4) {
    let summary = tr(state, "quit") + "  " + tr(state, "chars") + "=" + String(chars(state.taskText).length) + "  " + tr(state, "width") + "=" + String(visibleWidth(current));
    if (state.commandOpen) {
      summary = tr(state, "commandPanel") + "  " + tr(state, "enterRun") + "  " + tr(state, "escClose") + "  " + tr(state, "commandQuery") + "=" + String(state.commandQuery || "");
    }
    if (state.focus !== "task") {
      summary = summary + "  " + tr(state, "focus") + "=" + state.focus;
    }
    out.push(styleText(line(summary, width), { dim: true, fg: "muted" }));
  }

  while (out.length < height) {
    out.push("");
  }
  return out.map(function(item) {
    return line(item, width);
  });
}

function commandMatches(state) {
  let query = String(state.commandQuery || "").toLowerCase();
  let out = [];
  for (let item of commandItems(state)) {
    let aliases = "";
    if (item.aliases) {
      aliases = item.aliases.join(" ");
    }
    let haystack = (item.name + " " + item.description + " " + aliases).toLowerCase();
    if (query === "" || haystack.indexOf(query) >= 0) {
      out.push(item);
    }
  }
  return out;
}

function drawCommandPanel(state, width, height) {
  let out = [];
  let query = String(state.commandQuery || "");
  let header = "/" + query;
  if (header === "/") {
    header = tr(state, "commandsHeader");
  }
  out.push(styleText(line(header, width), { bold: true, fg: "warning" }));
  out.push(styleText(line(tr(state, "commandHelp"), width), { dim: true, fg: "muted" }));

  let matches = commandMatches(state);
  let selected = state.commandSelected || 0;
  if (matches.length === 0) {
    out.push(styleText(line(tr(state, "noCommands"), width), { dim: true, fg: "muted" }));
  } else {
    let bodyHeight = height - 2;
    if (bodyHeight < 1) {
      bodyHeight = 1;
    }
    let start = 0;
    if (selected >= bodyHeight) {
      start = selected - bodyHeight + 1;
    }
    for (let i = 0; i < bodyHeight; i = i + 1) {
      let index = start + i;
      let row = "";
      if (index < matches.length) {
        let item = matches[index];
        row = "  " + item.name + "  " + styleText(item.description, { dim: true, fg: "muted" });
        if (index === selected) {
          row = INVERSE + padRight(truncateToWidth("> " + item.name + "  " + item.description, width), width) + RESET;
        }
      }
      out.push(row);
    }
  }

  while (out.length < height) {
    out.push("");
  }
  return out.map(function(row) {
    return line(row, width);
  });
}

function pushWrappedWithPrefix(out, prefix, text, width, style) {
  let bodyWidth = width - visibleWidth(prefix);
  if (bodyWidth < 8) {
    bodyWidth = width;
    prefix = "";
  }
  let rows = wrapText(text, bodyWidth);
  for (let i = 0; i < rows.length; i = i + 1) {
    let mark = prefix;
    if (i > 0) {
      mark = repeatText(" ", visibleWidth(prefix));
    }
    let row = styleText(mark, { fg: "border" }) + rows[i];
    if (style) {
      row = styleText(row, style);
    }
    out.push(line(row, width));
  }
}

function compactJson(value) {
  if (!value) {
    return "{}";
  }
  let text = JSON.stringify(value);
  if (!text) {
    return "{}";
  }
  return text;
}

function transcriptContentWidth(width) {
  let available = Math.floor(width * 0.8);
  if (available < 20) {
    available = 20;
  }
  if (available > width) {
    available = width;
  }
  return available;
}

function transcriptLine(text, contentWidth, fullWidth) {
  return line(line(text, contentWidth), fullWidth);
}

function transcriptRows(state, width) {
  if (state.transcriptCache) {
    if (state.transcriptCache.width === width && state.transcriptCache.events === state.events.length) {
      return state.transcriptCache.rows;
    }
  }

  let out = [];
  if (state.events.length === 0) {
    out.push(styleText(tr(state, "noMessages"), { dim: true, fg: "muted" }));
    out.push(styleText(tr(state, "restoreSession"), { dim: true, fg: "muted" }));
    state.transcriptCache = {
      width: width,
      events: state.events.length,
      rows: out,
    };
    return out;
  }

  let lastAssistantText = "";
  let pendingToolRows = {};
  for (let event of state.events) {
    let payload = event.payload;
    if (!payload) {
      continue;
    }

    if (event.kind === "message") {
      if (payload.role === "user") {
        out.push(styleText(transcriptLine("> " + safeText(payload.content).split("\n")[0], width, width), { inverse: true }));
        let rest = splitLines(safeText(payload.content));
        for (let i = 1; i < rest.length; i = i + 1) {
          out.push(styleText(transcriptLine("  " + rest[i], width, width), { inverse: true }));
        }
        out.push("");
        continue;
      }
      if (payload.role === "assistant") {
        lastAssistantText = displayText(payload.content);
        let md = Markdown({
          width: width - 2,
          text: lastAssistantText,
        });
        for (let row of md) {
          out.push(transcriptLine("  " + row, width, width));
        }
        out.push("");
        continue;
      }
    }

    if (event.kind === "tool_call") {
      let label = "Tool(" + safeText(payload.name) + ")";
      let key = safeText(payload.id || payload.name);
      pendingToolRows[key] = out.length;
      out.push(transcriptLine(color("● ", "muted") + styleText(label, { bold: true, fg: "text" }) + styleText(" " + compactJson(payload.args), { dim: true, fg: "muted" }), width, width));
      continue;
    }

    if (event.kind === "tool_result") {
      let key = safeText(payload.id || payload.name);
      let marker = toolResultDot(payload.content);
      if (key in pendingToolRows) {
        let label = "Tool(" + safeText(payload.name) + ")";
        out[pendingToolRows[key]] = transcriptLine(marker + " " + styleText(label, { bold: true, fg: "text" }), width, width);
        pushWrappedWithPrefix(out, "  | ", styleText(truncateToWidth(toolResultText(payload.content), width * 2), { fg: "muted" }), width, undefined);
      } else {
        pushWrappedWithPrefix(out, "  " + marker + " ", styleText(truncateToWidth(toolResultText(payload.content), width * 2), { fg: "muted" }), width, undefined);
      }
      continue;
    }

    if (event.kind === "llm_retry") {
      let text = "model retry " + String(payload.attempt) + "/" + String(payload.maxAttempts);
      if (payload.delayMs) {
        text = text + " after " + String(payload.delayMs) + "ms";
      }
      if (payload.error) {
        text = text + ": " + safeText(payload.error);
      }
      pushWrappedWithPrefix(out, "~ ", text, width, { bold: true, fg: "warning" });
      continue;
    }

    if (event.kind === "answer") {
      let answerText = displayText(payload.content);
      if (lastAssistantText !== "" && answerText === lastAssistantText) {
        continue;
      }
      let answerRows = Markdown({
        width: width - 2,
        text: answerText,
      });
      for (let row of answerRows) {
        out.push(transcriptLine("  " + row, width, width));
      }
      out.push("");
      continue;
    }

    if (event.kind === "turn_end") {
      out.push(transcriptLine(styleText("  turn " + String(payload.turn) + " ended: " + safeText(payload.stop), { dim: true, fg: "muted" }), width, width));
      continue;
    }

    if (event.kind === "error") {
      pushWrappedWithPrefix(out, "x ", safeText(payload.message), width, { bold: true, fg: "error" });
      continue;
    }
  }

  while (out.length > 0 && out[out.length - 1] === "") {
    out.pop();
  }
  state.transcriptCache = {
    width: width,
    events: state.events.length,
    rows: out,
  };
  return out;
}

function drawTranscript(state, width, height) {
  let bodyHeight = height - 1;
  if (bodyHeight < 1) {
    bodyHeight = 1;
  }
  let contentWidth = transcriptContentWidth(width);
  let rows = transcriptRows(state, contentWidth);
  let maxScroll = rows.length - bodyHeight;
  if (maxScroll < 0) {
    maxScroll = 0;
  }
  let offset = clampScroll(state.detailScroll, maxScroll);
  state.detailScroll = offset;
  let out = [];
  out.push(styleText(tr(state, "transcript"), { bold: true, fg: "text" }));
  for (let i = 0; i < bodyHeight; i = i + 1) {
    out.push(takeLine(rows, offset + i));
  }
  return out.map(function(item) {
    return line(item, width);
  });
}

function addScrollbar(rows, width, headerRows, offset, total) {
  if (width < 4 || rows.length <= headerRows) {
    return rows;
  }
  let bodyHeight = rows.length - headerRows;
  let maxScroll = total - bodyHeight;
  if (maxScroll < 0) {
    maxScroll = 0;
  }
  let thumbSize = bodyHeight;
  let thumbStart = 0;
  if (total > bodyHeight) {
    thumbSize = Math.floor(bodyHeight * bodyHeight / total);
    if (thumbSize < 1) {
      thumbSize = 1;
    }
    let track = bodyHeight - thumbSize;
    if (track < 0) {
      track = 0;
    }
    if (maxScroll > 0) {
      thumbStart = Math.floor(offset * track / maxScroll);
    }
  }

  let out = [];
  for (let i = 0; i < rows.length; i = i + 1) {
    let marker = " ";
    if (i >= headerRows) {
      let pos = i - headerRows;
      marker = "│";
      if (pos >= thumbStart && pos < thumbStart + thumbSize) {
        marker = "┃";
      }
      marker = styleText(marker, { fg: "muted" });
    }
    out.push(line(rows[i], width - 1) + marker);
  }
  return out;
}

function petRows(state, width) {
  let tick = state.tick || 0;
  let eyes = "oo";
  if (tick % 10 === 4) {
    eyes = "--";
  }
  let tail = "/";
  if (tick % 6 >= 3) {
    tail = "\\";
  }
  let status = tr(state, "idle");
  if (state.running) {
    status = tr(state, "running");
    if (state.cancelRequested) {
      status = tr(state, "cancelling");
    }
  }
  let retry = "";
  if (state.events) {
    for (let i = state.events.length - 1; i >= 0; i = i - 1) {
      let event = state.events[i];
      if (event.kind === "llm_retry") {
        retry = "  retry=" + String(event.payload.attempt) + "/" + String(event.payload.maxAttempts);
        break;
      }
      if (event.kind === "message" || event.kind === "answer" || event.kind === "error") {
        break;
      }
    }
  }
  let messages = 0;
  if (state.messages) {
    messages = state.messages.length;
  }
  let title = " gs-agent ";
  let topFill = width - visibleWidth(title) - 2;
  if (topFill < 0) {
    topFill = 0;
  }
  let top = color("┌", "warning") + styleText(title, { bold: true, fg: "warning" }) + color(repeatText("─", topFill) + "┐", "warning");
  let pet = [
    " /\\_/\\ " + tail,
    "( " + eyes + " )",
  ];
  let info = "status=" + status + "  messages=" + String(messages) + "  events=" + String(state.events.length) + retry;
  let hint = tr(state, "enterSend") + "  / commands";
  let inner = width - 2;
  if (inner < 1) {
    inner = 1;
  }
  return [
    line(top, width),
    color("│", "warning") + styleText(line(pet[0], 10), { bold: true, fg: "warning" }) + line(info, inner - 10) + color("│", "warning"),
    color("│", "warning") + styleText(line(pet[1], 10), { bold: true, fg: "warning" }) + styleText(line(hint, inner - 10), { dim: true, fg: "muted" }) + color("│", "warning"),
    line(color("└" + repeatText("─", width - 2) + "┘", "warning"), width),
  ];
}

function headerHeight(state) {
  return 4;
}

function viewportSize(state) {
  let cols = state.cols;
  let rows = state.rows;
  if ("safeCols" in state) {
    cols = state.safeCols;
  }
  if (cols < 40) {
    cols = 40;
  }
  if (rows < 12) {
    rows = 12;
  }
  return {
    cols: cols,
    rows: rows,
  };
}

export function renderContentFrame(state) {
  let size = viewportSize(state);
  let cols = size.cols;
  let rows = size.rows;
  let headerRows = petRows(state, cols);
  let fixedHeaderHeight = headerHeight(state);
  let hasContentRows = "contentRows" in state;
  if (hasContentRows) {
    rows = state.contentRows;
  }

  let composerHeight = 6;
  let commandHeight = 0;
  if (state.commandOpen) {
    commandHeight = 10;
    if (rows < 22) {
      commandHeight = 7;
    }
  }
  let transcriptHeight = rows;
  if (!hasContentRows) {
    transcriptHeight = rows - composerHeight;
  }
  transcriptHeight = transcriptHeight - commandHeight - fixedHeaderHeight;
  if (transcriptHeight < 1) {
    transcriptHeight = 1;
  }
  let transcript = drawTranscript(state, cols, transcriptHeight);

  let lines = [];
  for (let row of headerRows) {
    lines.push(row);
  }
  let detailsStart = lines.length + 1;
  for (let row of transcript) {
    lines.push(row);
  }

  let commandStart = lines.length + 1;
  if (state.commandOpen) {
    let panel = drawCommandPanel(state, cols, commandHeight);
    for (let row of panel) {
      lines.push(row);
    }
  }

  state.layout = {
    details: { row: detailsStart, col: 1, height: transcriptHeight, width: cols },
    command: { row: commandStart, col: 1, height: commandHeight, width: cols },
  };

  return lines.join("\n");
}

export function renderComposerFrame(state) {
  let size = viewportSize(state);
  let cols = size.cols;
  let composerHeight = 6;
  let start = size.rows - composerHeight + 1;
  if (start < 1) {
    start = 1;
  }
  state.layout = state.layout || {};
  state.layout.task = { row: start, col: 1, height: composerHeight, width: cols };
  state.layout.composer = { row: start, col: 1, height: composerHeight, width: cols };
  return drawComposer(state, cols, composerHeight).join("\n");
}

// 渲染当前逻辑屏幕，保留给 smoke test 和旧调用方；实际 agent TUI 会拆分内容区和底部输入区。
export function renderFrame(state) {
  let content = renderContentFrame(state);
  let composer = renderComposerFrame(state);
  if (content === "") {
    return composer;
  }
  return content + "\n" + composer;
}
