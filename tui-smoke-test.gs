import { parseKeys } from "@/tui/keys";
import { charWidth } from "@/tui/ansi";
import { renderFrame } from "@/tui/renderer";
import { createScreenRenderer } from "@/tui/screen";
import { loadingFrame, loadingText } from "@/tui/loading";

function assert(cond, message) {
  if (!cond) {
    throw new Error(message);
  }
}

let keys = parseKeys("\x12\x13\x1b[Aa");
assert(keys.length === 4, "key count");
assert(keys[0].id === "ctrl+r", "ctrl+r");
assert(keys[1].id === "ctrl+s", "ctrl+s");
assert(keys[2].id === "up", "up");
assert(keys[3].text === "a", "text");
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
};

let frame = renderFrame(state);
assert(frame.includes("gs-agent"), "header");
assert(frame.includes("GS-AGENT") || frame.includes("____"), "banner");
assert(frame.includes("read_file"), "tool event");
assert(frame.includes("Details"), "details");
assert(frame.includes("#") || frame.includes("|"), "scrollbar render");
assert(frame.includes("Input workspace/task.txt"), "composer");
assert(frame.includes("读取 README.md 并总结"), "zh render");
assert(frame.includes("answer=ready"), "answer status");
assert(frame.includes("最终答案"), "answer render");

let longState = state;
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
assert(!inputLines[0].includes("|Run Timeline"), "composer isolated from timeline");

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
assert(sideEffectState.detailScroll === 99, "renderer does not mutate detail scroll");

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

println("tui smoke ok");
