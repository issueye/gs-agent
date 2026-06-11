let fs = require("@std/fs");
let path = require("@std/path");
let toml = require("@std/toml");
let process = require("@std/process");

function firstArgValue(names) {
  let args = process.argv || [];
  for (let i = 0; i < args.length; i = i + 1) {
    let arg = String(args[i] || "");
    for (let name of names) {
      if (arg === name && i + 1 < args.length) {
        return String(args[i + 1] || "");
      }
      if (arg.startsWith(name + "=")) {
        return arg.slice(name.length + 1);
      }
    }
  }
  return "";
}

function numberValue(value, fallback) {
  let n = Number(value || 0);
  if (n > 0) {
    return n;
  }
  return fallback;
}

function boolValue(value, fallback) {
  if (value === true || value === false) {
    return value;
  }
  if (String(value).toLowerCase() === "true") {
    return true;
  }
  if (String(value).toLowerCase() === "false") {
    return false;
  }
  return fallback;
}

function resolvePath(root, value) {
  let text = String(value || "");
  if (text === "") {
    return "";
  }
  if (path.isAbs && path.isAbs(text)) {
    return text;
  }
  return path.join(root, text);
}

export function loadConfig() {
  let root = process.cwd();
  let explicitConfig = firstArgValue(["--config", "-config"]);
  let configPath = explicitConfig || path.join(root, "config.toml");
  if (!fs.existsSync(configPath)) {
    configPath = path.join(root, "config.example.toml");
  }

  let raw = {};
  if (fs.existsSync(configPath)) {
    raw = toml.readFileSync(configPath);
  }

  let dataDir = String(firstArgValue(["--data-dir"]) || process.getenv("GS_LLM_BRIDGE_DATA_DIR", raw.data_dir || ".data"));
  let addr = String(firstArgValue(["--addr"]) || process.getenv("GS_LLM_BRIDGE_ADDR", ""));
  let host = String(process.getenv("GS_LLM_BRIDGE_HOST", raw.host || "127.0.0.1"));
  let port = numberValue(process.getenv("GS_LLM_BRIDGE_PORT", raw.port), 18181);
  if (addr !== "" && addr.indexOf(":") >= 0) {
    let pieces = addr.split(":");
    host = pieces[0] || host;
    port = numberValue(pieces[1], port);
  }

  let resolvedDataDir = resolvePath(root, dataDir);
  let storePath = String(raw.store_path || "");
  if (storePath === "") {
    storePath = path.join(resolvedDataDir, "store.json");
  } else {
    storePath = resolvePath(root, storePath);
  }

  return {
    root: root,
    configPath: configPath,
    host: host,
    port: port,
    dataDir: resolvedDataDir,
    storePath: storePath,
    allowLocalWithoutAuth: boolValue(raw.allow_local_without_auth, true),
    defaultMaxTokens: numberValue(raw.default_max_tokens, 32768),
    log: {
      chainLogBodies: boolValue(raw.log ? raw.log.chain_log_bodies : false, false),
      chainLogMaxBodyBytes: numberValue(raw.log ? raw.log.chain_log_max_body_bytes : 8192, 8192),
    },
  };
}
