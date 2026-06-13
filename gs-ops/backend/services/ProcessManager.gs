import * as platform from "../utils/platform.gs";
import * as installer from "../utils/installer.gs";
import { nowIso } from "../utils/system.gs";

// 进程管理核心：通过平台适配层真实托管服务进程。
// 启动采用「脱离式启动 + PID 持久化」，停止/重启/存活/监控均基于 PID。
export class ProcessManager {
  // 渲染命令中的占位符：${pid} ${port} ${name} ${installPath}。
  renderCommand(command, service) {
    let text = String(command || "");
    text = text.replace("${pid}", service.pid === null || service.pid === undefined ? "" : String(service.pid));
    text = text.replace("${port}", String(service.port || ""));
    text = text.replace("${name}", String(service.name || ""));
    text = text.replace("${installPath}", String(service.installPath || ""));
    return text;
  }

  // 解析服务的工作目录：优先 installPath，否则当前目录。
  workdir(service) {
    let dir = service.installPath;
    if (dir === null || dir === undefined || String(dir).length === 0) {
      return ".";
    }
    return String(dir);
  }

  // 启动服务进程。
  // 返回: { ok, pid, startedAt, error, stdoutLog, stderrLog }
  start(service) {
    let command = this.renderCommand(service.commands ? service.commands.start : "", service);
    if (!command || command.length === 0) {
      return { ok: false, pid: null, startedAt: null, error: "start command is not configured" };
    }

    let cwd = this.workdir(service);
    installer.prepareServiceDirs(service);
    let logFiles = installer.resolveLogFiles(service);

    let result = platform.spawnDetached({
      command: command,
      cwd: cwd,
      env: service.environment || {},
      stdoutLog: logFiles.stdout,
      stderrLog: logFiles.stderr,
    });

    if (!result.ok) {
      return { ok: false, pid: null, startedAt: null, error: result.error, stdoutLog: logFiles.stdout, stderrLog: logFiles.stderr };
    }

    return {
      ok: true,
      pid: result.pid,
      startedAt: nowIso(),
      error: "",
      stdoutLog: logFiles.stdout,
      stderrLog: logFiles.stderr,
    };
  }

  // 停止服务进程。优先按 PID 终止，PID 缺失时回退执行 stop 命令。
  // 返回: { ok, error }
  stop(service) {
    let pid = service.pid;

    if (pid !== null && pid !== undefined) {
      // 先尝试优雅终止，若仍存活再强制结束。
      let gentle = platform.killPid(pid, false);
      if (this.waitForExit(pid, 3000)) {
        return { ok: true, error: "" };
      }
      let forced = platform.killPid(pid, true);
      if (this.waitForExit(pid, 2000)) {
        return { ok: true, error: "" };
      }
      let err = forced.error || gentle.error || "process did not exit";
      return { ok: false, error: err };
    }

    // 没有 PID：回退到配置的 stop 命令。
    let stopCmd = this.renderCommand(service.commands ? service.commands.stop : "", service);
    if (stopCmd && stopCmd.length > 0 && stopCmd !== "stop") {
      let result = platform.runCommand(stopCmd, this.workdir(service), service.environment || {});
      if (!result.ok) {
        return { ok: false, error: (result.stderr || result.stdout || "stop command failed").trim() };
      }
      return { ok: true, error: "" };
    }

    return { ok: true, error: "" };
  }

  // 重启服务：先停止，确认退出后再启动。
  restart(service) {
    let stopped = this.stop(service);
    if (!stopped.ok) {
      return { ok: false, pid: null, startedAt: null, error: "restart failed during stop: " + stopped.error };
    }
    // 清除旧 PID，避免 start 渲染时引用已死进程。
    let fresh = {};
    for (let key in service) {
      fresh[key] = service[key];
    }
    fresh.pid = null;
    return this.start(fresh);
  }

  // 执行 install / uninstall 等一次性命令。
  // 返回: { ok, stdout, stderr, exitCode }
  runCommand(service, commandKey) {
    let raw = service.commands ? service.commands[commandKey] : "";
    let command = this.renderCommand(raw, service);
    if (!command || command.length === 0) {
      // 未配置该命令时视为无操作成功。
      return { ok: true, stdout: "", stderr: "", exitCode: 0, skipped: true };
    }
    let result = platform.runCommand(command, this.workdir(service), service.environment || {});
    return {
      ok: result.ok,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      skipped: false,
    };
  }

  // 校验指定 PID 是否存活（供上层据此修正持久化状态）。
  isAlive(pid) {
    if (pid === null || pid === undefined) {
      return false;
    }
    return platform.isAlive(pid);
  }

  // 等待指定 PID 退出，最多等 timeoutMs 毫秒。返回是否已退出。
  waitForExit(pid, timeoutMs) {
    let deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!platform.isAlive(pid)) {
        return true;
      }
      this.sleep(150);
    }
    return !platform.isAlive(pid);
  }

  // 简单忙等待（GTS 同步环境下用于轮询进程状态）。
  sleep(ms) {
    let end = Date.now() + ms;
    while (Date.now() < end) {
      // busy wait
    }
  }

  // 采集服务运行指标。会真实校验 PID 存活并采集 CPU/内存。
  // 返回的 alive 字段供上层据此修正持久化状态。
  getMetrics(service) {
    let pid = service.pid;
    let running = service.status === "running" && pid !== null && pid !== undefined;

    if (!running) {
      return {
        serviceId: service.id,
        status: service.status,
        pid: null,
        alive: false,
        cpu: 0,
        memory: 0,
        uptime: 0,
        port: service.port,
        checkedAt: nowIso(),
      };
    }

    let alive = platform.isAlive(pid);
    if (!alive) {
      return {
        serviceId: service.id,
        status: "stopped",
        pid: null,
        alive: false,
        cpu: 0,
        memory: 0,
        uptime: 0,
        port: service.port,
        checkedAt: nowIso(),
      };
    }

    let metrics = platform.processMetrics(pid);
    let uptime = this.computeUptime(service.startedAt);

    return {
      serviceId: service.id,
      status: "running",
      pid: pid,
      alive: true,
      cpu: metrics.cpuPercent === null ? 0 : metrics.cpuPercent,
      memory: metrics.memory,
      uptime: uptime,
      port: service.port,
      checkedAt: nowIso(),
    };
  }

  // 根据启动时间戳计算运行时长（秒）。
  computeUptime(startedAt) {
    if (!startedAt) {
      return 0;
    }
    let start = Date.parse(startedAt);
    if (isNaN(start)) {
      return 0;
    }
    let seconds = Math.floor((Date.now() - start) / 1000);
    return seconds < 0 ? 0 : seconds;
  }
}
