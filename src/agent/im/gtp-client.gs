let exec = require("@std/exec");
let path = require("@std/path");
let timers = require("@std/timers");

function hasOwn(value, key) {
  if (!value) {
    return false;
  }
  return key in value;
}

function asArray(value) {
  if (!value) {
    return [];
  }
  return value;
}

function gtpString(value) {
  return {
    "$t": "string",
    v: String(value || ""),
  };
}

function gtpNumber(value) {
  return {
    "$t": "number",
    v: Number(value || 0),
  };
}

function gtpBool(value) {
  return {
    "$t": "boolean",
    v: !!value,
  };
}

function gtpValue(value) {
  if (value === undefined) {
    return { "$t": "undefined" };
  }
  if (value === null) {
    return { "$t": "null" };
  }
  if (typeof value === "STRING") {
    return gtpString(value);
  }
  if (typeof value === "NUMBER") {
    return gtpNumber(value);
  }
  if (typeof value === "BOOLEAN") {
    return gtpBool(value);
  }
  if (typeof value === "ARRAY") {
    let items = [];
    for (let item of value) {
      items.push(gtpValue(item));
    }
    return {
      "$t": "array",
      v: items,
    };
  }
  if (typeof value === "OBJECT") {
    let fields = {};
    for (let key in value) {
      fields[key] = gtpValue(value[key]);
    }
    return {
      "$t": "object",
      v: fields,
    };
  }
  return gtpString(String(value));
}

function plainValue(value) {
  if (!value) {
    return undefined;
  }
  let kind = value["$t"];
  if (kind === "undefined") {
    return undefined;
  }
  if (kind === "null") {
    return null;
  }
  if (kind === "string" || kind === "number" || kind === "boolean" || kind === "bytes") {
    return value.v;
  }
  if (kind === "array") {
    let out = [];
    for (let item of asArray(value.v)) {
      out.push(plainValue(item));
    }
    return out;
  }
  if (kind === "object") {
    let out = {};
    let fields = value.v || {};
    for (let key in fields) {
      out[key] = plainValue(fields[key]);
    }
    return out;
  }
  if (kind === "error") {
    return {
      name: value.name,
      message: value.message,
    };
  }
  return value.v;
}

function pluginConfig(app) {
  if (!app || !app.config || !app.config.im || !app.config.im.plugin) {
    return {};
  }
  return app.config.im.plugin;
}

function resolvePath(root, value) {
  let text = String(value || "");
  if (text === "") {
    return text;
  }
  if (path.isAbs && path.isAbs(text)) {
    return text;
  }
  if (text.includes(":\\") || text.includes(":/")) {
    return text;
  }
  return path.join(root, text);
}

export function createLocalGTPPlugin(app, options) {
  if (!options) {
    options = {};
  }
  let cfg = pluginConfig(app);
  let command = options.command || cfg.command || ".agent/plugins/im-bot/gtp-imbot.exe";
  let args = options.args || cfg.args || [];
  let cwd = options.cwd || cfg.cwd || ".";
  let moduleName = options.module || cfg.module || "@plugin/im-bot";
  let root = app.root || ".";
  let proc = exec.spawn(resolvePath(root, command), args, {
    cwd: resolvePath(root, cwd),
  });
  let nextId = 1;
  let listeners = {};

  function writeFrame(frame) {
    proc.writeln(JSON.stringify(frame));
  }

  function readFrame() {
    let line = proc.stdout.readLine();
    if (line === null || line === undefined) {
      throw new Error("im-bot plugin closed stdout");
    }
    return JSON.parse(line);
  }

  function dispatch(frame) {
    if (!frame || frame.type !== "event") {
      return false;
    }
    let key = String(frame.module || "") + ":" + String(frame.event || "");
    let items = listeners[key] || [];
    for (let item of items.slice(0)) {
      item({
        module: frame.module,
        event: frame.event,
        data: plainValue(frame.data),
      });
    }
    return true;
  }

  function readResponse(id) {
    while (true) {
      let frame = readFrame();
      if (dispatch(frame)) {
        continue;
      }
      if (frame.id === id) {
        if (frame.error) {
          throw new Error(frame.error.message || JSON.stringify(frame.error));
        }
        return plainValue(frame.result);
      }
    }
  }

  function call(method, args) {
    let id = "agent-" + String(nextId);
    nextId = nextId + 1;
    let values = [];
    for (let arg of asArray(args)) {
      values.push(gtpValue(arg));
    }
    writeFrame({
      v: 1,
      id: id,
      type: "call",
      module: moduleName,
      method: method,
      args: values,
    });
    return readResponse(id);
  }

  writeFrame({
    v: 1,
    id: "hello-1",
    type: "hello",
    runtime: "gs-agent",
    protocol: "gtp",
    modules: [moduleName],
  });
  readResponse("hello-1");

  if (cfg.configure) {
    call("configure", [cfg.configure]);
  }
  if (app.config && app.config.im && app.config.im.adapters) {
    for (let adapter of app.config.im.adapters) {
      call("configure", [adapter]);
    }
  }

  return {
    configure: function(options) {
      return call("configure", [options]);
    },
    list: function() {
      return call("list", []);
    },
    send: function(options) {
      return call("send", [options]);
    },
    on: function(event, fn) {
      let key = moduleName + ":" + String(event || "");
      if (!listeners[key]) {
        listeners[key] = [];
      }
      listeners[key].push(fn);
      return true;
    },
    listenerCount: function(event) {
      let key = moduleName + ":" + String(event || "");
      if (!listeners[key]) {
        return 0;
      }
      return listeners[key].length;
    },
    close: function() {
      proc.kill();
    },
  };
}
