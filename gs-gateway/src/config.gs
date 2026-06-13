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
      defaultAgent: {
        enabled: false,
        name: "default",
        modelProvider: "anthropic",
        modelName: "deepseek-v4-flash",
        baseUrl: "https://api.deepseek.com/anthropic",
        systemPrompt: "You are a concise coding agent. Before acting, analyze the user's request, identify the concrete tasks needed, and state or maintain a brief task plan. Then work through the tasks in order, using tools when useful. Complete the user's requested task and stop when you have a final answer.",
        maxIterations: 10,
        toolWhitelist: ["read_file", "list_dir", "grep", "todo"],
        apiKeyEnv: "GS_AGENT_API_KEY",
      },
    },
    im: {
      enabled: true,
      outbound: {
        enabled: true,
        adapter: "console",
        retryMax: 3,
        retryDelayMs: 1000,
        webhookUrl: "",
      },
    },
    scheduler: {
      enabled: true,
    },
  };
}

function mergeDefaultAgent(base, extra) {
  if (!extra) {
    return base;
  }
  let out = {};
  for (let key in base) {
    out[key] = base[key];
  }
  for (let key in extra) {
    out[key] = extra[key];
  }
  return out;
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
    if (parsed.im && parsed.im.outbound) {
      cfg.im.outbound = mergeObject(cfg.im.outbound, parsed.im.outbound);
    }
    if (parsed.gateway && parsed.gateway.defaultAgent) {
      cfg.gateway.defaultAgent = mergeDefaultAgent(cfg.gateway.defaultAgent, parsed.gateway.defaultAgent);
    }
  }

  cfg.gateway.port = parsePort(process.env.GATEWAY_PORT, cfg.gateway.port);
  cfg.root = root;
  cfg.gateway.dataDir = path.resolve(path.join(root, cfg.gateway.dataDir));
  cfg.gateway.database = path.resolve(path.join(root, cfg.gateway.database));
  cfg.gateway.agentRoot = path.resolve(path.join(root, cfg.gateway.agentRoot));
  return cfg;
}
