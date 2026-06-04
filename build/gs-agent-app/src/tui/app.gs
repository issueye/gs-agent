import { loadAgentApp, readTaskText, runAgentTask, writeTaskText } from "@/agent/app";
import { clearScreen, enterAlternateScreen, hideCursor, leaveAlternateScreen, showCursor } from "@/tui/ansi";
import { chars } from "@/tui/ansi";
import { parseKeys } from "@/tui/keys";
import { renderFrame } from "@/tui/renderer";
import { createScreenRenderer } from "@/tui/screen";

let fs = require("@std/fs");
let process = require("@std/process");
let terminal = require("@std/terminal");
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

function selectedEventIndex(state) {
  if (state.events.length === 0) {
    return -1;
  }
  return clamp(state.selectedEvent, 0, state.events.length - 1);
}

function createState(app) {
  let size = terminal.size();
  return {
    app: app,
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
    screen: undefined,
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
  if (state.screen) {
    state.screen.render(renderFrame(state), state.rows, state.cols);
  }
}

function saveTask(state) {
  writeTaskText(state.app.root, state.app.taskFile, state.taskText);
  state.dirty = false;
  state.confirmExit = false;
  state.error = "saved";
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
}

function runTask(session, state) {
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
  render(state);

  try {
    let result = runAgentTask({
      app: state.app,
      taskText: state.taskText,
      onEvent: function(event) {
        addEvent(state, event);
        render(state);
      },
    });
    state.answer = result.answer;
    appendAnswerEvent(state);
    state.error = "done";
  } catch (err) {
    state.error = sanitizeError(err);
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

function nextFocus(state) {
  if (state.focus === "task") {
    state.focus = "timeline";
  } else if (state.focus === "timeline") {
    state.focus = "details";
  } else {
    state.focus = "task";
  }
}

function handleKey(session, state, item) {
  if (item.id === "ctrl+c" || item.id === "ctrl+q" || item.id === "escape") {
    if (state.dirty && !state.confirmExit) {
      state.confirmExit = true;
      state.error = "unsaved task, press Esc again to quit";
      return;
    }
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
    runTask(session, state);
    return;
  }
  if (item.id === "tab" || item.id === "shift+tab") {
    nextFocus(state);
    return;
  }
  if (item.id === "q" && state.focus !== "task") {
    if (state.dirty && !state.confirmExit) {
      state.confirmExit = true;
      state.error = "unsaved task, press q again to quit";
      return;
    }
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
      state.detailScroll = clamp(state.detailScroll - 1, 0, 999999);
    } else if (item.id === "down") {
      state.detailScroll = state.detailScroll + 1;
    } else if (item.id === "pageUp") {
      state.detailScroll = clamp(state.detailScroll - 8, 0, 999999);
    } else if (item.id === "pageDown") {
      state.detailScroll = state.detailScroll + 8;
    }
  }
}

export function runAgentTui() {
  let app = loadAgentApp(process.cwd());
  let state = createState(app);
  let session = null;

  if (!terminal.isTTY("stdin") || !terminal.isTTY("stdout")) {
    throw new Error("gs-agent tui requires an interactive terminal");
  }

  session = terminal.start({
    raw: true,
    bracketedPaste: true,
    onInput: function(data) {
      let items = parseKeys(data);
      for (let item of items) {
        handleKey(session, state, item);
      }
      render(state);
      if (state.shouldExit) {
        session.stop();
      }
    },
    onResize: function(size) {
      state.cols = size.cols;
      state.rows = size.rows;
      render(state);
    },
  });

  session.setTitle("gs-agent tui");
  session.write(enterAlternateScreen());
  session.hideCursor();
  state.screen = createScreenRenderer(session);
  loadRecentSession(state);
  render(state);

  let tickTimer = timers.setInterval(function() {
    state.tick = state.tick + 1;
    if (state.running) {
      render(state);
    }
  }, 120);

  // 让事件循环保持运行；退出由 onInput 调用 session.stop()。
  while (!state.shouldExit) {
    timers.sleep(50);
  }

  timers.clearInterval(tickTimer);
  session.write(showCursor() + clearScreen() + leaveAlternateScreen());
  session.drainInput(80, 10);
  session.stop();
  return {
    events: state.events.length,
    answer: state.answer,
  };
}
