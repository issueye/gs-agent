let exec = require("@std/exec");
let os = require("@std/os");

// 平台适配层：所有与操作系统进程交互的能力都通过系统命令实现。
// GTS 的 exec.spawn/start 子进程挂在解释器管道上，解释器重启后句柄即丢失，
// 因此进程托管一律采用「脱离式启动 + PID 持久化」，停止/存活/监控均基于 PID。

export function isWindows() {
  return os.platform === "windows";
}

// 把命令行拆成 [可执行文件, ...参数]，支持双引号包裹的片段。
export function tokenizeCommand(command) {
  let tokens = [];
  let current = "";
  let inQuote = false;
  let line = String(command).trim();

  for (let i = 0; i < line.length; i++) {
    let ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (ch === " " && !inQuote) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (current.length > 0) {
    tokens.push(current);
  }
  return tokens;
}

// 按空白（空格/制表符）切分，连续空白视为一个分隔符。
// 注意：GTS 的 String.split 不支持正则，需手动实现。
function splitWhitespace(text) {
  let tokens = [];
  let current = "";
  let line = String(text);
  for (let i = 0; i < line.length; i++) {
    let ch = line[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (current.length > 0) {
    tokens.push(current);
  }
  return tokens;
}

function escapePowerShell(value) {
  // PowerShell 单引号字符串：内部单引号需翻倍转义。
  return String(value).replace(/'/g, "''");
}

function escapeShell(value) {
  // POSIX sh 单引号字符串：'\'' 关闭再拼接转义单引号。
  return String(value).replace(/'/g, "'\\''");
}

function envAssignmentsPowerShell(env) {
  let parts = [];
  if (env) {
    for (let key in env) {
      parts.push("$env:" + key + "='" + escapePowerShell(env[key]) + "'");
    }
  }
  return parts;
}

function envAssignmentsShell(env) {
  let parts = [];
  if (env) {
    for (let key in env) {
      parts.push("export " + key + "='" + escapeShell(env[key]) + "'");
    }
  }
  return parts;
}

// 脱离式启动进程，重定向 stdout/stderr 到日志文件，返回真实 PID。
// options: { command, cwd, env, stdoutLog, stderrLog }
// 返回: { ok: bool, pid: number|null, error: string }
export function spawnDetached(options) {
  let tokens = tokenizeCommand(options.command);
  if (tokens.length === 0) {
    return { ok: false, pid: null, error: "start command is empty" };
  }

  let filePath = tokens[0];
  let cmdArgs = tokens.slice(1);
  let cwd = options.cwd || ".";
  let stdoutLog = options.stdoutLog;
  let stderrLog = options.stderrLog;

  if (isWindows()) {
    return spawnWindows(filePath, cmdArgs, cwd, options.env, stdoutLog, stderrLog);
  }
  return spawnUnix(options.command, cwd, options.env, stdoutLog, stderrLog);
}

function spawnWindows(filePath, cmdArgs, cwd, env, stdoutLog, stderrLog) {
  let script = "$ErrorActionPreference='Stop'; ";

  let assignments = envAssignmentsPowerShell(env);
  if (assignments.length > 0) {
    script += assignments.join("; ") + "; ";
  }

  script += "$p = Start-Process -FilePath '" + escapePowerShell(filePath) + "'";

  if (cmdArgs.length > 0) {
    let quoted = cmdArgs.map((a) => "'" + escapePowerShell(a) + "'");
    script += " -ArgumentList " + quoted.join(",");
  }

  script += " -WorkingDirectory '" + escapePowerShell(cwd) + "'";
  script += " -RedirectStandardOutput '" + escapePowerShell(stdoutLog) + "'";
  script += " -RedirectStandardError '" + escapePowerShell(stderrLog) + "'";
  script += " -WindowStyle Hidden -PassThru; Write-Output $p.Id";

  let result = exec.run("powershell", ["-NoProfile", "-NonInteractive", "-Command", script]);
  if (!result.success) {
    return { ok: false, pid: null, error: (result.stderr || "powershell start failed").trim() };
  }

  let pid = parseInt(String(result.stdout).trim(), 10);
  if (isNaN(pid) || pid <= 0) {
    return { ok: false, pid: null, error: "failed to parse pid from: " + result.stdout };
  }
  return { ok: true, pid: pid, error: "" };
}

function spawnUnix(command, cwd, env, stdoutLog, stderrLog) {
  let parts = [];
  parts.push("cd '" + escapeShell(cwd) + "'");

  let assignments = envAssignmentsShell(env);
  for (let i = 0; i < assignments.length; i++) {
    parts.push(assignments[i]);
  }

  // nohup 脱离终端，后台运行，输出重定向到日志文件，echo $! 取得后台 PID。
  parts.push(
    "nohup " + command + " > '" + escapeShell(stdoutLog) + "' 2> '" + escapeShell(stderrLog) + "' < /dev/null & echo $!"
  );

  let script = parts.join("; ");
  let result = exec.run("sh", ["-c", script]);
  if (!result.success) {
    return { ok: false, pid: null, error: (result.stderr || "sh start failed").trim() };
  }

  let pid = parseInt(String(result.stdout).trim(), 10);
  if (isNaN(pid) || pid <= 0) {
    return { ok: false, pid: null, error: "failed to parse pid from: " + result.stdout };
  }
  return { ok: true, pid: pid, error: "" };
}

// 终止指定 PID 的进程。force=true 时强制结束（含子进程树）。
export function killPid(pid, force) {
  if (pid === null || pid === undefined) {
    return { ok: false, error: "pid is empty" };
  }

  let result;
  if (isWindows()) {
    let args = ["/PID", String(pid), "/T"];
    if (force) {
      args.push("/F");
    }
    result = exec.run("taskkill", args);
  } else {
    let signal = force ? "-9" : "-TERM";
    result = exec.run("kill", [signal, String(pid)]);
  }

  if (!result.success) {
    return { ok: false, error: (result.stderr || result.stdout || "kill failed").trim() };
  }
  return { ok: true, error: "" };
}

// 检查指定 PID 的进程是否存活。
export function isAlive(pid) {
  if (pid === null || pid === undefined) {
    return false;
  }

  if (isWindows()) {
    let result = exec.run("tasklist", ["/FI", "PID eq " + String(pid), "/NH", "/FO", "CSV"]);
    if (!result.success) {
      return false;
    }
    return String(result.stdout).indexOf("\"" + String(pid) + "\"") >= 0;
  }

  let result = exec.run("kill", ["-0", String(pid)]);
  return result.success;
}

// 采集进程资源占用。
// 返回: { memory: <MB>, cpuPercent: <number|null>, cpuSeconds: <number|null> }
// 不同平台可用字段不同，未知字段为 null，由调用方归一化。
export function processMetrics(pid) {
  if (pid === null || pid === undefined) {
    return { memory: 0, cpuPercent: null, cpuSeconds: null };
  }

  if (isWindows()) {
    return metricsWindows(pid);
  }
  return metricsUnix(pid);
}

function metricsWindows(pid) {
  let script =
    "$p = Get-Process -Id " +
    String(pid) +
    " -ErrorAction SilentlyContinue; if ($p) { Write-Output (\"{0}|{1}\" -f $p.WorkingSet64, $p.CPU) }";

  let result = exec.run("powershell", ["-NoProfile", "-NonInteractive", "-Command", script]);
  if (!result.success) {
    return { memory: 0, cpuPercent: null, cpuSeconds: null };
  }

  let line = String(result.stdout).trim();
  if (line.length === 0) {
    return { memory: 0, cpuPercent: null, cpuSeconds: null };
  }

  let fields = line.split("|");
  let bytes = parseFloat(fields[0]);
  let cpuSeconds = fields.length > 1 ? parseFloat(fields[1]) : NaN;

  return {
    memory: isNaN(bytes) ? 0 : Math.round((bytes / 1048576) * 10) / 10,
    cpuPercent: null,
    cpuSeconds: isNaN(cpuSeconds) ? null : cpuSeconds,
  };
}

function metricsUnix(pid) {
  let result = exec.run("ps", ["-p", String(pid), "-o", "%cpu=,rss="]);
  if (!result.success) {
    return { memory: 0, cpuPercent: null, cpuSeconds: null };
  }

  let line = String(result.stdout).trim();
  if (line.length === 0) {
    return { memory: 0, cpuPercent: null, cpuSeconds: null };
  }

  // 输出形如 " 1.5 26840"，先 cpu% 后 rss(KB)。
  let parts = splitWhitespace(line);
  let cpuPercent = parseFloat(parts[0]);
  let rssKb = parts.length > 1 ? parseFloat(parts[1]) : NaN;

  return {
    memory: isNaN(rssKb) ? 0 : Math.round((rssKb / 1024) * 10) / 10,
    cpuPercent: isNaN(cpuPercent) ? null : cpuPercent,
    cpuSeconds: null,
  };
}

// 同步执行一条命令（用于 install/uninstall 等），返回执行结果。
// 返回: { ok: bool, stdout, stderr, exitCode }
export function runCommand(command, cwd, env) {
  let tokens = tokenizeCommand(command);
  if (tokens.length === 0) {
    return { ok: false, stdout: "", stderr: "command is empty", exitCode: -1 };
  }

  let script;
  let runner;
  let runnerArgs;

  if (isWindows()) {
    let parts = [];
    let assignments = envAssignmentsPowerShell(env);
    if (assignments.length > 0) {
      parts.push(assignments.join("; "));
    }
    if (cwd) {
      parts.push("Set-Location '" + escapePowerShell(cwd) + "'");
    }
    parts.push(command);
    script = parts.join("; ");
    runner = "powershell";
    runnerArgs = ["-NoProfile", "-NonInteractive", "-Command", script];
  } else {
    let parts = [];
    if (cwd) {
      parts.push("cd '" + escapeShell(cwd) + "'");
    }
    let assignments = envAssignmentsShell(env);
    for (let i = 0; i < assignments.length; i++) {
      parts.push(assignments[i]);
    }
    parts.push(command);
    script = parts.join("; ");
    runner = "sh";
    runnerArgs = ["-c", script];
  }

  let result = exec.run(runner, runnerArgs);
  return {
    ok: result.success,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}
