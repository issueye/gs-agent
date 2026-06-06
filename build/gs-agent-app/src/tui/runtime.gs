import { parseKeys } from "@/tui/keys";

let terminal = require("@std/terminal");
let tui = require("@std/tui");

function defaultShouldExit(state) {
  return !!state.shouldExit;
}

function callHook(fn, state, ctx) {
  if (fn) {
    return fn(state, ctx);
  }
  return undefined;
}

function normalizeSize(size) {
  if (!size) {
    return { cols: 80, rows: 24 };
  }
  return {
    cols: size.cols || 80,
    rows: size.rows || 24,
  };
}

function keyId(id) {
  if (id === "esc") {
    return "escape";
  }
  if (id === "pageup") {
    return "pageUp";
  }
  if (id === "pagedown") {
    return "pageDown";
  }
  return id;
}

function mouseAction(msg) {
  if (msg.button === 64) {
    return "wheelUp";
  }
  if (msg.button === 65) {
    return "wheelDown";
  }
  if (msg.action === "release") {
    return "up";
  }
  return "down";
}

function messageKeys(msg) {
  if (!msg) {
    return [];
  }
  if (msg.type === "key") {
    return [{
      id: keyId(msg.key),
      text: "",
    }];
  }
  if (msg.type === "mouse") {
    return [{
      id: "mouse",
      text: "",
      action: mouseAction(msg),
      button: msg.button,
      col: msg.x,
      row: msg.y,
    }];
  }
  if (msg.type === "text") {
    return parseKeys(msg.raw || msg.text || "");
  }
  if (msg.type === "raw") {
    return parseKeys(msg.raw || "");
  }
  return [];
}

function buildFrame(state, size, options, fixedBottomRows) {
  let nextSize = normalizeSize(size);
  state.cols = nextSize.cols;
  state.rows = nextSize.rows;
  let safeRightCols = 0;
  if ("safeRightCols" in options) {
    safeRightCols = options.safeRightCols;
  }
  if (safeRightCols < 0) {
    safeRightCols = 0;
  }
  state.safeCols = state.cols - safeRightCols;
  if (state.safeCols < 1) {
    state.safeCols = 1;
  }

  if (!options.render) {
    return "";
  }

  if (options.renderFixedBottom && fixedBottomRows > 0) {
    let contentRows = state.rows - fixedBottomRows;
    if (contentRows < 1) {
      contentRows = 1;
    }
    state.contentRows = contentRows;
    let content = String(options.render(state));
    state.contentRows = undefined;

    let bottom = String(options.renderFixedBottom(state)).split("\n");
    if (bottom.length > fixedBottomRows) {
      bottom = bottom.slice(0, fixedBottomRows);
    }
    while (bottom.length < fixedBottomRows) {
      bottom.push("");
    }
    return content + "\n" + bottom.join("\n");
  }

  return String(options.render(state));
}

function runOptions(options, alternateScreen, mouseMode, tickMs, resizeDebounceMs) {
  return {
    raw: true,
    bracketedPaste: true,
    alternateScreen: alternateScreen,
    hideCursor: true,
    mouse: mouseMode !== "off",
    diff: true,
    clip: true,
    tickMs: tickMs,
    resizeDebounceMs: resizeDebounceMs,
  };
}

// Project facade over the language-side @std/tui runtime. The app code keeps its
// old callback shape while terminal lifecycle, resize, ticks, diff rendering and
// restoration are handled by the standard library.
export function runTuiApp(options) {
  if (!options) {
    options = {};
  }

  let terminalApi = options.terminal || terminal;
  let title = options.title || "gs tui";
  let name = options.name || title;
  let tickMs = options.tickMs || 120;
  let mouse = true;
  let mouseMode = "wheel";
  let alternateScreen = true;
  let resizeDebounceMs = 50;
  let fixedBottomRows = 0;

  if ("mouse" in options) {
    mouse = !!options.mouse;
  }
  if ("alternateScreen" in options) {
    alternateScreen = !!options.alternateScreen;
  }
  if ("mouseMode" in options) {
    mouseMode = options.mouseMode;
  }
  if ("resizeDebounceMs" in options) {
    resizeDebounceMs = options.resizeDebounceMs;
  }
  if ("fixedBottomRows" in options) {
    fixedBottomRows = options.fixedBottomRows;
  }
  if (!mouse) {
    mouseMode = "off";
  }

  let shouldExit = options.shouldExit || defaultShouldExit;
  let initialSize = normalizeSize(terminalApi.size());
  let state = options.createState(initialSize);
  let app = null;
  let started = false;

  let ctx = {
    session: null,
    screen: null,
    render: function() {
      if (!state || !options.render) {
        return;
      }
      terminalApi.renderFrame(buildFrame(state, { cols: state.cols, rows: state.rows }, options, fixedBottomRows), {
        rows: state.rows,
        cols: state.cols,
        diff: false,
        full: true,
        clip: true,
      });
    },
    stop: function() {
      state.shouldExit = true;
      if (app) {
        app.stop();
      }
    },
    write: function(text) {
      terminalApi.write(text);
    },
  };

  function update(current, msg) {
    state = current;

    if (msg.type === "resize") {
      state.cols = msg.cols;
      state.rows = msg.rows;
      callHook(options.onResize, state, ctx);
    } else if (msg.type === "tick") {
      if ("tick" in state) {
        state.tick = state.tick + 1;
      }
      callHook(options.onTick, state, ctx);
    } else {
      let keys = messageKeys(msg);
      for (let item of keys) {
        if (options.onKey) {
          options.onKey(state, item, ctx);
        }
      }
    }

    if (shouldExit(state)) {
      return {
        state: state,
        quit: true,
      };
    }
    return state;
  }

  app = tui.createApp({
    state: state,
    update: update,
    view: function(current, size) {
      state = current;
      return buildFrame(state, size, options, fixedBottomRows);
    },
  });

  try {
    if (terminalApi.setTitle) {
      terminalApi.setTitle(title);
    }
    callHook(options.onStart, state, ctx);
    started = true;

    if (options.testMessages) {
      for (let msg of options.testMessages) {
        state = update(state, msg);
      }
      app.render({ cols: state.cols, rows: state.rows });
      callHook(options.onStop, state, ctx);
      return state;
    }

    if (!terminalApi.isTTY("stdin") || !terminalApi.isTTY("stdout")) {
      callHook(options.onFatal, state, {
        error: name + " requires an interactive terminal",
      });
      throw new Error(name + " requires an interactive terminal");
    }

    state = app.run(runOptions(options, alternateScreen, mouseMode, tickMs, resizeDebounceMs));
    callHook(options.onStop, state, ctx);
    return state;
  } catch (err) {
    if (!started) {
      state.fatalError = err;
    }
    callHook(options.onFatal, state, {
      error: String(err),
    });
    throw err;
  }
}
