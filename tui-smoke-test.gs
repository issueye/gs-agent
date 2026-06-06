import { parseKeys } from "@/tui/keys";
import { charWidth, stripAnsi, visibleWidth } from "@/tui/ansi";
import { Markdown } from "@/tui/components";
import { renderComposerFrame, renderContentFrame, renderFrame } from "@/tui/renderer";
import { createScreenRenderer } from "@/tui/screen";
import { loadingFrame, loadingText } from "@/tui/loading";
import { startNewSession } from "@/tui/app";

let fs = require("@std/fs");
let path = require("@std/path");
let process = require("@std/process");

function assert(cond, message) {
  if (!cond) {
    throw new Error(message);
  }
}

let keys = parseKeys("\x12\x13\x1b[A\x1b[F/");
assert(keys.length === 5, "key count");
assert(keys[0].id === "ctrl+r", "ctrl+r");
assert(keys[1].id === "ctrl+s", "ctrl+s");
assert(keys[2].id === "up", "up");
assert(keys[3].id === "end", "end");
assert(keys[4].text === "/", "slash text");
let zhKeys = parseKeys("你好");
assert(zhKeys.length === 2, "zh key count");
assert(zhKeys[0].text === "你", "zh first");
assert(zhKeys[1].text === "好", "zh second");
let mouseKeys = parseKeys("\x1b[<64;10;20M");
assert(mouseKeys.length === 1, "mouse key count");
assert(mouseKeys[0].id === "mouse", "mouse id");
assert(mouseKeys[0].action === "wheelUp", "mouse wheel");
assert(mouseKeys[0].col === 10 && mouseKeys[0].row === 20, "mouse position");
assert(charWidth("你") === 2, "zh width");
assert(loadingFrame(0) === "-", "loading frame 0");
assert(loadingFrame(2) === "|", "loading frame 2");
assert(loadingText({ active: true, tick: 1, label: "run", width: 12 }).includes("run"), "loading text");

let state = {
  app: {
    taskFile: "workspace/task.txt",
    agent: {
      provider: "anthropic",
      maxTurns: 10,
      tools: ["read_file"],
    },
    config: {
      llm: {
        anthropic: {
          model: "deepseek-v4-flash",
          contextTokenThreshold: 258000,
        },
      },
    },
  },
  cols: 80,
  rows: 24,
  taskText: "读取 README.md 并总结",
  taskScroll: 0,
  cursorLine: 0,
  cursorCol: 0,
  dirty: false,
  running: false,
  focus: "timeline",
  events: [
    {
      kind: "message",
      payload: {
        role: "user",
        content: "hello",
      },
    },
    {
      kind: "tool_call",
      payload: {
        name: "read_file",
        args: {
          path: "README.md",
        },
      },
    },
    {
      kind: "answer",
      payload: {
        content: "最终答案",
        file: ".agent/answer.md",
      },
    },
  ],
  selectedEvent: 2,
  eventScroll: 0,
  detailScroll: 0,
  answer: "最终答案",
  error: "",
  commandOpen: false,
  commandQuery: "",
  commandSelected: 0,
  messages: [
    {
      role: "user",
      content: "hello",
    },
    {
      role: "assistant",
      content: "world",
    },
  ],
};

function copyState(base) {
  return {
    app: base.app,
    cols: base.cols,
    rows: base.rows,
    taskText: base.taskText,
    taskScroll: base.taskScroll,
    cursorLine: base.cursorLine,
    cursorCol: base.cursorCol,
    dirty: base.dirty,
    running: base.running,
    focus: base.focus,
    events: base.events,
    selectedEvent: base.selectedEvent,
    eventScroll: base.eventScroll,
    detailScroll: base.detailScroll,
    answer: base.answer,
    error: base.error,
    commandOpen: base.commandOpen,
    commandQuery: base.commandQuery,
    commandSelected: base.commandSelected,
    messages: base.messages,
    transcriptCache: null,
    transcriptMeasureCache: null,
  };
}

