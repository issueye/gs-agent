let process = require("@std/process");
let terminal = require("@std/terminal");
let timers = require("@std/timers");

let ESC = "\x1b";
let RESET = "\x1b[0m";
let BOLD = "\x1b[1m";
let DIM = "\x1b[2m";
let INVERSE = "\x1b[7m";
let GREEN = "\x1b[32m";
let CYAN = "\x1b[36m";
let YELLOW = "\x1b[33m";
let RED = "\x1b[31m";
let ENTER_ALT_SCREEN = "\x1b[?1049h";
let LEAVE_ALT_SCREEN = "\x1b[?1049l";
let SPINNER = ["-", "\\", "|", "/"];

function moveTo(row, col) {
  return "\x1b[" + String(row) + ";" + String(col) + "H";
}

function clearScreen() {
  return "\x1b[2J\x1b[H";
}

function clearLine() {
  return "\x1b[2K";
}

function repeatText(text, count) {
  let out = "";
  for (let i = 0; i < count; i = i + 1) {
    out = out + text;
  }
  return out;
}

function stripAnsi(text) {
  return String(text).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
}

function chars(text) {
  return Array.from(String(text));
}

function charLength(text) {
  return chars(text).length;
}

function charWidth(ch) {
  let code = ch.codePointAt(0);
  if (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe19) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f300 && code <= 0x1faff)
  ) {
    return 2;
  }
  return 1;
}

function visibleWidth(text) {
  let width = 0;
  for (let ch of chars(stripAnsi(text))) {
    width = width + charWidth(ch);
  }
  return width;
}

function truncateToWidth(text, width) {
  let out = "";
  let used = 0;
  for (let ch of chars(stripAnsi(text))) {
    let next = charWidth(ch);
    if (used + next > width) {
      break;
    }
    out = out + ch;
    used = used + next;
  }
  return out;
}

function padRight(text, width) {
  let clean = truncateToWidth(text, width);
  let spaces = width - visibleWidth(clean);
  if (spaces < 0) {
    spaces = 0;
  }
  return clean + repeatText(" ", spaces);
}

function line(text, width) {
  return padRight(text, width);
}

function splitAtChar(text, index) {
  let list = chars(text);
  return {
    before: list.slice(0, index).join(""),
    after: list.slice(index).join(""),
  };
}

function loadingFrame(tick) {
  return SPINNER[tick % SPINNER.length];
}

function loadingText(active, tick, label, width) {
  let text = "";
  if (active) {
    text = YELLOW + loadingFrame(tick) + RESET + " " + label;
  } else {
    text = GREEN + "ok" + RESET + " " + label;
  }
  return line(text, width);
}

function bannerLines(width) {
  let wide = [
    "  ____ ____   _____ _   _ ___ ",
    " / ___/ ___| |_   _| | | |_ _|",
    "| |  _\\___ \\   | | | | | || | ",
    "| |_| |___) |  | | | |_| || | ",
    " \\____|____/   |_|  \\___/|___|",
  ];

  if (width >= 64) {
    return wide.map(function(row) {
      return BOLD + CYAN + line(row, width) + RESET;
    });
  }

  return [
    BOLD + CYAN + line("GS TUI TEST", width) + RESET,
  ];
}

function createScreenRenderer(session) {
  let previous = [];
  let rows = 0;
  let cols = 0;
  let started = false;

  function renderFrame(frame, nextRows, nextCols) {
    let lines = String(frame).split("\n");
    let full = false;
    if (!started || rows !== nextRows || cols !== nextCols) {
      full = true;
    }

    let out = "";
    if (full) {
      out = out + clearScreen() + "\x1b[?25l";
      previous = [];
      started = true;
    }

    let max = lines.length;
    if (previous.length > max) {
      max = previous.length;
    }

    for (let i = 0; i < max; i = i + 1) {
      let next = "";
      if (i < lines.length) {
        next = lines[i];
      }
      let old = "";
      if (i < previous.length) {
        old = previous[i];
      }
      if (full || next !== old) {
        out = out + moveTo(i + 1, 1) + clearLine() + next;
      }
    }

    rows = nextRows;
    cols = nextCols;
    previous = lines.slice(0);
    if (out !== "") {
      session.write(out);
    }
  }

  return {
    render: renderFrame,
  };
}

function key(id, text) {
  return {
    id: id,
    text: text,
  };
}

