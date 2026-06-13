import { Service } from "../models/Service.gs";
import { getDatabase } from "../config/database.gs";
import { nowIso } from "../utils/system.gs";
import * as installer from "../utils/installer.gs";

export class ServiceManager {
  constructor(configManager, logManager, processManager) {
    this.db = getDatabase();
    this.configManager = configManager;
    this.logManager = logManager;
    this.processManager = processManager;
  }

  list() {
    let records = this.db.table("services").orderBy("created_at DESC").find();
    return records.map((record) => Service.fromDBRecord(record).toJSON());
  }

  find(id) {
    let record = this.db.table("services").where("id = ?", id).first();
    if (record === null) {
      return null;
    }
    return Service.fromDBRecord(record).toJSON();
  }

  templates() {
    try {
      let records = this.db.table("service_templates").orderBy("name ASC").find();
      return records.map((record) => ({
        id: record.id,
        name: record.name,
        description: record.description,
        type: record.type,
        defaults: JSON.parse(record.defaults || "{}"),
        createdAt: record.created_at,
      }));
    } catch (e) {
      console.log("Error in templates():", String(e));
      throw e;
    }
  }

  findTemplate(id) {
    let record = this.db.table("service_templates").where("id = ?", id).first();
    if (record === null) {
      return null;
    }
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      type: record.type,
      defaults: JSON.parse(record.defaults || "{}"),
      createdAt: record.created_at,
    };
  }

  createFromTemplate(input, operator) {
    let templateId = input.templateId || "";
    let template = this.findTemplate(templateId);
    if (template === null) {
      throw "template not found";
    }

    let serviceId = this.cleanId(input.id || "");
    if (!serviceId) {
      throw "service id is required";
    }
    if (serviceId !== input.id) {
      throw "service id can only contain lowercase letters, numbers, and hyphens";
    }
    if (this.find(serviceId) !== null) {
      throw "service id already exists";
    }

    let defaults = template.defaults || {};
    let port = Number(input.port || defaults.port || 0);
    if (port <= 0 || port > 65535) {
      throw "service port must be between 1 and 65535";
    }

    let serviceName = input.name || serviceId;
    let version = input.version || defaults.version || "0.1.0";
    let createdAt = nowIso();

    let service = new Service({
      id: serviceId,
      name: serviceName,
      displayName: input.displayName || serviceName,
      description: input.description || template.description || "",
      version: version,
      status: "stopped",
      type: template.type,
      installPath: this.renderString(input.installPath || defaults.installPath || "", serviceName, port),
      configPath: this.renderString(input.configPath || defaults.configPath || "", serviceName, port),
      logPath: this.renderString(input.logPath || defaults.logPath || "", serviceName, port),
      port: port,
      pid: null,
      uptime: 0,
      autoStart: this.resolveAutoStart(input, defaults),
      dependencies: input.dependencies || [],
      commands: this.renderObject(defaults.commands || {}, serviceName, port),
      environment: this.renderObject(defaults.environment || {}, serviceName, port),
      healthCheck: this.renderObject(defaults.healthCheck || { enabled: false }, serviceName, port),
      createdAt: createdAt,
      updatedAt: createdAt,
    });

    this.db.table("services").insert(service.toDBRecord());

    // 添加版本历史
    this.db.table("version_history").insert({
      id: "ver-" + String(Date.now()),
      service_id: service.id,
      version: service.version,
      previous_version: null,
      action: "install",
      status: "success",
      operator: operator,
      timestamp: createdAt,
    });

    this.logManager.record(service.id, "service.create", "success", "created from template " + template.id, operator);
    return service.toJSON();
  }

  cleanId(value) {
    let id = String(value).trim().toLowerCase();
    if (!this.isValidId(id)) {
      return "";
    }
    return id;
  }

  isValidId(id) {
    if (!id) {
      return false;
    }
    let chars = "abcdefghijklmnopqrstuvwxyz0123456789-";
    for (let i = 0; i < id.length; i++) {
      if (!chars.includes(id[i])) {
        return false;
      }
    }
    return true;
  }

  resolveAutoStart(input, defaults) {
    if (input.autoStart === true) {
      return true;
    }
    if (input.autoStart === false) {
      return false;
    }
    return defaults.autoStart === true;
  }

  renderObject(value, serviceName, port) {
    if (typeof value === "string") {
      return this.renderString(value, serviceName, port);
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.renderObject(item, serviceName, port));
    }
    if (value !== null && typeof value === "object") {
      let output = {};
      for (let key in value) {
        output[key] = this.renderObject(value[key], serviceName, port);
      }
      return output;
    }
    return value;
  }

  renderString(value, serviceName, port) {
    return String(value).replace("${name}", serviceName).replace("${port}", String(port));
  }

  updateService(id, updates) {
    let service = this.find(id);
    if (service === null) {
      return null;
    }

    updates.updated_at = nowIso();
    this.db.table("services").where("id = ?", id).update(updates);
    return this.find(id);
  }

  // 直接设置状态与运行字段（由生命周期操作的真实结果驱动，不再伪造 PID）。
  setStatus(id, status, fields) {
    let service = this.find(id);
    if (service === null) {
      return null;
    }

    let updates = { status: status };
    if (fields) {
      for (let key in fields) {
        updates[key] = fields[key];
      }
    }

    return this.updateService(id, updates);
  }

  setVersion(id, version) {
    return this.updateService(id, { version: version });
  }

  // 生命周期分派：将操作真正落到 ProcessManager / installer 上。
  // 任一步骤失败都会把状态标记为 error 并记录 stderr 到操作日志。
  runLifecycle(id, operation, operator) {
    let service = this.find(id);
    if (service === null) {
      return null;
    }

    if (operation === "install") {
      return this.doInstall(service, operator);
    }
    if (operation === "start") {
      return this.doStart(service, operator);
    }
    if (operation === "stop") {
      return this.doStop(service, operator);
    }
    if (operation === "restart") {
      return this.doRestart(service, operator);
    }
    if (operation === "uninstall") {
      return this.doUninstall(service, operator);
    }

    throw "unsupported operation: " + operation;
  }

  doInstall(service, operator) {
    // 准备目录后执行 install 命令（未配置则视为无操作）。
    installer.prepareServiceDirs(service);
    let result = this.processManager.runCommand(service, "install");
    if (!result.ok) {
      this.logManager.record(service.id, "install", "error", this.trimOutput(result.stderr || result.stdout), operator);
      return this.setStatus(service.id, "error");
    }

    let detail = result.skipped ? "install command not configured, directories prepared" : this.trimOutput(result.stdout) || "install command completed";
    this.logManager.record(service.id, "install", "success", detail, operator);
    return this.setStatus(service.id, "stopped", { pid: null, uptime: 0, started_at: null });
  }

  doStart(service, operator) {
    if (service.pid !== null && service.pid !== undefined && this.processManager.isAlive(service.pid)) {
      this.logManager.record(service.id, "start", "success", "service already running (pid " + service.pid + ")", operator);
      return this.find(service.id);
    }

    let result = this.processManager.start(service);
    if (!result.ok) {
      this.logManager.record(service.id, "start", "error", this.trimOutput(result.error), operator);
      return this.setStatus(service.id, "error", { pid: null, started_at: null, uptime: 0 });
    }

    this.logManager.record(service.id, "start", "success", "started with pid " + result.pid, operator);
    return this.setStatus(service.id, "running", { pid: result.pid, started_at: result.startedAt, uptime: 0 });
  }

  doStop(service, operator) {
    let result = this.processManager.stop(service);
    if (!result.ok) {
      this.logManager.record(service.id, "stop", "error", this.trimOutput(result.error), operator);
      return this.setStatus(service.id, "error");
    }

    this.logManager.record(service.id, "stop", "success", "service stopped", operator);
    return this.setStatus(service.id, "stopped", { pid: null, uptime: 0, started_at: null });
  }

  doRestart(service, operator) {
    let result = this.processManager.restart(service);
    if (!result.ok) {
      this.logManager.record(service.id, "restart", "error", this.trimOutput(result.error), operator);
      return this.setStatus(service.id, "error", { pid: null, started_at: null, uptime: 0 });
    }

    this.logManager.record(service.id, "restart", "success", "restarted with pid " + result.pid, operator);
    return this.setStatus(service.id, "running", { pid: result.pid, started_at: result.startedAt, uptime: 0 });
  }

  doUninstall(service, operator) {
    // 先确保进程停止，避免卸载正在运行的服务。
    if (service.pid !== null && service.pid !== undefined) {
      this.processManager.stop(service);
    }

    // 执行 uninstall 命令（未配置则跳过）。
    let result = this.processManager.runCommand(service, "uninstall");
    if (!result.ok) {
      this.logManager.record(service.id, "uninstall", "error", this.trimOutput(result.stderr || result.stdout), operator);
      return this.setStatus(service.id, "error");
    }

    this.logManager.record(service.id, "uninstall", "success", "service uninstalled", operator);
    return this.setStatus(service.id, "stopped", { pid: null, uptime: 0, started_at: null });
  }

  trimOutput(text) {
    let value = String(text || "").trim();
    if (value.length > 2000) {
      return value.slice(0, 2000);
    }
    return value;
  }

  updateConfig(id, config, operator) {
    let currentService = this.find(id);
    if (currentService !== null) {
      this.configManager.backupServiceConfig(currentService);
    }

    let updates = {
      commands: JSON.stringify(config.commands || currentService.commands),
      environment: JSON.stringify(config.environment || currentService.environment),
      health_check: JSON.stringify(config.healthCheck || currentService.healthCheck),
    };

    let service = this.updateService(id, updates);
    if (service !== null) {
      this.logManager.record(id, "config.update", "success", "service config updated", operator);
    }

    return service;
  }

  backups(id) {
    if (this.find(id) === null) {
      return null;
    }
    return this.configManager.listServiceBackups(id);
  }

  backupConfig(id, operator) {
    let service = this.find(id);
    if (service === null) {
      return null;
    }

    let backup = this.configManager.backupServiceConfig(service);
    this.logManager.record(id, "config.backup", "success", "service config backed up", operator);
    return backup;
  }

  restoreConfig(id, backupId, operator) {
    let backup = this.configManager.findServiceBackup(id, backupId);
    if (backup === null) {
      return null;
    }

    let updates = {
      commands: JSON.stringify(backup.commands),
      environment: JSON.stringify(backup.environment),
      health_check: JSON.stringify(backup.healthCheck),
    };

    let service = this.updateService(id, updates);
    if (service !== null) {
      this.logManager.record(id, "config.restore", "success", "service config restored from " + backupId, operator);
    }

    return service;
  }

  metrics(id) {
    let service = this.find(id);
    if (service === null) {
      return null;
    }
    return this.processManager.getMetrics(service);
  }

  // 读取服务进程的 stdout/stderr 日志（与操作审计日志不同，这是进程真实输出）。
  // opts: { stream: "stdout"|"stderr"|"both", lines: number }
  processLogs(id, opts) {
    let service = this.find(id);
    if (service === null) {
      return null;
    }

    let options = opts || {};
    let lines = options.lines || 200;
    let stream = options.stream || "both";

    let logFiles = installer.resolveLogFiles(service);
    let result = {
      serviceId: service.id,
      logPath: service.logPath,
      stdout: null,
      stderr: null,
    };

    if (stream === "stdout" || stream === "both") {
      result.stdout = {
        file: logFiles.stdout,
        content: installer.tailLogLines(logFiles.stdout, lines),
      };
    }
    if (stream === "stderr" || stream === "both") {
      result.stderr = {
        file: logFiles.stderr,
        content: installer.tailLogLines(logFiles.stderr, lines),
      };
    }

    return result;
  }
}
