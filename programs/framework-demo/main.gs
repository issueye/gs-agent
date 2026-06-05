import { Box, Container, Input, Loading, Markdown, Text, banner, chars, runTuiApp, takeLine } from "@/tui/framework";

function pushEvent(state, text) {
  state.events.push(text);
  if (state.events.length > 200) {
    state.events.shift();
  }
}

function createState(size) {
  return {
    cols: size.cols,
    rows: size.rows,
    tick: 0,
    input: "",
    cursor: 0,
    scroll: 0,
    events: ["framework demo started"],
    shouldExit: false,
  };
}

function render(state) {
  let cols = state.cols;
  let rows = state.rows;
  if (cols < 50) {
    cols = 50;
  }
  if (rows < 14) {
    rows = 14;
  }

  let head = banner({
    width: cols,
    title: "GS TUI FRAMEWORK",
    wide: [
      "  ____ ____   _____ _   _ ___ ",
      " / ___/ ___| |_   _| | | |_ _|",
      "| |  _\\___ \\   | | | | | || | ",
      "| |_| |___) |  | | | |_| || | ",
      " \\____|____/   |_|  \\___/|___|",
    ],
    minWidth: 64,
  });
  let bodyHeight = rows - head.length - 7;
  if (bodyHeight < 3) {
    bodyHeight = 3;
  }

  let out = [];
  for (let row of head) {
    out.push(row);
  }
  for (let row of Text({ width: cols, text: "Reusable runtime + components demo", bold: true, color: "accent" })) {
    out.push(row);
  }
  for (let row of Text({ width: cols, text: "size=" + String(state.cols) + "x" + String(state.rows) + "  tick=" + String(state.tick), color: "muted" })) {
    out.push(row);
  }

  let start = state.events.length - bodyHeight - state.scroll;
  if (start < 0) {
    start = 0;
  }
  let eventRows = [];
  for (let i = 0; i < bodyHeight; i = i + 1) {
    eventRows.push(takeLine(state.events, start + i));
  }

  let help = Markdown({
    width: cols - 4,
    text: "## Components\n- **Input** keeps editing stable.\n- **Box** frames focused content.\n- `Markdown` renders simple notes.\n- Loading shows status without noise.",
  });
  let events = Box({
    width: cols,
    height: bodyHeight + 2,
    title: "Events",
    content: eventRows,
    focused: true,
  });
  let input = Input({
    width: cols,
    title: "Input",
    value: state.input,
    cursor: state.cursor,
    placeholder: "type something",
    meta: "Enter adds event  Up/Down scroll  Ctrl+Q/Esc quit",
  });
  let layout = Container({
    width: cols,
    children: [
      Loading({ width: cols, active: true, tick: state.tick, label: "component runtime" }),
      Box({ width: cols, title: "Markdown", content: help, padding: 1 }),
      events,
      input,
    ],
    gap: 1,
  });

  for (let row of layout) {
    out.push(row);
  }
  return out.join("\n");
}

function handleKey(state, item) {
  if (item.id === "ctrl+c" || item.id === "ctrl+q" || item.id === "escape") {
    state.shouldExit = true;
    return;
  }
  if (item.id === "up") {
    state.scroll = state.scroll + 1;
    return;
  }
  if (item.id === "down") {
    state.scroll = state.scroll - 1;
    if (state.scroll < 0) {
      state.scroll = 0;
    }
    return;
  }
  if (item.id === "left") {
    if (state.cursor > 0) {
      state.cursor = state.cursor - 1;
    }
    return;
  }
  if (item.id === "right") {
    if (state.cursor < chars(state.input).length) {
      state.cursor = state.cursor + 1;
    }
    return;
  }
  if (item.id === "backspace") {
    if (state.cursor > 0) {
      let list = chars(state.input);
      state.input = list.slice(0, state.cursor - 1).join("") + list.slice(state.cursor).join("");
      state.cursor = state.cursor - 1;
    }
    return;
  }
  if (item.id === "enter") {
    pushEvent(state, state.input);
    state.input = "";
    state.cursor = 0;
    state.scroll = 0;
    return;
  }
  if (item.id === "text" || item.id === "paste") {
    let parts = splitAtChar(state.input, state.cursor);
    state.input = parts.before + item.text + parts.after;
    state.cursor = state.cursor + chars(item.text).length;
  }
}

let state = runTuiApp({
  name: "gs tui framework demo",
  title: "gs tui framework demo",
  tickMs: 500,
  createState: createState,
  render: render,
  onKey: handleKey,
  onResize: function(state) {
    pushEvent(state, "resize " + String(state.cols) + "x" + String(state.rows));
  },
  onTick: function(state) {
    return true;
  },
});

println("framework demo exited events=" + String(state.events.length));
