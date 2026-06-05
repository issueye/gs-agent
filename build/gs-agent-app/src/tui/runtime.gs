import { clearScreen, disableMouse, enableMouse, enableMouseWheel, enterAlternateScreen, hideCursor, leaveAlternateScreen, showCursor } from "@/tui/ansi";
import { parseKeys } from "@/tui/keys";
import { createScreenRenderer } from "@/tui/screen";

let terminal = require("@std/terminal");
let timers = require("@std/timers");

function defaultShouldExit(state) {
  return !!state.shouldExit;
}

function callHook(fn, state, ctx) {
  if (fn) {
    return fn(state, ctx);
  }
  return undefined;
}

function nowMs() {
  return (new Date()).getTime();
}

// 通用 TUI 运行时：负责终端生命周期、按键分发、resize、tick 和局部刷新。
// 业务程序只需要提供 createState/render/onKey 等回调即可复用这一层。
export function runTuiApp(options) {
  if (!options) {
    options = {};
  }

  let terminalApi = options.terminal || terminal;
  let timersApi = options.timers || timers;
  let title = options.title || "gs tui";
  let name = options.name || title;
  let tickMs = options.tickMs || 120;
  let mouse = true;
  let mouseMode = "wheel";
  let alternateScreen = true;
  if ("mouse" in options) {
    mouse = !!options.mouse;
  }
  if ("alternateScreen" in options) {
    alternateScreen = !!options.alternateScreen;
  }
  if ("mouseMode" in options) {
    mouseMode = options.mouseMode;
  }
  if (!mouse) {
    mouseMode = "off";
  }
  let shouldExit = options.shouldExit || defaultShouldExit;
  let size = terminalApi.size();
  let state = options.createState(size);

  let session = null;
  let screen = null;
  let tickTimer = null;
  let cleaned = false;
  let fatalError = null;
  let renderRequested = false;

  function requestRender() {
    renderRequested = true;
  }

  function flushRender() {
    if (!renderRequested) {
      return;
    }
    renderRequested = false;
    if (screen && options.render) {
      screen.render(options.render(state), state.rows, state.cols);
    }
  }

  let ctx = {
    session: null,
    screen: null,
    render: function() {
      requestRender();
    },
    stop: function() {
      state.shouldExit = true;
      if (session) {
        session.stop();
      }
    },
    write: function(text) {
      if (session) {
        session.write(text);
      }
    },
  };

  function cleanup() {
    if (cleaned) {
      return;
    }
    cleaned = true;
    if (tickTimer) {
      timersApi.clearInterval(tickTimer);
      tickTimer = null;
    }
    if (session) {
      let leave = showCursor() + clearScreen();
      if (mouseMode !== "off") {
        leave = leave + disableMouse();
      }
      if (alternateScreen) {
        leave = leave + leaveAlternateScreen();
      }
      session.write(leave);
      if ("drainInput" in session) {
        session.drainInput(80, 10);
      }
      session.stop();
    }
  }

  function handleFatal(error) {
    fatalError = error;
    state.shouldExit = true;
    cleanup();
    try {
      callHook(options.onFatal, state, {
        error: String(error),
      });
    } catch (hookErr) {
      // 终端恢复优先于错误上报，避免错误处理回调再次破坏退出流程。
    }
  }

  if (!terminalApi.isTTY("stdin") || !terminalApi.isTTY("stdout")) {
    callHook(options.onFatal, state, {
      error: name + " requires an interactive terminal",
    });
    throw new Error(name + " requires an interactive terminal");
  }

  session = terminalApi.start({
    raw: true,
    bracketedPaste: true,
    onInput: function(data) {
      try {
        if (options.onInputRaw) {
          options.onInputRaw(state, data, ctx);
        }
        let items = parseKeys(data);
        for (let item of items) {
          if (options.onKey) {
            options.onKey(state, item, ctx);
          }
        }
        ctx.render();
        if (shouldExit(state)) {
          session.stop();
        }
      } catch (err) {
        handleFatal(err);
      }
    },
    onResize: function(nextSize) {
      try {
        state.cols = nextSize.cols;
        state.rows = nextSize.rows;
        callHook(options.onResize, state, ctx);
        ctx.render();
      } catch (err) {
        handleFatal(err);
      }
    },
  });

  ctx.session = session;
  session.setTitle(title);
  let enter = hideCursor();
  if (alternateScreen) {
    enter = enterAlternateScreen() + enter;
  }
  if (mouseMode === "full") {
    enter = enter + enableMouse();
  } else if (mouseMode === "wheel") {
    enter = enter + enableMouseWheel();
  }
  session.write(enter);
  screen = createScreenRenderer(session);
  ctx.screen = screen;

  try {
    callHook(options.onStart, state, ctx);
    ctx.render();
    flushRender();

    let lastTick = nowMs();
    // GoScript 目前没有异步 await 主循环，这里用短 sleep 让 terminal 回调持续工作。
    while (!shouldExit(state)) {
      timersApi.sleep(50);
      flushRender();
      if (tickMs > 0 && nowMs() - lastTick >= tickMs) {
        lastTick = nowMs();
        if ("tick" in state) {
          state.tick = state.tick + 1;
        }
        let shouldRender = callHook(options.onTick, state, ctx);
        if (shouldRender) {
          ctx.render();
        }
        flushRender();
      }
    }

    callHook(options.onStop, state, ctx);
  } catch (err) {
    handleFatal(err);
    throw err;
  } finally {
    cleanup();
  }
  if (fatalError) {
    state.fatalError = fatalError;
  }
  return state;
}