function parseKeys(data) {
  let keys = [];
  if (!data) {
    return keys;
  }

  if (data.startsWith("\x1b[200~") && data.endsWith("\x1b[201~")) {
    keys.push(key("paste", data.slice(6, data.length - 6)));
    return keys;
  }

  let i = 0;
  while (i < data.length) {
    let rest = data.slice(i);
    if (rest.startsWith("\x1b[A")) {
      keys.push(key("up", ""));
      i = i + 3;
    } else if (rest.startsWith("\x1b[B")) {
      keys.push(key("down", ""));
      i = i + 3;
    } else if (rest.startsWith("\x1b[C")) {
      keys.push(key("right", ""));
      i = i + 3;
    } else if (rest.startsWith("\x1b[D")) {
      keys.push(key("left", ""));
      i = i + 3;
    } else if (rest.startsWith("\x1b[5~")) {
      keys.push(key("pageUp", ""));
      i = i + 4;
    } else if (rest.startsWith("\x1b[6~")) {
      keys.push(key("pageDown", ""));
      i = i + 4;
    } else if (rest.startsWith("\x1b[Z")) {
      keys.push(key("shift+tab", ""));
      i = i + 3;
    } else {
      let ch = Array.from(data.slice(i))[0];
      if (ch === "\x03") {
        keys.push(key("ctrl+c", ""));
      } else if (ch === "\x11") {
        keys.push(key("ctrl+q", ""));
      } else if (ch === "\x12") {
        keys.push(key("ctrl+r", ""));
      } else if (ch === "\x13") {
        keys.push(key("ctrl+s", ""));
      } else if (ch === "\x0c") {
        keys.push(key("ctrl+l", ""));
      } else if (ch === "\t") {
        keys.push(key("tab", ""));
      } else if (ch === "\r" || ch === "\n") {
        keys.push(key("enter", ""));
      } else if (ch === "\x7f" || ch === "\b") {
        keys.push(key("backspace", ""));
      } else if (ch === "\x1b") {
        keys.push(key("escape", ""));
      } else if (ch >= " ") {
        keys.push(key("text", ch));
      }
      i = i + ch.length;
    }
  }
  return keys;
}

function nowText() {
  return new Date().toLocaleTimeString();
}

function createState() {
  let size = terminal.size();
  return {
    cols: size.cols,
    rows: size.rows,
    tick: 0,
    focus: "input",
    input: "",
    cursor: 0,
    selected: 0,
    events: [],
    lastRaw: "",
    shouldExit: false,
  };
}

function pushEvent(state, text) {
  state.events.push(nowText() + "  " + text);
  if (state.events.length > 200) {
    state.events.shift();
  }
  state.selected = state.events.length - 1;
}

function render(state) {
  let cols = state.cols;
  let rows = state.rows;
  if (cols < 60) {
    cols = 60;
  }
  if (rows < 16) {
    rows = 16;
  }

  let banner = bannerLines(cols);
  let contentHeight = rows - banner.length - 9;
  let logHeight = contentHeight - 4;
  if (logHeight < 4) {
    logHeight = 4;
  }

  let out = [];
  for (let row of banner) {
    out.push(row);
  }
  out.push(BOLD + CYAN + line("GS TUI Test Program", cols) + RESET);
  out.push(line("terminal=" + String(cols) + "x" + String(rows) + "  tick=" + String(state.tick) + "  focus=" + state.focus, cols));
  out.push(loadingText(true, state.tick, "loading component demo", cols));
  out.push(repeatText("-", cols));
  out.push(BOLD + "Input" + RESET + "  type text, arrows, Tab, paste, Ctrl+R, Ctrl+L, Ctrl+Q");
  let parts = splitAtChar(state.input, state.cursor);
  let before = parts.before;
  let after = parts.after;
  out.push(line("> " + before + INVERSE + " " + RESET + after, cols));
  out.push(repeatText("-", cols));
  out.push(BOLD + "Events" + RESET);

  let start = state.events.length - logHeight;
  if (start < 0) {
    start = 0;
  }
  for (let i = 0; i < logHeight; i = i + 1) {
    let index = start + i;
    let text = "";
    if (index < state.events.length) {
      text = state.events[index];
    }
    out.push(line(text, cols));
  }

  out.push(repeatText("-", cols));
  out.push(line("Last raw: " + JSON.stringify(state.lastRaw), cols));
  out.push(GREEN + line("Checks: ANSI style, raw input, timers, resize polling, bracketed paste, executable packaging", cols) + RESET);
  return out.join("\n");
}

