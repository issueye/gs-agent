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

  if (event.kind === "message" && payload) {
    fields.role = payload.role;
    fields.content = shortText(payload.content, 180);
  } else if (event.kind === "tool_call" && payload) {
    fields.name = payload.name;
    fields.id = payload.id;
    fields.args = payload.args;
  } else if (event.kind === "tool_result" && payload) {
    fields.name = payload.name;
    fields.id = payload.id;
    fields.content = shortText(payload.content, 220);
  } else if (event.kind === "turn_start" && payload) {
    fields.turn = payload.turn;
  } else if (event.kind === "turn_end" && payload) {
    fields.turn = payload.turn;
    fields.stop = payload.stop;
  } else if (event.kind === "error" && payload) {
    fields.message = shortText(payload.message, 220);
  } else if (event.kind === "answer" && payload) {
    fields.file = payload.file;
    fields.content = shortText(payload.content, 220);
  }

  return fields;
}
