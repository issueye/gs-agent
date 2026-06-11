let fs = require("@std/fs");
let path = require("@std/path");
let process = require("@std/process");
let toml = require("@std/toml");

function mergeObject(base, extra) {
  let out = {};
  for (let key in base) {
    out[key] = base[key];
  }
  if (extra) {
    for (let key in extra) {
      out[key] = extra[key];
    }
  }
  return out;
}

function parsePort(value, fallback) {
  if (!value) {
    return fallback;
  }
  let port = parseInt(value);
  if (isNaN(port) || port <= 0) {
    return fallback;
  }
  return port;
}

export function defaultConfig() {
  return {
    gateway: {
      port: 18878,
      dataDir: ".gateway",
      database: ".gateway/gateway.db",
      agentRoot: "../gs-agent",
    },
    im: {
      enabled: true,
    },
    scheduler: {
      enabled: true,
    },
  };
}

export function loadConfig() {
  let root = process.cwd();
  let file = path.join(root, "gateway.toml");
  let cfg = defaultConfig();
  if (fs.existsSync(file)) {
    let parsed = toml.readFileSync(file);
    cfg.gateway = mergeObject(cfg.gateway, parsed.gateway);
    cfg.im = mergeObject(cfg.im, parsed.im);
    cfg.scheduler = mergeObject(cfg.scheduler, parsed.scheduler);
  }

  cfg.gateway.port = parsePort(process.env.GATEWAY_PORT, cfg.gateway.port);
  cfg.root = root;
  cfg.gateway.dataDir = path.resolve(path.join(root, cfg.gateway.dataDir));
  cfg.gateway.database = path.resolve(path.join(root, cfg.gateway.database));
  cfg.gateway.agentRoot = path.resolve(path.join(root, cfg.gateway.agentRoot));
  return cfg;
}