function handleKey(state, item) {
  if (item.id === "ctrl+c" || item.id === "ctrl+q" || item.id === "escape") {
    pushEvent(state, "exit requested by " + item.id);
    state.shouldExit = true;
    return;
  }
  if (item.id === "ctrl+l") {
    state.events = [];
    state.selected = 0;
    pushEvent(state, "log cleared");
    return;
  }
  if (item.id === "ctrl+r") {
    pushEvent(state, "manual redraw requested");
    return;
  }
  if (item.id === "left") {
    if (state.cursor > 0) {
      state.cursor = state.cursor - 1;
    }
    pushEvent(state, "left");
    return;
  }
  if (item.id === "right") {
    if (state.cursor < charLength(state.input)) {
      state.cursor = state.cursor + 1;
    }
    pushEvent(state, "right");
    return;
  }
  if (item.id === "up" || item.id === "down" || item.id === "pageUp" || item.id === "pageDown" || item.id === "tab" || item.id === "shift+tab") {
    pushEvent(state, "key " + item.id);
    return;
  }
  if (item.id === "backspace") {
    if (state.cursor > 0) {
      let list = chars(state.input);
      state.input = list.slice(0, state.cursor - 1).join("") + list.slice(state.cursor).join("");
      state.cursor = state.cursor - 1;
    }
    pushEvent(state, "backspace");
    return;
  }
  if (item.id === "enter") {
    pushEvent(state, "enter input=" + JSON.stringify(state.input));
    state.input = "";
    state.cursor = 0;
    return;
  }
  if (item.id === "paste") {
    let parts = splitAtChar(state.input, state.cursor);
    state.input = parts.before + item.text + parts.after;
    state.cursor = state.cursor + charLength(item.text);
    pushEvent(state, "paste length=" + String(charLength(item.text)));
    return;
  }
  if (item.id === "text") {
    let parts = splitAtChar(state.input, state.cursor);
    state.input = parts.before + item.text + parts.after;
    state.cursor = state.cursor + charLength(item.text);
    pushEvent(state, "text " + JSON.stringify(item.text));
  }
}

function selfTest() {
  let keys = parseKeys("\x12\x13\x1b[Aa");
  if (keys.length !== 4) {
    throw new Error("bad key count: " + JSON.stringify(keys));
  }
  if (keys[0].id !== "ctrl+r" || keys[1].id !== "ctrl+s" || keys[2].id !== "up" || keys[3].text !== "a") {
    throw new Error("bad keys: " + JSON.stringify(keys));
  }
  let zhKeys = parseKeys("你好");
  if (zhKeys.length !== 2 || zhKeys[0].text !== "你" || zhKeys[1].text !== "好") {
    throw new Error("bad unicode keys: " + JSON.stringify(zhKeys));
  }
  let clean = stripAnsi(BOLD + "ok" + RESET);
  if (clean !== "ok") {
    throw new Error("bad ansi strip: " + JSON.stringify(clean));
  }
  if (loadingFrame(0) !== "-" || loadingFrame(2) !== "|") {
    throw new Error("bad loading frame");
  }
  let state = createState();
  pushEvent(state, "self test");
  let frame = render(state);
  if (!frame.includes("GS TUI Test Program") || !frame.includes("self test")) {
    throw new Error("bad render");
  }
  println("gs-tui-test self-test ok");
}

function runApp() {
  let state = createState();
  let session = null;
  let screen = null;

  session = terminal.start({
    raw: true,
    bracketedPaste: true,
    onInput: function(data) {
      state.lastRaw = data;
      let keys = parseKeys(data);
      for (let item of keys) {
        handleKey(state, item);
      }
      screen.render(render(state), state.rows, state.cols);
      if (state.shouldExit) {
        session.stop();
      }
    },
    onResize: function(size) {
      state.cols = size.cols;
      state.rows = size.rows;
      pushEvent(state, "resize " + String(size.cols) + "x" + String(size.rows));
      screen.render(render(state), state.rows, state.cols);
    },
  });

  session.setTitle("GS TUI Test");
  session.write(ENTER_ALT_SCREEN);
  screen = createScreenRenderer(session);
  pushEvent(state, "started pid=" + String(process.pid));
  screen.render(render(state), state.rows, state.cols);

  let id = timers.setInterval(function() {
    state.tick = state.tick + 1;
    screen.render(render(state), state.rows, state.cols);
  }, 500);

  while (!state.shouldExit) {
    timers.sleep(50);
  }

  timers.clearInterval(id);
  session.write("\x1b[?25h\x1b[0m\x1b[2J\x1b[H" + LEAVE_ALT_SCREEN);
  session.drainInput(80, 10);
  session.stop();
  println("gs-tui-test exited");
}

let args = process.argv;
let self = false;
if (process.getenv("GS_TUI_SELF_TEST", "") === "1") {
  self = true;
}
for (let arg of args) {
  if (arg === "--self-test") {
    self = true;
  }
}

if (self) {
  selfTest();
} else {
  runApp();
}