let frame = renderFrame(state);
assert(frame.split("\n").length <= state.rows, "frame fits terminal rows");
let contentOnlyFrame = renderContentFrame(state);
let composerOnlyFrame = renderComposerFrame(state);
assert(!contentOnlyFrame.includes("Prompt"), "content frame excludes composer");
assert(!contentOnlyFrame.includes("> 读取"), "content frame excludes input row");
assert(composerOnlyFrame.includes("Prompt"), "composer frame includes prompt");
assert(composerOnlyFrame.includes("> "), "composer frame includes input row");
assert(composerOnlyFrame.split("\n").length === 6, "composer has loading row");
let baseFrameLines = frame.split("\n");
let promptLineIndex = -1;
for (let i = 0; i < baseFrameLines.length; i = i + 1) {
  if (baseFrameLines[i].startsWith("> ")) {
    promptLineIndex = i;
  }
}
assert(promptLineIndex >= state.rows - 6, "composer fixed at bottom");
assert(!frame.includes("/\\_/\\"), "no fixed header in scrollback");
let tickState = copyState(state);
tickState.tick = 2;
let tickFrame = renderFrame(tickState);
assert(tickFrame === frame, "no fixed animated header");
assert(frame.includes("read_file"), "tool event");
assert(frame.includes("Transcript"), "transcript");
assert(frame.includes("Prompt"), "composer");
assert(frame.includes("Enter send"), "enter send hint");
assert(frame.includes("Ctrl+C to quit"), "composer bottom hint");
assert(frame.includes("读取 README.md 并总结"), "zh render");
assert(frame.includes("最终答案"), "answer render");
let markdownState = copyState(state);
markdownState.events = [
  {
    kind: "answer",
    payload: {
      content: "# 标题\n\n```python\ndef hello():\n  print(1)\n```",
    },
  },
];
markdownState.selectedEvent = 0;
markdownState.focus = "details";
let markdownFrame = renderFrame(markdownState);
assert(markdownFrame.includes("\x1b["), "details markdown styled");
assert(markdownFrame.includes("python"), "details markdown code language");
assert(markdownState.transcriptCache.rows.length > 0, "transcript cache populated");
assert(markdownState.transcriptCache.rows.join("\n").includes("\x1b["), "transcript markdown color kept");
assert(!stripAnsi(markdownFrame).includes("0m"), "code block ansi reset hidden");

let runningState = copyState(state);
runningState.running = true;
runningState.tick = 2;
let runningComposer = renderComposerFrame(runningState);
assert(stripAnsi(runningComposer).includes("| running"), "composer loading animation");

let commandState = copyState(state);
commandState.commandOpen = true;
commandState.commandQuery = "lo";
commandState.commandSelected = 0;
let commandFrame = renderFrame(commandState);
assert(commandFrame.split("\n").length <= commandState.rows, "command frame fits terminal rows");
assert(commandFrame.includes("/lo"), "command panel query rendered");
assert(commandFrame.includes("load"), "command panel filters commands");
assert(commandFrame.includes("Esc close"), "command panel help rendered");

let escapedState = copyState(state);
escapedState.events = [
  {
    kind: "tool_result",
    payload: {
      name: "web_fetch",
      content: "{\"ok\":true,\"name\":\"web_fetch\",\"result\":{\"text\":\"第一行\\n第二行\"}}",
    },
  },
  {
    kind: "message",
    payload: {
      role: "assistant",
      content: "\"# 标题\\n\\n正文\"",
    },
  },
];
escapedState.detailScroll = 0;
escapedState.transcriptCache = null;
let escapedFrame = renderFrame(escapedState);
let escapedRows = escapedState.transcriptCache.rows.join("\n");
assert(escapedFrame.includes("第一行"), "tool result text rendered");
assert(escapedFrame.includes("第二行"), "tool result newline decoded");
assert(escapedFrame.includes("标题"), "assistant json string decoded");
assert(!escapedRows.includes("{\"ok\":true"), "tool result json hidden");
assert(!escapedRows.includes("\\n"), "escaped newline hidden");

