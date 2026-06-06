let fs = require("@std/fs");
let path = require("@std/path");

function nowText() {
  return (new Date()).toISOString();
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

function appendLine(file, line) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendTextSync(file, line + "\n");
}

function shortText(value, max) {
  if (!value) {
    return "";
  }
  let text = String(value).replaceAll("\r", " ").replaceAll("\n", " ");
  if (text.length > max) {
    return text.slice(0, max) + "...";
  }
  return text;
}

export function logPaths(root) {
  let dir = path.join(root, ".agent", "logs");
  return {
    dir: dir,
    file: path.join(dir, "gs-agent.log"),
    latest: path.join(dir, "latest.log"),
  };
}

export function createLogger(options) {
  if (!options) {
    options = {};
  }

  let file = options.file;
  let latest = options.latest;
  let scope = options.scope || "app";
  let enabled = true;
  if ("enabled" in options) {
    enabled = options.enabled;
  }

  function write(level, message, fields) {
    if (!enabled || !file) {
      return;
    }
    let record = {
      time: nowText(),
      level: level,
      scope: scope,
      message: message,
    };
    if (fields) {
      record.fields = fields;
    }
    let line = safeJson(record);
    appendLine(file, line);
    if (latest) {
      appendLine(latest, line);
    }
  }

  function child(nextScope) {
    return createLogger({
      file: file,
      latest: latest,
      scope: nextScope,
      enabled: enabled,
    });
  }

  return {
    file: file,
    latest: latest,
    debug: function(message, fields) {
      write("debug", message, fields);
    },
    info: function(message, fields) {
      write("info", message, fields);
    },
    warn: function(message, fields) {
      write("warn", message, fields);
    },
    error: function(message, fields) {
      write("error", message, fields);
    },
    child: child,
  };
}

export function createRunLogger(root, scope) {
  let paths = logPaths(root);
  if (fs.existsSync(paths.latest)) {
    fs.unlinkSync(paths.latest);
  }
  return createLogger({
    file: paths.file,
    latest: paths.latest,
    scope: scope || "app",
  });
}

export function eventLogFields(event) {
  if (!event) {
    return {};
  }
  let payload = event.payload;
  let fields = {
    kind: event.kind,
  };

  if (!payload) {
    return fields;
  }

  // 使用 match 表达式处理不同的事件类型
  match(event.kind) {
    // 处理消息事件
    "message" (val) => {
      fields.role = payload.role;
      fields.content = shortText(payload.content, 180);
    }
    // 处理工具调用事件
    "tool_call" (val) => {
      fields.name = payload.name;
      fields.id = payload.id;
      fields.args = payload.args;
    }
    // 处理工具调用结果事件
    "tool_result" (val) => {
      fields.name = payload.name;
      fields.id = payload.id;
      fields.content = shortText(payload.content, 220);
    }
    // 处理轮次开始事件
    "turn_start" (val) => {
      fields.turn = payload.turn;
    }
    // 处理轮次结束事件
    "turn_end" (val) => {
      fields.turn = payload.turn;
      fields.stop = payload.stop;
    }
    // 处理错误事件
    "error" (val) => {
      fields.message = shortText(payload.message, 220);
    }
    // 处理回答事件
    "answer" (val) => {
      fields.file = payload.file;
      fields.content = shortText(payload.content, 220);
    }
  }

  return fields;
}
