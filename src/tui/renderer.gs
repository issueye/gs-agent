import { BOLD, DIM, INVERSE, RESET, charWidth, chars, color, line, padRight, styleText, truncateToWidth, visibleWidth } from "@/tui/ansi";
import { compactLoading } from "@/tui/loading";
import { banner, border, clampScroll, joinColumns, renderLines, scrollTitle, splitLines, takeLine, wrapText } from "@/tui/widgets";

function safeText(value) {
  if (!value) {
    return "";
  }
  return String(value);
}

function bannerLines(width) {
  let wide = [
    "  ____ ____        _    ____ _____ _   _ _____ ",
    " / ___/ ___|      / \\  / ___| ____| \\ | |_   _|",
    "| |  _\\___ \\_____/ _ \\| |  _|  _| |  \\| | | |  ",
    "| |_| |___) |___/ ___ \\ |_| | |___| |\\  | | |  ",
    " \\____|____/   /_/   \\_\\____|_____|_| \\_| |_|  ",
  ];

  return banner({
    width: width,
    title: "GS-AGENT",
    wide: wide,
    minWidth: 76,
    color: 36,
  });
}

function eventTitle(event) {
  if (!event) {
    return "no event";
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
  return safeText(kind);
}

export function eventSummary(event) {
  if (!event) {
    return "";
  }

  let title = eventTitle(event);
  let payload = event.payload;
  if (event.kind === "message" && payload.content) {
    return title + " - " + safeText(payload.content).split("\n")[0];
  }
  if (event.kind === "tool_call") {
    return title + " " + JSON.stringify(payload.args);
  }
  if (event.kind === "tool_result" && payload.content) {
    return title + " " + truncateToWidth(payload.content, 60);
  }
  if (event.kind === "error") {
    return title + " " + safeText(payload.message);
  }
  if (event.kind === "answer") {
    return title + " - " + safeText(payload.content).split("\n")[0];
  }
  return title;
}

export function eventDetails(event) {
  if (!event) {
    return "No event selected.";
  }
  if (event.kind === "answer") {
    return safeText(event.payload.content);
  }
  return JSON.stringify(event, null, 2);
}

function configLabel(state) {
  let agent = state.app.agent;
  let tools = agent.tools;
  let toolCount = 0;
  if (tools) {
    toolCount = tools.length;
  }
  let model = "unknown";
  if (state.app.config.llm) {
    if (state.app.config.llm.anthropic) {
      if (state.app.config.llm.anthropic.model) {
        model = state.app.config.llm.anthropic.model;
      }
    }
  }
  return "gs-agent  provider=" + agent.provider + "  model=" + model + "  maxTurns=" + String(agent.maxTurns) + "  tools=" + String(toolCount);
}

function statusText(state) {
  let run = "idle";
  if (state.running) {
    run = compactLoading(true, state.tick, "running");
  }
  let dirty = "";
  if (state.dirty) {
    dirty = " modified";
  }
  let error = "";
  if (state.error) {
    error = "  error=" + state.error;
  }
  let answer = "";
  if (state.answer) {
    answer = "  answer=ready";
  }
  let log = "";
  if (state.app.latestLogFile) {
    log = "  log=.agent/logs/latest.log";
  }
  return run + dirty + "  events=" + String(state.events.length) + answer + error + log;
}

function drawTask(state, width, height) {
  let out = [];
  out.push(styleText("Task", { bold: true, fg: "accent" }) + " " + styleText(state.app.taskFile, { dim: true, fg: "muted" }));
  let lines = splitLines(state.taskText);
  let bodyHeight = height - 1;
  let offset = state.taskScroll;

  for (let i = 0; i < bodyHeight; i = i + 1) {
    let prefix = "  ";
    let text = takeLine(lines, offset + i);
    if (state.focus === "task" && offset + i === state.cursorLine) {
      prefix = "* ";
    }
    out.push(prefix + text);
  }
  while (out.length < height) {
    out.push("");
  }
  return addScrollbar(out.map(function(item) {
    return line(item, width);
  }), width, 1, state.taskScroll, splitLines(state.taskText).length);
}

function takeAroundCursor(text, cursor, width) {
  if (width < 1) {
    return "";
  }

  let list = chars(text);
  let col = cursor;
  if (col < 0) {
    col = 0;
  }
  if (col > list.length) {
    col = list.length;
  }

  let beforeBudget = Math.floor((width - 1) * 0.62);
  let afterBudget = width - 1 - beforeBudget;
  let before = [];
  let beforeWidth = 0;
  for (let i = col - 1; i >= 0; i = i - 1) {
    let ch = list[i];
    let next = charWidth(ch);
    if (beforeWidth + next > beforeBudget) {
      break;
    }
    before.unshift(ch);
    beforeWidth = beforeWidth + next;
  }

  let after = [];
  let afterWidth = 0;
  for (let i = col; i < list.length; i = i + 1) {
    let ch = list[i];
    let next = charWidth(ch);
    if (afterWidth + next > afterBudget) {
      break;
    }
    after.push(ch);
    afterWidth = afterWidth + next;
  }

  let result = before.join("") + "|" + after.join("");
  return line(result, width);
}

function drawComposer(state, width, height) {
  let lines = splitLines(state.taskText);
  let current = takeLine(lines, state.cursorLine);
  let currentLine = state.cursorLine + 1;
  let title = "Input " + state.app.taskFile + "  line " + String(currentLine) + "/" + String(lines.length);
  let out = [];
  out.push(styleText(title, { bold: true, fg: "accent" }));

  // 输入区固定占用整行宽度，避免编辑文本挤到右侧 Timeline 区域。
  let inputWidth = width - 2;
  if (inputWidth < 1) {
    inputWidth = 1;
  }
  out.push("> " + takeAroundCursor(current, state.cursorCol, inputWidth));

  if (height > 2) {
    let summary = "chars=" + String(chars(state.taskText).length) + "  width=" + String(visibleWidth(current));
    if (state.focus !== "task") {
      summary = summary + "  focus=" + state.focus;
    }
    out.push(styleText(summary, { dim: true, fg: "muted" }));
  }

  while (out.length < height) {
    out.push("");
  }
  return out.map(function(item) {
    return line(item, width);
  });
}

function drawTimeline(state, width, height) {
  let out = [];
  out.push(styleText("Run Timeline", { bold: true, fg: "accent" }));
  let bodyHeight = height - 1;
  let offset = state.eventScroll;

  for (let i = 0; i < bodyHeight; i = i + 1) {
    let index = offset + i;
    let text = "";
    if (index < state.events.length) {
      text = eventSummary(state.events[index]);
    }
    if (index === state.selectedEvent && state.focus === "timeline") {
      text = INVERSE + padRight(truncateToWidth(text, width), width) + RESET;
    }
    out.push(text);
  }
  while (out.length < height) {
    out.push("");
  }
  return addScrollbar(renderLines(out, width, height), width, 1, state.eventScroll, state.events.length);
}

function drawDetails(state, width, height) {
  let event = undefined;
  if (state.selectedEvent >= 0 && state.selectedEvent < state.events.length) {
    event = state.events[state.selectedEvent];
  }
  let text = eventDetails(event);
  if (!event) {
    if (state.answer) {
      text = state.answer;
    }
  }
  let bodyHeight = height - 1;
  if (bodyHeight < 1) {
    bodyHeight = 1;
  }
  let lines = wrapText(text, width - 1);
  let maxScroll = lines.length - bodyHeight;
  if (maxScroll < 0) {
    maxScroll = 0;
  }
  let detailScroll = clampScroll(state.detailScroll, maxScroll);
  let out = [];
  out.push(styleText(scrollTitle("Details", detailScroll, bodyHeight, lines.length), { bold: true, fg: "accent" }));
  for (let i = 0; i < bodyHeight; i = i + 1) {
    out.push(takeLine(lines, detailScroll + i));
  }
  while (out.length < height) {
    out.push("");
  }
  return addScrollbar(out.map(function(item) {
    return line(item, width);
  }), width, 1, detailScroll, lines.length);
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
      marker = "|";
      if (pos >= thumbStart && pos < thumbStart + thumbSize) {
        marker = "#";
      }
      marker = styleText(marker, { fg: "muted" });
    }
    out.push(line(rows[i], width - 1) + marker);
  }
  return out;
}