let inlineTableRows = stripAnsi(Markdown({
  width: 80,
  text: "| Name | Value |\n| --- | --- |\n| **alpha** | `beta` |",
}).join("\n"));
assert(!inlineTableRows.includes("**alpha**"), "table cell bold marker hidden");
assert(inlineTableRows.includes("alpha"), "table cell bold text kept");
assert(!inlineTableRows.includes("`beta`"), "table cell code marker hidden");

let wideTableState = copyState(state);
wideTableState.cols = 140;
wideTableState.events = [
  {
    kind: "message",
    payload: {
      role: "assistant",
      content: "| A | B | C | D | E | F | G | H |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n| alpha | beta | gamma | delta | epsilon | zeta | eta | theta | overflow | still overflow |\n| ⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐ | 中等 | 优秀 | 极致 | 非常非常非常长的内容 | 难 | 更多 | 公司 |",
    },
  },
];
wideTableState.transcriptCache = null;
wideTableState.safeCols = 138;
renderFrame(wideTableState);
let maxWideRow = 0;
for (let row of wideTableState.transcriptCache.rows) {
  let cleanWidth = visibleWidth(stripAnsi(row));
  if (cleanWidth > maxWideRow) {
    maxWideRow = cleanWidth;
  }
}
assert(maxWideRow <= Math.floor(wideTableState.safeCols * 0.8) + 4, "transcript content width capped");
assert(maxWideRow > 92, "transcript content uses wide viewport");
let safeFrame = renderFrame(wideTableState);
let maxFrameRow = 0;
for (let row of safeFrame.split("\n")) {
  let cleanWidth = visibleWidth(stripAnsi(row));
  if (cleanWidth > maxFrameRow) {
    maxFrameRow = cleanWidth;
  }
}
assert(maxFrameRow <= wideTableState.safeCols, "frame leaves right safety columns");

let duplicateState = copyState(state);
duplicateState.events = [
  {
    kind: "message",
    payload: {
      role: "assistant",
      content: "重复回答",
    },
  },
  {
    kind: "answer",
    payload: {
      content: "重复回答",
    },
  },
];
duplicateState.transcriptCache = null;
renderFrame(duplicateState);
let duplicateRows = duplicateState.transcriptCache.rows.join("\n");
assert(duplicateRows.indexOf("重复回答") === duplicateRows.lastIndexOf("重复回答"), "duplicate answer hidden");

let longTranscriptState = copyState(state);
longTranscriptState.events = [];
longTranscriptState.detailScroll = 0;
longTranscriptState.transcriptCache = null;
longTranscriptState.transcriptMeasureCache = null;
for (let i = 0; i < 80; i = i + 1) {
  longTranscriptState.events.push({
    kind: "message",
    payload: {
      role: "assistant",
      content: "# 回答 " + String(i) + "\n\n这是一个用于滚动测试的较长 markdown 段落，包含 **加粗** 和 `code`。",
    },
  });
}
renderFrame(longTranscriptState);
let cachedRows = longTranscriptState.transcriptCache.rows;
longTranscriptState.detailScroll = 20;
renderFrame(longTranscriptState);
assert(longTranscriptState.transcriptCache.rows === cachedRows, "scroll render reuses transcript cache");
assert(longTranscriptState.detailScroll === 20, "renderer does not force scroll");
longTranscriptState.detailScroll = 2147483647;
let bottomFrame = renderFrame(longTranscriptState);
assert(bottomFrame.includes("回答 79"), "large scroll clamps to transcript bottom");
assert(longTranscriptState.detailScroll < 2147483647, "renderer stores clamped transcript scroll");

