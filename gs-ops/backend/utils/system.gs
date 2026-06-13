let process = require("@std/process");

export function nowIso() {
  return new Date().toISOString();
}

export function currentOperator(req) {
  if (req.headers && req.headers["x-operator"]) {
    return req.headers["x-operator"];
  }

  return "admin";
}

export function runtimeInfo() {
  return {
    pid: process.pid,
    cwd: process.cwd(),
    uptime: process.uptime(),
    version: process.version,
  };
}

