import { loadAgentApp, readTaskText, runAgentTask, writeTaskText } from "@/agent/app";
import { createRunLogger, eventLogFields } from "@/agent/log";
import { charWidth, chars } from "@/tui/ansi";
import { renderFrame } from "@/tui/renderer";
import { runTuiApp } from "@/tui/runtime";

let fs = require("@std/fs");
let process = require("@std/process");

function clamp(value, min, max) {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function splitTask(text) {
  let lines = String(text).replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  if (lines.length === 0) {
    lines.push("");
  }
  return lines;
}

function joinTask(lines) {
  return lines.join("\n");
}

function selectedEventIndex(state) {
  if (state.events.length === 0) {
    return -1;
  }
  return clamp(state.selectedEvent, 0, state.events.length - 1);
}

function createState(app) {
  return createStateWithSize(app, { cols: 80, rows: 24 });
}

function createStateWithSize(app, size) {
  let logger = createRunLogger(app.root, "tui");
  return {
    app: app,
    logger: logger,
    cols: size.cols,
    rows: size.rows,
    taskText: readTaskText(app.root, app.taskFile),
    taskScroll: 0,
    cursorLine: 0,
    cursorCol: 0,
    dirty: false,
    running: false,
    tick: 0,
    focus: "task",
    events: [],
    selectedEvent: -1,
    eventScroll: 0,
    detailScroll: 0,
    answer: "",
    error: "",
    confirmExit: false,
    shouldExit: false,
  };
}

function addEvent(state, event) {
  state.events.push(event);
  state.selectedEvent = state.events.length - 1;
  state.detailScroll = 0;
}

function sanitizeError(err) {
  let text = String(err);
  if (text.length > 160) {
    return text.slice(0, 160) + "...";
  }
  return text;
}

function render(state) {
  return renderFrame(state);
}

function saveTask(state) {
  writeTaskText(state.app.root, state.app.taskFile, state.taskText);
  state.dirty = false;
  state.confirmExit = false;
  state.error = "saved";
  state.logger.info("task saved", {
    taskFile: state.app.taskFile,
    chars: chars(state.taskText).length,
  });
}

function readAnswer(state) {
  if (!fs.existsSync(state.app.answerFile)) {
    return "";
  }
  return fs.readFileSync(state.app.answerFile).trim();
}

function appendAnswerEvent(state) {
  if (!state.answer) {
    return;
  }
  addEvent(state, {
    kind: "answer",
    payload: {
      content: state.answer,
      file: state.app.answerFile,
    },
  });
}

function loadRecentSession(state) {
  state.events = [];
  if (fs.existsSync(state.app.sessionFile)) {
    let lines = fs.readFileSync(state.app.sessionFile).split("\n");
    for (let line of lines) {
      let trimmed = line.trim();
      if (trimmed !== "") {
        state.events.push(JSON.parse(trimmed));
      }
    }
  }
  state.answer = readAnswer(state);
  appendAnswerEvent(state);
  state.selectedEvent = selectedEventIndex(state);
  state.detailScroll = 0;
  if (state.events.length === 0) {
    state.error = "no recent session";
  } else {
    state.error = "session loaded";
  }
  state.logger.info("recent session loaded", {
    sessionFile: state.app.sessionFile,
    answerFile: state.app.answerFile,
    events: state.events.length,
    hasAnswer: !!state.answer,
  });
}

function runTask(state, ctx) {
  if (state.running) {
    state.error = "already running";
    return;
  }

  if (state.taskText.trim() === "") {
    state.error = "task is empty";
    return;
  }

  saveTask(state);
  state.running = true;
  state.error = "";
  state.events = [];
  state.selectedEvent = -1;
  state.eventScroll = 0;
  state.detailScroll = 0;
  state.logger.info("run requested", {
    taskFile: state.app.taskFile,
    chars: chars(state.taskText).length,
  });
  ctx.render();

  try {
    let result = runAgentTask({
      app: state.app,
      logger: state.logger.child("agent"),
      taskText: state.taskText,
      onEvent: function(event) {
        addEvent(state, event);
        state.logger.info("tui received event", eventLogFields(event));
        ctx.render();
      },
    });
    state.answer = result.answer;
    appendAnswerEvent(state);
    state.error = "done";
    state.logger.info("run completed", {
      events: result.events,
      answerFile: result.answerFile,
      sessionFile: result.sessionFile,
    });
  } catch (err) {
    state.error = sanitizeError(err);
    state.logger.error("run failed", {
      error: String(err),
    });
    addEvent(state, {
      kind: "error",
      payload: {
        message: state.error,
      },
    });
  }

  state.running = false;
}

function currentTaskLines(state) {
  return splitTask(state.taskText);
}

function charLength(text) {
  return chars(text).length;
}

function splitAtChar(text, index) {
  let list = chars(text);
  return {
    before: list.slice(0, index).join(""),
    after: list.slice(index).join(""),
  };
}

function updateTaskText(state, lines) {
  state.taskText = joinTask(lines);
  state.dirty = true;
}

function insertText(state, text) {
  let lines = currentTaskLines(state);
  let line = lines[state.cursorLine];
  let parts = splitAtChar(line, state.cursorCol);
  lines[state.cursorLine] = parts.before + text + parts.after;
  state.cursorCol = state.cursorCol + charLength(text);
  updateTaskText(state, lines);
}

function insertNewline(state) {
  let lines = currentTaskLines(state);
  let line = lines[state.cursorLine];
  let parts = splitAtChar(line, state.cursorCol);
  let before = parts.before;
  let after = parts.after;
  lines.splice(state.cursorLine, 1, before, after);
  state.cursorLine = state.cursorLine + 1;
  state.cursorCol = 0;
  updateTaskText(state, lines);
}

function backspace(state) {
  let lines = currentTaskLines(state);
  if (state.cursorCol > 0) {
    let line = lines[state.cursorLine];
    let list = chars(line);
    lines[state.cursorLine] = list.slice(0, state.cursorCol - 1).join("") + list.slice(state.cursorCol).join("");
    state.cursorCol = state.cursorCol - 1;
    updateTaskText(state, lines);
    return;
  }

  if (state.cursorLine > 0) {
    let previous = lines[state.cursorLine - 1];
    let current = lines[state.cursorLine];
    state.cursorCol = charLength(previous);
    lines.splice(state.cursorLine - 1, 2, previous + current);
    state.cursorLine = state.cursorLine - 1;
    updateTaskText(state, lines);
  }
}

function moveCursor(state, keyId) {
  let lines = currentTaskLines(state);
  if (keyId === "up") {
    state.cursorLine = clamp(state.cursorLine - 1, 0, lines.length - 1);
  } else if (keyId === "down") {
    state.cursorLine = clamp(state.cursorLine + 1, 0, lines.length - 1);
  } else if (keyId === "left") {
    if (state.cursorCol > 0) {
      state.cursorCol = state.cursorCol - 1;
    } else if (state.cursorLine > 0) {
      state.cursorLine = state.cursorLine - 1;
      state.cursorCol = charLength(lines[state.cursorLine]);
    }
  } else if (keyId === "right") {
    if (state.cursorCol < charLength(lines[state.cursorLine])) {
      state.cursorCol = state.cursorCol + 1;
    } else if (state.cursorLine < lines.length - 1) {
      state.cursorLine = state.cursorLine + 1;
      state.cursorCol = 0;
    }
  }
  state.cursorCol = clamp(state.cursorCol, 0, charLength(lines[state.cursorLine]));
}

function moveTimeline(state, delta) {
  if (state.events.length === 0) {
    return;
  }
  state.selectedEvent = clamp(state.selectedEvent + delta, 0, state.events.length - 1);
  state.detailScroll = 0;
}

function estimateWrappedLines(text, width) {
  let bodyWidth = width;
  if (bodyWidth < 1) {
    bodyWidth = 1;
  }
  let count = 0;
  let lines = splitTask(text);
  for (let line of lines) {
    let used = 0;
    let wrapped = 1;
    for (let ch of chars(line)) {
      let cell = charWidth(ch);
      if (used > 0 && used + cell > bodyWidth) {
        wrapped = wrapped + 1;
        used = 0;
      }
      used = used + cell;
    }
    count = count + wrapped;
  }
  return count;
}

function currentDetailText(state) {
  let event = undefined;
  if (state.selectedEvent >= 0 && state.selectedEvent < state.events.length) {
    event = state.events[state.selectedEvent];
  }
  if (!event) {
    if (state.answer) {
      return state.answer;
    }
  }
  if (!event) {
    return "No event selected.";
  }
  if (event.kind === "answer") {
    return String(event.payload.content);
  }
  return JSON.stringify(event, null, 2);
}

function detailBodyHeight(state) {
  let bannerHeight = 5;
  if (state.cols < 76) {
    bannerHeight = 1;
  }
  let composerHeight = 3;
  let available = state.rows - bannerHeight - composerHeight - 6;
  if (available < 7) {
    available = 7;
  }
  let topHeight = Math.floor(available * 0.44);
  if (topHeight < 4) {
    topHeight = 4;
  }
  let detailHeight = available - topHeight;
  if (detailHeight < 3) {
    detailHeight = 3;
  }
  return detailHeight - 1;
}

function timelineBodyHeight(state) {
  if (!state.layout) {
    return 1;
  }
  if (!state.layout.timeline) {
    return 1;
  }
  return state.layout.timeline.height - 1;
}

function taskBodyHeight(state) {
  if (!state.layout) {
    return 1;
  }
  if (!state.layout.task) {
    return 1;
  }
  return state.layout.task.height - 1;
}

function syncTaskViewport(state) {
  let lines = currentTaskLines(state);
  state.cursorLine = clamp(state.cursorLine, 0, lines.length - 1);
  state.cursorCol = clamp(state.cursorCol, 0, charLength(lines[state.cursorLine]));

  let bodyHeight = taskBodyHeight(state);
  if (bodyHeight < 1) {
    bodyHeight = 1;
  }
  let maxScroll = lines.length - bodyHeight;
  if (maxScroll < 0) {
    maxScroll = 0;
  }
  state.taskScroll = clamp(state.taskScroll, 0, maxScroll);
  if (state.focus === "task" && state.cursorLine < state.taskScroll) {
    state.taskScroll = state.cursorLine;
  }
  if (state.focus === "task" && state.cursorLine >= state.taskScroll + bodyHeight) {
    state.taskScroll = state.cursorLine - bodyHeight + 1;
  }
}

function syncTimelineViewport(state) {
  if (state.events.length === 0) {
    state.selectedEvent = -1;
    state.eventScroll = 0;
    return;
  }

  state.selectedEvent = clamp(state.selectedEvent, 0, state.events.length - 1);
  let bodyHeight = timelineBodyHeight(state);
  if (bodyHeight < 1) {
    bodyHeight = 1;
  }
  let maxScroll = state.events.length - bodyHeight;
  if (maxScroll < 0) {
    maxScroll = 0;
  }
  state.eventScroll = clamp(state.eventScroll, 0, maxScroll);
  if (state.selectedEvent < state.eventScroll) {
    state.eventScroll = state.selectedEvent;
  }
  if (state.selectedEvent >= state.eventScroll + bodyHeight) {
    state.eventScroll = state.selectedEvent - bodyHeight + 1;
  }
}

function syncDetailViewport(state) {
  let bodyHeight = detailBodyHeight(state);
  if (bodyHeight < 1) {
    bodyHeight = 1;
  }
  let total = estimateWrappedLines(currentDetailText(state), state.cols);
  let maxScroll = total - bodyHeight;
  if (maxScroll < 0) {
    maxScroll = 0;
  }
  state.detailScroll = clamp(state.detailScroll, 0, maxScroll);
}

function syncViewState(state) {
  syncTaskViewport(state);
  syncTimelineViewport(state);
  syncDetailViewport(state);
}

function moveDetails(state, delta) {
  let bodyHeight = detailBodyHeight(state);
  if (bodyHeight < 1) {
    bodyHeight = 1;
  }
  let total = estimateWrappedLines(currentDetailText(state), state.cols);
  let maxScroll = total - bodyHeight;
  if (maxScroll < 0) {
    maxScroll = 0;
  }
  state.detailScroll = clamp(state.detailScroll + delta, 0, maxScroll);
}

function inRegion(item, region) {
  if (!region) {
    return false;
  }
  return item.row >= region.row && item.row < region.row + region.height && item.col >= region.col && item.col < region.col + region.width;
}

function mouseRegion(state, item) {
  if (!state.layout) {
    return "";
  }
  if (inRegion(item, state.layout.task)) {
    return "task";
  }
  if (inRegion(item, state.layout.timeline)) {
    return "timeline";
  }
  if (inRegion(item, state.layout.details)) {
    return "details";
  }
  if (inRegion(item, state.layout.composer)) {
    return "task";
  }
  return "";
}

function scrollTask(state, delta) {
  let lines = currentTaskLines(state);
  let bodyHeight = taskBodyHeight(state);
  let maxScroll = lines.length - bodyHeight;
  if (maxScroll < 0) {
    maxScroll = 0;
  }
  state.taskScroll = clamp(state.taskScroll + delta, 0, maxScroll);
}

function scrollTimeline(state, delta) {
  if (state.events.length === 0) {
    return;
  }
  let bodyHeight = timelineBodyHeight(state);
  let maxScroll = state.events.length - bodyHeight;
  if (maxScroll < 0) {
    maxScroll = 0;
  }
  state.eventScroll = clamp(state.eventScroll + delta, 0, maxScroll);
  state.selectedEvent = clamp(state.eventScroll, 0, state.events.length - 1);
  state.detailScroll = 0;
}

function handleMouse(state, item) {
  let region = mouseRegion(state, item);
  if (region === "") {
    return;
  }
  state.focus = region;
  state.confirmExit = false;

  if (item.action === "wheelUp") {
    if (region === "task") {
      scrollTask(state, -3);
    } else if (region === "timeline") {
      scrollTimeline(state, -3);
    } else if (region === "details") {
      moveDetails(state, -3);
    }
    return;
  }

  if (item.action === "wheelDown") {
    if (region === "task") {
      scrollTask(state, 3);
    } else if (region === "timeline") {
      scrollTimeline(state, 3);
    } else if (region === "details") {
      moveDetails(state, 3);
    }
  }
}

function nextFocus(state) {
  if (state.focus === "task") {
    state.focus = "timeline";
  } else if (state.focus === "timeline") {
    state.focus = "details";
  } else {
    state.focus = "task";
  }
}

function handleKey(state, item, ctx) {
  if (item.id === "mouse") {
    handleMouse(state, item);
    return;
  }

  if (item.id === "ctrl+c" || item.id === "ctrl+q" || item.id === "escape") {
    if (state.dirty && !state.confirmExit) {
      state.confirmExit = true;
      state.error = "unsaved task, press Esc again to quit";
      state.logger.warn("exit confirmation requested", {
        dirty: state.dirty,
      });
      return;
    }
    state.logger.info("exit requested", {
      key: item.id,
    });
    state.shouldExit = true;
    return;
  }
  if (item.id === "ctrl+s") {
    saveTask(state);
    return;
  }
  if (item.id === "ctrl+o") {
    loadRecentSession(state);
    return;
  }
  if (item.id === "ctrl+r") {
    state.confirmExit = false;
    runTask(state, ctx);
    return;
  }
  if (item.id === "tab" || item.id === "shift+tab") {
    nextFocus(state);
    state.logger.debug("focus changed", {
      focus: state.focus,
    });
    return;
  }
  if (item.id === "q" && state.focus !== "task") {
    if (state.dirty && !state.confirmExit) {
      state.confirmExit = true;
      state.error = "unsaved task, press q again to quit";
      state.logger.warn("exit confirmation requested", {
        dirty: state.dirty,
      });
      return;
    }
    state.logger.info("exit requested", {
      key: item.id,
    });
    state.shouldExit = true;
    return;
  }

  if (state.focus === "task") {
    if (item.id === "text") {
      state.confirmExit = false;
      insertText(state, item.text);
    } else if (item.id === "paste") {
      state.confirmExit = false;
      insertText(state, item.text);
    } else if (item.id === "enter") {
      state.confirmExit = false;
      insertNewline(state);
    } else if (item.id === "backspace") {
      state.confirmExit = false;
      backspace(state);
    } else if (item.id === "up" || item.id === "down" || item.id === "left" || item.id === "right") {
      moveCursor(state, item.id);
    }
    return;
  }

  if (state.focus === "timeline") {
    if (item.id === "up") {
      moveTimeline(state, -1);
    } else if (item.id === "down") {
      moveTimeline(state, 1);
    } else if (item.id === "pageUp") {
      moveTimeline(state, -8);
    } else if (item.id === "pageDown") {
      moveTimeline(state, 8);
    }
    return;
  }

  if (state.focus === "details") {
    if (item.id === "up") {
      moveDetails(state, -1);
    } else if (item.id === "down") {
      moveDetails(state, 1);
    } else if (item.id === "pageUp") {
      moveDetails(state, -8);
    } else if (item.id === "pageDown") {
      moveDetails(state, 8);
    }
  }
}

export function runAgentTui() {
  let app = loadAgentApp(process.cwd());
  let state = runTuiApp({
    name: "gs-agent tui",
    title: "gs-agent tui",
    tickMs: 120,
    createState: function(size) {
      return createStateWithSize(app, size);
    },
    render: render,
    onFatal: function(state, info) {
      state.logger.error("tui requires an interactive terminal", {
        error: info.error,
      });
    },
    onStart: function(state, ctx) {
      state.logger.info("tui started", {
        root: app.root,
        cols: state.cols,
        rows: state.rows,
        logFile: app.logFile,
        latestLogFile: app.latestLogFile,
      });
      loadRecentSession(state);
      syncViewState(state);
    },
    onKey: function(state, item, ctx) {
      handleKey(state, item, ctx);
      syncViewState(state);
    },
    onResize: function(state) {
      syncViewState(state);
      state.logger.info("terminal resized", {
        cols: state.cols,
        rows: state.rows,
      });
    },
    onTick: function(state) {
      return state.running;
    },
    onStop: function(state) {
      state.logger.info("tui stopped", {
        events: state.events.length,
        hasAnswer: !!state.answer,
      });
    },
  });
  return {
    events: state.events.length,
    answer: state.answer,
  };
}