// 渲染当前逻辑屏幕，实际输出由 screen renderer 做局部刷新。
export function renderFrame(state) {
  let cols = state.cols;
  let rows = state.rows;
  if (cols < 40) {
    cols = 40;
  }
  if (rows < 12) {
    rows = 12;
  }

  let banner = bannerLines(cols);
  let header = line(configLabel(state), cols);
  let status = line(statusText(state), cols);
  let footer = line("Ctrl+R Run  Ctrl+S Save  Ctrl+O Load Session  Tab Focus  Arrows/Page Scroll  Ctrl+Q/Esc Quit", cols);
  let composerHeight = 3;
  let available = rows - banner.length - composerHeight - 6;
  if (available < 7) {
    available = 7;
  }
  // 回答区是 agent TUI 的主要阅读区域，默认给它更多高度。
  let topHeight = Math.floor(available * 0.44);
  if (topHeight < 4) {
    topHeight = 4;
  }
  let detailHeight = available - topHeight;
  if (detailHeight < 3) {
    detailHeight = 3;
    topHeight = available - detailHeight;
  }
  let leftWidth = Math.floor((cols - 1) * 0.42);
  let rightWidth = cols - 1 - leftWidth;

  let task = drawTask(state, leftWidth, topHeight);
  let timeline = drawTimeline(state, rightWidth, topHeight);
  let details = drawDetails(state, cols, detailHeight);
  let composer = drawComposer(state, cols, composerHeight);

  let lines = [];
  for (let row of banner) {
    lines.push(row);
  }
  lines.push(header);
  lines.push(status);
  lines.push(border(cols));
  let topStart = lines.length + 1;
  for (let row of joinColumns(task, timeline, leftWidth, rightWidth)) {
    lines.push(row);
  }
  lines.push(border(cols));
  let detailsStart = lines.length + 1;
  for (let row of details) {
    lines.push(row);
  }
  lines.push(border(cols));
  let composerStart = lines.length + 1;
  for (let row of composer) {
    lines.push(row);
  }
  lines.push(footer);

  state.layout = {
    task: { row: topStart, col: 1, height: topHeight, width: leftWidth },
    timeline: { row: topStart, col: leftWidth + 2, height: topHeight, width: rightWidth },
    details: { row: detailsStart, col: 1, height: detailHeight, width: cols },
    composer: { row: composerStart, col: 1, height: composerHeight, width: cols },
  };

  return lines.join("\n");
}
