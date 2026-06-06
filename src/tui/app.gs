import { loadAgentApp, readTaskText, runAgentTurn, writeTaskText } from "@/agent/app";
import { createRunLogger, eventLogFields } from "@/agent/log";
import { createJSONLSession } from "@/agent/session/jsonl";
import { charWidth, chars } from "@/tui/ansi";
import { commandItems, toggleUiLanguage, tr } from "@/tui/i18n";
import { renderComposerFrame, renderContentFrame } from "@/tui/renderer";
import { runTuiApp } from "@/tui/runtime";

let fs = require("@std/fs");
let timers = require("@std/timers");

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
    cancelRequested: false,
    cancelToken: { cancelled: false },
    tick: 0,
    uiLanguage: "en",
    focus: "task",
    events: [],
    messages: [],
    detailScroll: 0,
    answer: "",
    error: "",
    commandOpen: false,
    commandQuery: "",
    commandSelected: 0,
    confirmExit: false,
    shouldExit: false,
    transcriptCache: null,
    transcriptMeasureCache: null,
  };
}

function invalidateTranscript(state) {
  state.transcriptCache = null;
  state.transcriptMeasureCache = null;
}

function scrollTranscriptToBottom(state) {
  // 先给一个足够大的值，下一次 sync/render 会按真实内容高度夹到最底部。
  state.detailScroll = 2147483647;
}

function addEvent(state, event) {
  state.events.push(event);
  invalidateTranscript(state);
  scrollTranscriptToBottom(state);
}

function sanitizeError(err) {
  let text = String(err);
  if (text.length > 160) {
    return text.slice(0, 160) + "...";
  }
  return text;
}

function render(state) {
  return renderContentFrame(state);
}

function renderFixedBottom(state) {
  return renderComposerFrame(state);
}

