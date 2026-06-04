import { clearLine, clearScreen, hideCursor, moveTo } from "@/tui/ansi";

function splitFrame(frame) {
  if (Array.isArray(frame)) {
    return frame;
  }
  return String(frame).split("\n");
}

function blankLines(count) {
  let out = [];
  for (let i = 0; i < count; i = i + 1) {
    out.push("");
  }
  return out;
}

// 局部刷新器维护上一帧屏幕缓冲，只重写变化行，效果接近 Claude Code 的 TUI 刷新方式。
export function createScreenRenderer(session) {
  let previous = [];
  let rows = 0;
  let cols = 0;
  let started = false;

  function reset() {
    previous = [];
    rows = 0;
    cols = 0;
    started = false;
  }

  function render(frame, nextRows, nextCols) {
    let lines = splitFrame(frame);
    let full = false;

    if (!started || nextRows !== rows || nextCols !== cols) {
      full = true;
    }

    let out = "";
    if (full) {
      out = out + clearScreen() + hideCursor();
      previous = blankLines(lines.length);
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
    render: render,
    reset: reset,
  };
}