let longState = copyState(state);
longState.taskText = "你能干什么".repeat(30);
longState.cursorCol = 20;
longState.focus = "task";
let longFrame = renderFrame(longState);
let frameLines = longFrame.split("\n");
let inputLines = [];
for (let row of frameLines) {
  if (row.startsWith("> ")) {
    inputLines.push(row);
  }
}
assert(inputLines.length === 1, "one composer input line");
assert(!inputLines[0].includes("Transcript"), "composer isolated from transcript");
assert(!inputLines[0].includes("Enter"), "composer input contains only prompt text");
assert(!inputLines[0].includes("Ctrl+C to quit"), "composer input excludes bottom hint");

let sideEffectState = {
  app: state.app,
  cols: 80,
  rows: 24,
  taskText: "a\nb\nc\nd\ne",
  taskScroll: 99,
  cursorLine: 0,
  cursorCol: 0,
  dirty: false,
  running: false,
  focus: "task",
  events: state.events,
  selectedEvent: 0,
  eventScroll: 99,
  detailScroll: 99,
  answer: "",
  error: "",
};
renderFrame(sideEffectState);
assert(sideEffectState.taskScroll === 99, "renderer does not mutate task scroll");
assert(sideEffectState.eventScroll === 99, "renderer does not mutate event scroll");
assert(sideEffectState.detailScroll <= 99, "renderer clamps detail scroll");

let writes = [];
let fakeSession = {
  write: function(text) {
    writes.push(text);
  },
};
let screen = createScreenRenderer(fakeSession);
screen.render("a\nb\nc", 3, 10);
screen.render("a\nB\nc", 3, 10);
assert(writes.length === 2, "screen writes");
assert(writes[0].includes("\x1b[2J"), "first full clear");
assert(!writes[1].includes("\x1b[2J"), "second no full clear");
assert(writes[1].includes("\x1b[2;1H"), "changed row move");
assert(!writes[1].includes("\x1b[1;1H"), "unchanged row skipped");
writes = [];
screen.reset();
screen.render("a\nb\nc\nd", 3, 10);
assert(!writes[0].includes("\x1b[4;1H"), "screen clips rows to viewport");
let nativeCalls = [];
let nativeSession = {
  renderFrame: function(frame, options) {
    nativeCalls.push({ frame: frame, options: options });
  },
};
let nativeScreen = createScreenRenderer(nativeSession);
nativeScreen.render("a\nb\nc\nd", 3, 10);
nativeScreen.render("a\nB\nc", 3, 10);
assert(nativeCalls.length === 2, "screen uses native renderFrame");
assert(nativeCalls[0].frame === "a\nb\nc", "native renderFrame receives clipped rows");
assert(nativeCalls[0].options.full === true, "native renderFrame first call full");
assert(nativeCalls[1].options.full === false, "native renderFrame second call diff");

let tempDir = path.join(process.cwd(), ".agent", "tui-smoke-new-session");
fs.mkdirSync(tempDir, { recursive: true });
let tempSession = path.join(tempDir, "session.jsonl");
let tempAnswer = path.join(tempDir, "answer.md");
fs.writeTextSync(tempSession, "{\"kind\":\"message\"}\n");
fs.writeTextSync(tempAnswer, "old answer\n");
let newSessionLogs = [];
let newSessionState = {
  app: {
    sessionFile: tempSession,
    answerFile: tempAnswer,
  },
  events: [{ kind: "message", payload: { role: "assistant", content: "old" } }],
  messages: [{ role: "assistant", content: "old" }],
  selectedEvent: 0,
  eventScroll: 3,
  detailScroll: 4,
  answer: "old answer",
  error: "",
  transcriptCache: { width: 1, events: 1, rows: ["old"] },
  transcriptMeasureCache: { width: 1, events: 1, lines: 1 },
  logger: {
    info: function(message, fields) {
      newSessionLogs.push(message);
    },
  },
};
startNewSession(newSessionState);
assert(newSessionState.events.length === 0, "new session clears events");
assert(newSessionState.messages.length === 0, "new session clears messages");
assert(newSessionState.answer === "", "new session clears answer");
assert(!fs.existsSync(tempSession), "new session removes session file");
assert(!fs.existsSync(tempAnswer), "new session removes answer file");

println("tui smoke ok");