function saveTask(state) {
  writeTaskText(state.app.root, state.app.taskFile, state.taskText);
  state.dirty = false;
  state.confirmExit = false;
    state.error = tr(state, "saved");
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
  let last = undefined;
  if (state.events.length > 0) {
    last = state.events[state.events.length - 1];
  }
  if (last) {
    if (last.kind === "message") {
      if (last.payload) {
        if (last.payload.role === "assistant" && String(last.payload.content) === String(state.answer)) {
          return;
        }
      }
    }
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
  invalidateTranscript(state);
  let session = createJSONLSession(state.app.sessionFile);
  if (fs.existsSync(state.app.sessionFile)) {
    state.events = session.readAll();
  }
  state.messages = session.readMessages({ levels: ["primary", "working"] });
  invalidateTranscript(state);
  state.answer = readAnswer(state);
  appendAnswerEvent(state);
  state.detailScroll = 0;
  if (state.events.length === 0) {
    state.error = tr(state, "noRecentSession");
  } else {
    state.error = tr(state, "sessionLoaded");
  }
  state.logger.info("recent session loaded", {
    sessionFile: state.app.sessionFile,
    answerFile: state.app.answerFile,
    events: state.events.length,
    messages: state.messages.length,
    hasAnswer: !!state.answer,
  });
}

function resetConversationState(state) {
  state.events = [];
  state.messages = [];
  state.detailScroll = 0;
  state.answer = "";
  invalidateTranscript(state);
}

function removeFileIfExists(file) {
  if (!file) {
    return;
  }
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
}

export function startNewSession(state) {
  resetConversationState(state);
  removeFileIfExists(state.app.sessionFile);
  removeFileIfExists(state.app.sessionArchiveFile);
  removeFileIfExists(state.app.answerFile);
  state.error = tr(state, "newSession");
  state.logger.info("new session started", {
    sessionFile: state.app.sessionFile,
    sessionArchiveFile: state.app.sessionArchiveFile,
    answerFile: state.app.answerFile,
  });
}

function clearInput(state) {
  state.taskText = "";
  state.taskScroll = 0;
  state.cursorLine = 0;
  state.cursorCol = 0;
  state.dirty = false;
}

function runMessageTurn(state, ctx, input) {
  try {
    let token = state.cancelToken;
    let result = runAgentTurn({
      app: state.app,
      logger: state.logger.child("agent"),
      messages: state.messages,
      input: input,
      isCancelled: function() {
        return !!token.cancelled;
      },
      onEvent: function(event) {
        addEvent(state, event);
        state.logger.info("tui received event", eventLogFields(event));
      },
    });
    state.answer = result.answer;
    state.messages = result.messages;
    if (token.cancelled) {
      state.error = tr(state, "interrupted");
    } else {
      state.error = tr(state, "done");
    }
    state.logger.info("message send completed", {
      events: result.events,
      messages: state.messages.length,
      answerFile: result.answerFile,
      sessionFile: result.sessionFile,
    });
  } catch (err) {
    state.error = sanitizeError(err);
    state.logger.error("message send failed", {
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
  state.cancelRequested = false;
}

function sendMessage(state, ctx) {
  if (state.running) {
    state.error = tr(state, "alreadyRunning");
    return;
  }

  if (state.taskText.trim() === "") {
    state.error = tr(state, "taskEmpty");
    return;
  }

  let input = state.taskText.trim();
  saveTask(state);
  clearInput(state);
  state.running = true;
  state.cancelRequested = false;
  state.cancelToken = { cancelled: false };
  state.error = "";
  state.detailScroll = 0;
  state.tick = 0;
  state.logger.info("message send requested", {
    taskFile: state.app.taskFile,
    chars: chars(input).length,
    messages: state.messages.length,
  });
  ctx.render();
  timers.setTimeout(function() {
    runMessageTurn(state, ctx, input);
  }, 0);
}

function requestInterrupt(state) {
  if (!state.running) {
    return false;
  }
  if (state.cancelToken) {
    state.cancelToken.cancelled = true;
  }
  state.cancelRequested = true;
  state.error = tr(state, "interruptRequested");
  state.logger.warn("interrupt requested", {});
  return true;
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
  if (keyId === "home") {
    state.cursorCol = 0;
  } else if (keyId === "end") {
    state.cursorCol = charLength(lines[state.cursorLine]);
  } else if (keyId === "up") {
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

function eventTextForTranscript(event) {
  if (!event) {
    return "";
  }
  let payload = event.payload;
  if (!payload) {
    return "";
  }
  if (event.kind === "message") {
    return String(payload.content || "");
  }
  if (event.kind === "tool_call") {
    return "Tool(" + String(payload.name || "") + ") " + JSON.stringify(payload.args || {});
  }
  if (event.kind === "tool_result") {
    return String(payload.content || "");
  }
  if (event.kind === "turn_end") {
    return "turn " + String(payload.turn) + " ended: " + String(payload.stop || "");
  }
  if (event.kind === "error") {
    return String(payload.message || "");
  }
  if (event.kind === "answer") {
    return String(payload.content || "");
  }
  return JSON.stringify(event);
}

function estimateTranscriptLines(state, width) {
  if (state.transcriptCache) {
    if (state.transcriptCache.width === width && state.transcriptCache.events === state.events.length) {
      return state.transcriptCache.rows.length;
    }
  }
  if (state.transcriptMeasureCache) {
    if (state.transcriptMeasureCache.width === width && state.transcriptMeasureCache.events === state.events.length) {
      return state.transcriptMeasureCache.lines;
    }
  }

  let total = 0;
  if (state.events.length === 0) {
    return 2;
  }
  for (let event of state.events) {
    let lines = estimateWrappedLines(eventTextForTranscript(event), width);
    if (lines < 1) {
      lines = 1;
    }
    total = total + lines;
    if (event.kind === "message") {
      total = total + 1;
    }
  }
  state.transcriptMeasureCache = {
    width: width,
    events: state.events.length,
    lines: total,
  };
  return total;
}

function transcriptMeasureWidth(width) {
  let available = Math.floor(width * 0.8);
  if (available < 20) {
    available = 20;
  }
  if (available > width) {
    available = width;
  }
  return available;
}

function detailBodyHeight(state) {
  if (state.layout) {
    if (state.layout.details) {
      let height = state.layout.details.height - 1;
      if (height < 1) {
        return 1;
      }
      return height;
    }
  }
  let bannerHeight = 5;
  if (state.cols < 76) {
    bannerHeight = 1;
  }
  let composerHeight = 6;
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

function taskBodyHeight(state) {
  if (!state.layout) {
    return 1;
  }
  if (!state.layout.task) {
    return 1;
  }
  let height = state.layout.task.height - 4;
  if (height < 1) {
    return 1;
  }
  return height;
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

function syncDetailViewport(state) {
  let bodyHeight = detailBodyHeight(state);
  if (bodyHeight < 1) {
    bodyHeight = 1;
  }
  let total = estimateTranscriptLines(state, transcriptMeasureWidth(state.cols));
  let maxScroll = total - bodyHeight;
  if (maxScroll < 0) {
    maxScroll = 0;
  }
  state.detailScroll = clamp(state.detailScroll, 0, maxScroll);
}

function syncViewState(state) {
  syncTaskViewport(state);
  syncDetailViewport(state);
}

function moveDetails(state, delta) {
  let bodyHeight = detailBodyHeight(state);
  if (bodyHeight < 1) {
    bodyHeight = 1;
  }
  let total = estimateTranscriptLines(state, transcriptMeasureWidth(state.cols));
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

function handleMouse(state, item) {
  let region = mouseRegion(state, item);
  if (region === "") {
    return;
  }
  state.focus = region;
  state.confirmExit = false;

  if (item.action === "wheelUp") {
    if (region === "task") {
      scrollTask(state, -1);
    } else if (region === "details") {
      moveDetails(state, -1);
    }
    return;
  }

  if (item.action === "wheelDown") {
    if (region === "task") {
      scrollTask(state, 1);
    } else if (region === "details") {
      moveDetails(state, 1);
    }
  }
}

function nextFocus(state) {
  if (state.focus === "task") {
    state.focus = "details";
  } else {
    state.focus = "task";
  }
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

function clampCommandSelection(state) {
  let matches = commandMatches(state);
  let max = matches.length - 1;
  if (max < 0) {
    max = 0;
  }
  state.commandSelected = clamp(state.commandSelected, 0, max);
}

function openCommandPanel(state) {
  state.commandOpen = true;
  state.commandQuery = "";
  state.commandSelected = 0;
  state.confirmExit = false;
  state.error = tr(state, "commandPanelStatus");
}

function closeCommandPanel(state) {
  state.commandOpen = false;
  state.commandQuery = "";
  state.commandSelected = 0;
  if (state.error === tr(state, "commandPanelStatus")) {
    state.error = "";
  }
}

function executeCommand(state, ctx, command) {
  closeCommandPanel(state);
  if (!command) {
    return;
  }

  if (command.id === "send") {
    sendMessage(state, ctx);
  } else if (command.id === "new") {
    startNewSession(state);
  } else if (command.id === "load") {
    loadRecentSession(state);
  } else if (command.id === "save") {
    saveTask(state);
  } else if (command.id === "clear") {
    clearInput(state);
    state.error = tr(state, "inputCleared");
  } else if (command.id === "focus") {
    nextFocus(state);
  } else if (command.id === "language") {
    toggleUiLanguage(state);
    state.error = tr(state, "languageChanged");
    state.transcriptCache = null;
    state.transcriptMeasureCache = null;
  } else if (command.id === "quit") {
    state.shouldExit = true;
  }
}

function handleCommandKey(state, item, ctx) {
  if (item.id === "ctrl+c") {
    closeCommandPanel(state);
    return true;
  }
  if (item.id === "escape") {
    closeCommandPanel(state);
    return true;
  }
  if (item.id === "backspace") {
    if (state.commandQuery !== "") {
      let list = chars(state.commandQuery);
      state.commandQuery = list.slice(0, list.length - 1).join("");
      state.commandSelected = 0;
    } else {
      closeCommandPanel(state);
    }
    return true;
  }
  if (item.id === "up") {
    state.commandSelected = state.commandSelected - 1;
    clampCommandSelection(state);
    return true;
  }
  if (item.id === "down") {
    state.commandSelected = state.commandSelected + 1;
    clampCommandSelection(state);
    return true;
  }
  if (item.id === "enter") {
    let matches = commandMatches(state);
    executeCommand(state, ctx, matches[state.commandSelected]);
    return true;
  }
  if (item.id === "text") {
    state.commandQuery = state.commandQuery + item.text;
    state.commandSelected = 0;
    clampCommandSelection(state);
    return true;
  }
  if (item.id === "paste") {
    state.commandQuery = state.commandQuery + item.text;
    state.commandSelected = 0;
    clampCommandSelection(state);
    return true;
  }
  return true;
}

function handleKey(state, item, ctx) {
  if (item.id === "mouse") {
    handleMouse(state, item);
    return;
  }

  if (state.commandOpen) {
    if (item.id === "escape" && state.running) {
      closeCommandPanel(state);
      requestInterrupt(state);
      return;
    }
    handleCommandKey(state, item, ctx);
    return;
  }

  if (item.id === "escape") {
    requestInterrupt(state);
    return;
  }

  if (item.id === "text" && item.text === "/" && state.taskText.trim() === "") {
    openCommandPanel(state);
    return;
  }

  if (item.id === "ctrl+c") {
    if (state.dirty && !state.confirmExit) {
      state.confirmExit = true;
      state.error = tr(state, "unsavedExit");
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
    sendMessage(state, ctx);
    return;
  }
  if (item.id === "tab" || item.id === "shift+tab") {
    nextFocus(state);
    state.logger.debug("focus changed", {
      focus: state.focus,
    });
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
    } else if (item.id === "up" || item.id === "down" || item.id === "left" || item.id === "right" || item.id === "home" || item.id === "end") {
      moveCursor(state, item.id);
    } else if (item.id === "pageUp") {
      moveDetails(state, -8);
    } else if (item.id === "pageDown") {
      moveDetails(state, 8);
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
  let app = loadAgentApp();
  let state = runTuiApp({
    name: "gs-agent tui",
    title: "gs-agent tui",
    alternateScreen: true,
    mouse: true,
    mouseMode: "wheel",
    resizeDebounceMs: 80,
    clearScrollbackOnResize: false,
    fixedBottomRows: 6,
    safeRightCols: 2,
    tickMs: 120,
    createState: function(size) {
      return createStateWithSize(app, size);
    },
    render: render,
    renderFixedBottom: renderFixedBottom,
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
      startNewSession(state);
      syncViewState(state);
    },
    onKey: function(state, item, ctx) {
      handleKey(state, item, ctx);
      syncViewState(state);
    },
    onResize: function(state) {
      invalidateTranscript(state);
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
