import { Box, Color, Container, Input, Loading, Markdown, Spacer, Text, border, chars, color, colorCode, isColorEnabled, line, runTuiApp, setColorEnabled, stripAnsi, styleText, visibleWidth, wrapText } from "@/tui/framework";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

let writes = [];
let startedConfig = undefined;
let callbacks = {};
let fakeSession = {
  setTitle: function(title) {
    writes.push("title:" + title);
  },
  write: function(text) {
    writes.push(text);
  },
  stop: function() {
    writes.push("stop");
  },
  drainInput: function(ms, count) {
    writes.push("drain:" + String(ms) + ":" + String(count));
  },
};

let fakeTerminal = {
  size: function() {
    return { cols: 40, rows: 12 };
  },
  isTTY: function(name) {
    return true;
  },
  start: function(config) {
    startedConfig = config;
    callbacks = config;
    return fakeSession;
  },
};

let fakeTimers = {
  setInterval: function(fn, ms) {
    return 1;
  },
  clearInterval: function(id) {
    writes.push("clear:" + String(id));
  },
  sleep: function(ms) {
    if (callbacks.onInput) {
      callbacks.onInput("好");
      callbacks.onInput("\x11");
      callbacks.onInput = undefined;
    }
  },
};

let state = runTuiApp({
  name: "framework smoke",
  title: "framework smoke",
  terminal: fakeTerminal,
  timers: fakeTimers,
  tickMs: 10,
  createState: function(size) {
    return {
      cols: size.cols,
      rows: size.rows,
      tick: 0,
      text: "",
      started: false,
      stopped: false,
      shouldExit: false,
    };
  },
  render: function(state) {
    return line("text=" + state.text, state.cols) + "\n" + border(state.cols);
  },
  onStart: function(state) {
    state.started = true;
  },
  onKey: function(state, key) {
    if (key.id === "text") {
      state.text = state.text + key.text;
    }
    if (key.id === "ctrl+q") {
      state.shouldExit = true;
    }
  },
  onTick: function(state) {
    return true;
  },
  onStop: function(state) {
    state.stopped = true;
  },
});

assert(startedConfig.raw === true, "raw input enabled");
assert(startedConfig.bracketedPaste === true, "paste enabled");
assert(writes.join("\n").includes("\x1b[?1006h"), "mouse enabled");
assert(writes.join("\n").includes("\x1b[?1006l"), "mouse disabled");
assert(state.started, "onStart");
assert(state.stopped, "onStop");
assert(state.text === "好", "unicode key through runtime");
assert(chars(state.text).length === 1, "unicode char length");
assert(wrapText("你好世界", 4).length === 2, "wrap text width");
assert(writes.join("\n").includes("text=好"), "rendered typed text");

writes = [];
startedConfig = undefined;
callbacks = {};
let fatalCalled = false;
let renderFailed = false;
try {
  runTuiApp({
    name: "framework failure smoke",
    title: "framework failure smoke",
    terminal: fakeTerminal,
    timers: fakeTimers,
    tickMs: 0,
    createState: function(size) {
      return {
        cols: size.cols,
        rows: size.rows,
        shouldExit: false,
      };
    },
    render: function(state) {
      throw new Error("render broken");
    },
    onFatal: function(state, info) {
      fatalCalled = true;
    },
  });
} catch (err) {
  renderFailed = true;
}
assert(renderFailed, "render error rethrown");
assert(fatalCalled, "render error onFatal");
assert(writes.join("\n").includes("\x1b[?1006l"), "render error disables mouse");
assert(writes.join("\n").includes("\x1b[?1049l"), "render error leaves alternate screen");
assert(writes.join("\n").includes("drain:80:10"), "render error drains input");
assert(writes.join("\n").includes("stop"), "render error stops session");

let box = Box({
  width: 20,
  height: 4,
  title: "Box",
  content: ["hello"],
});
assert(box.length === 4, "box height");
assert(stripAnsi(box[0]).startsWith("+ Box "), "box title");

let input = Input({
  width: 20,
  title: "Input",
  value: "你好",
  cursor: 1,
  meta: "meta",
});
assert(input.length === 3, "input lines");
assert(stripAnsi(input[1]).includes(">"), "input prompt");

let md = Markdown({
  width: 24,
  height: 5,
  title: "Doc",
  text: "# 标题\n- **重点**\n```gs\nprintln(1)\n```",
});
assert(md.length === 5, "markdown height");
assert(stripAnsi(md.join("\n")).includes("标题"), "markdown heading");
assert(stripAnsi(md.join("\n")).includes("重点"), "markdown bold");

let loading = Loading({
  width: 16,
  active: true,
  tick: 2,
  label: "work",
});
assert(stripAnsi(loading[0]).includes("| work"), "loading row");

let container = Container({
  width: 20,
  children: [Spacer({ width: 20, height: 1 }), loading],
  gap: 1,
});
assert(container.length === 3, "container gap");

let text = Text({
  width: 4,
  text: "你好世界",
});
assert(text.length === 2, "text wraps cjk");
assert(stripAnsi(text[0]) === "你好", "text first wrapped line");

let scrolled = Text({
  width: 10,
  height: 1,
  text: "a\nb\nc",
  scroll: 1,
});
assert(stripAnsi(scrolled[0]).trim() === "b", "text scroll");

let centered = Text({
  width: 7,
  text: "ok",
  align: "center",
});
assert(stripAnsi(centered[0]) === "  ok   ", "text center align");

let coloredText = Text({
  width: 10,
  text: "ok",
  color: "success",
  bold: true,
});
assert(coloredText[0].includes("\x1b["), "text color kept");
assert(visibleWidth(coloredText[0]) === 10, "text colored width");

assert(colorCode("success") === Color.green, "semantic color");
let colored = color("ok", "success");
assert(colored.includes("\x1b["), "color emits ansi");
assert(stripAnsi(colored) === "ok", "strip color");
assert(stripAnsi(styleText("warn", { bold: true, fg: "warning" })) === "warn", "style text");
setColorEnabled(false);
assert(!isColorEnabled(), "color disabled");
assert(color("plain", "error") === "plain", "color disabled plain");
assert(styleText("plain", { bold: true, fg: "error" }) === "plain", "style disabled plain");
let plainBox = Box({ width: 12, title: "Plain", content: ["x"], focused: true });
assert(!plainBox.join("\n").includes("\x1b["), "component respects disabled color");
setColorEnabled(true);

println("framework smoke ok");
