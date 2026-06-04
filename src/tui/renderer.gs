import { BOLD, DIM, INVERSE, RESET, chars, fg, line, padRight, repeatText, truncateToWidth } from "@/tui/ansi";

function safeText(value) {
  if (!value) {
    return "";
  }
  return String(value);
}

function splitLines(text) {
  return safeText(text).replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
}

function takeLine(lines, index) {
  if (index < 0 || index >= lines.length) {
    return "";
  }
  return lines[index];
}

function border(width) {
  return repeatText("-", width);
}

function bannerLines(width) {
  let wide = [
    "  ____ ____        _    ____ _____ _   _ _____ ",
    " / ___/ ___|      / \\  / ___| ____| \\ | |_   _|",
    "| |  _\\___ \\_____/ _ \\| |  _|  _| |  \\| | | |  ",
    "| |_| |___) |___/ ___ \\ |_| | |___| |\\  | | |  ",
    " \\____|____/   /_/   \\_\\____|_____|_| \\_| |_|  ",
  ];

  if (width >= 76) {
    return wide.map(function(row) {
      return BOLD + fg(36) + line(row, width) + RESET;
    });
  }

  return [
    BOLD + fg(36) + line("GS-AGENT", width) + RESET,
  ];
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
  return title;
}

export function eventDetails(event) {
  if (!event) {
    return "No event selected.";
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
  if (state.app.config.llm && state.app.config.llm.anthropic && state.app.config.llm.anthropic.model) {
    model = state.app.config.llm.anthropic.model;
  }
  return "gs-agent  provider=" + agent.provider + "  model=" + model + "  maxTurns=" + String(agent.maxTurns) + "  tools=" + String(toolCount);
}

function statusText(state) {
  let run = "idle";
  if (state.running) {
    run = "running";
  }
  let dirty = "";
  if (state.dirty) {
    dirty = " modified";
  }
  let error = "";
  if (state.error) {
    error = "  error=" + state.error;
  }
  return run + dirty + "  events=" + String(state.events.length) + error;
}

function drawTask(state, width, height) {
  let out = [];
  out.push(BOLD + "Task" + RESET + " " + DIM + state.app.taskFile + RESET);
  let lines = splitLines(state.taskText);
  let bodyHeight = height - 1;
  let offset = state.taskScroll;
  if (state.focus === "task") {
    let currentLine = state.cursorLine;
    if (currentLine < offset) {
      offset = currentLine;
      state.taskScroll = offset;
    }
    if (currentLine >= offset + bodyHeight) {
      offset = currentLine - bodyHeight + 1;
      state.taskScroll = offset;
    }
  }

  for (let i = 0; i < bodyHeight; i = i + 1) {
    let prefix = "  ";
    let text = takeLine(lines, offset + i);
    if (state.focus === "task" && offset + i === state.cursorLine) {
      prefix = "> ";
      let col = state.cursorCol;
      if (col < 0) {
        col = 0;
      }
      let list = chars(text);
      if (col > list.length) {
        col = list.length;
      }
      // 用一个可见竖线提示插入位置；第一版先不用硬件光标，减少终端兼容风险。
      text = list.slice(0, col).join("") + "|" + list.slice(col).join("");
    }
    out.push(prefix + text);
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
  out.push(BOLD + "Run Timeline" + RESET);
  let bodyHeight = height - 1;
  let offset = state.eventScroll;
  if (state.selectedEvent < offset) {
    offset = state.selectedEvent;
    state.eventScroll = offset;
  }
  if (state.selectedEvent >= offset + bodyHeight) {
    offset = state.selectedEvent - bodyHeight + 1;
    state.eventScroll = offset;
  }

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
  return out.map(function(item) {
    return line(item, width);
  });
}

function drawDetails(state, width, height) {
  let event = undefined;
  if (state.selectedEvent >= 0 && state.selectedEvent < state.events.length) {
    event = state.events[state.selectedEvent];
  }
  let text = eventDetails(event);
  if (!event && state.answer) {
    text = state.answer;
  }
  let lines = splitLines(text);
  let out = [];
  out.push(BOLD + "Details" + RESET);
  for (let i = 0; i < height - 1; i = i + 1) {
    out.push(takeLine(lines, state.detailScroll + i));
  }
  while (out.length < height) {
    out.push("");
  }
  return out.map(function(item) {
    return line(item, width);
  });
}

function joinColumns(left, right, leftWidth, rightWidth) {
  let out = [];
  for (let i = 0; i < left.length; i = i + 1) {
    out.push(line(left[i], leftWidth) + "|" + line(right[i], rightWidth));
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
  let footer = line("Ctrl+R Run  Ctrl+S Save  Ctrl+O Load Session  Tab Focus  q Quit", cols);
  let available = rows - banner.length - 5;
  if (available < 7) {
    available = 7;
  }
  let topHeight = Math.floor(available * 0.58);
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

  let lines = [];
  for (let row of banner) {
    lines.push(row);
  }
  lines.push(header);
  lines.push(status);
  lines.push(border(cols));
  for (let row of joinColumns(task, timeline, leftWidth, rightWidth)) {
    lines.push(row);
  }
  lines.push(border(cols));
  for (let row of details) {
    lines.push(row);
  }
  lines.push(footer);

  return lines.join("\n");
}
