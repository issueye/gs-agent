let path = require("@std/path");
let fs = require("@std/fs");

import { getDatabase } from "../config/database.gs";
import { nowIso } from "../utils/system.gs";
import * as installer from "../utils/installer.gs";

export class VersionManager {
  constructor(logManager, serviceManager) {
    this.db = getDatabase();
    this.logManager = logManager;
    this.serviceManager = serviceManager;
  }

  list(serviceId) {
    let records = this.db
      .table("version_history")
      .where("service_id = ?", serviceId)
      .orderBy("timestamp DESC")
      .limit(50)
      .find();

    return records.map((record) => ({
      id: record.id,
      version: record.version,
      previousVersion: record.previous_version,
      action: record.action,
      status: record.status,
      operator: record.operator,
      timestamp: record.timestamp,
    }));
  }

  addHistory(serviceId, version, previousVersion, action, status, operator) {
    let entry = {
      id: "ver-" + String(Date.now()),
      service_id: serviceId,
      version: version,
      previous_version: previousVersion,
      action: action,
      status: status,
      operator: operator,
      timestamp: nowIso(),
    };

    this.db.table("version_history").insert(entry);
    return entry;
  }

  // 备份目录：backups/<serviceId>。每个版本的安装目录快照固定存为 <version>.zip。
  backupDir(serviceId) {
    return path.join("backups", serviceId);
  }

  // 某个版本的快照固定路径，回滚时按此规则查找。
  snapshotPath(serviceId, version) {
    return path.join(this.backupDir(serviceId), this.safeVersion(version) + ".zip");
  }

  // 版本号可能含非法文件名字符，归一化为安全文件名。
  safeVersion(version) {
    let text = String(version || "unknown");
    let safe = "";
    let allowed = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-_";
    for (let i = 0; i < text.length; i++) {
      safe += allowed.includes(text[i]) ? text[i] : "_";
    }
    return safe;
  }

  // 升级：备份当前版本快照 → 部署新包 → 更新版本号 → 重启。失败回滚到原快照。
  // input 可携带 packagePath（安装包路径，.zip 解压 / 单文件拷贝到 installPath）。
  upgradeServiceVersion(serviceId, version, operator, input) {
    let service = this.serviceManager.find(serviceId);
    if (service === null) {
      return null;
    }

    let fromVersion = service.version;
    let targetVersion = version || this.nextPatchVersion(fromVersion);
    let packagePath = input && input.packagePath ? input.packagePath : null;

    // 1) 备份当前安装目录为 <fromVersion> 快照，供失败回滚与日后 rollback 使用。
    let snapshot = this.snapshotPath(serviceId, fromVersion);
    if (service.installPath && fs.existsSync(service.installPath)) {
      let backup = installer.backupInstallDir(service.installPath, this.backupDir(serviceId), "v");
      if (backup.ok) {
        // backupInstallDir 用时间戳命名，这里重命名到固定的 <fromVersion>.zip 规则路径。
        installer.ensureDir(this.backupDir(serviceId));
        if (fs.existsSync(snapshot)) {
          fs.rmSync(snapshot, { force: true });
        }
        fs.renameSync(backup.archive, snapshot);
      }
    }

    // 2) 部署新安装包（若提供）。
    if (packagePath) {
      let deploy = installer.deployPackage(packagePath, service.installPath);
      if (!deploy.ok) {
        this.addHistory(serviceId, targetVersion, fromVersion, "upgrade", "error", operator);
        this.logManager.record(serviceId, "version.upgrade", "error", deploy.message, operator);
        return { service: this.serviceManager.find(serviceId), version: { version: fromVersion, previousVersion: fromVersion, action: "upgrade" }, error: deploy.message };
      }
    }

    // 3) 更新版本号。
    this.serviceManager.setVersion(serviceId, targetVersion);

    // 4) 若原本在运行，则重启使新版本生效。
    let restartError = this.restartIfRunning(service, operator);
    if (restartError !== null) {
      // 重启失败：回滚文件与版本号。
      this.restoreSnapshot(serviceId, fromVersion, service.installPath);
      this.serviceManager.setVersion(serviceId, fromVersion);
      this.addHistory(serviceId, targetVersion, fromVersion, "upgrade", "error", operator);
      this.logManager.record(serviceId, "version.upgrade", "error", "restart failed, rolled back: " + restartError, operator);
      return { service: this.serviceManager.find(serviceId), version: { version: fromVersion, previousVersion: fromVersion, action: "upgrade" }, error: restartError };
    }

    this.addHistory(serviceId, targetVersion, fromVersion, "upgrade", "success", operator);
    this.logManager.record(serviceId, "version.upgrade", "success", "upgraded from " + fromVersion + " to " + targetVersion, operator);

    return {
      service: this.serviceManager.find(serviceId),
      version: { version: targetVersion, previousVersion: fromVersion, action: "upgrade" },
    };
  }

  // 回滚：找到目标版本快照 → 恢复安装目录 → 更新版本号 → 重启。
  rollbackServiceVersion(serviceId, version, operator) {
    let service = this.serviceManager.find(serviceId);
    if (service === null) {
      return null;
    }

    let history = this.list(serviceId);
    let targetVersion = version;
    if (!targetVersion && history.length > 0) {
      targetVersion = history[0].previousVersion;
    }
    if (!targetVersion) {
      this.logManager.record(serviceId, "version.rollback", "error", "no target version to roll back to", operator);
      return { service: service, version: { version: service.version, previousVersion: service.version, action: "rollback" }, error: "no target version" };
    }

    let fromVersion = service.version;
    let snapshot = this.snapshotPath(serviceId, targetVersion);

    if (!fs.existsSync(snapshot)) {
      let msg = "snapshot not found for version " + targetVersion + " at " + snapshot;
      this.addHistory(serviceId, targetVersion, fromVersion, "rollback", "error", operator);
      this.logManager.record(serviceId, "version.rollback", "error", msg, operator);
      return { service: service, version: { version: fromVersion, previousVersion: fromVersion, action: "rollback" }, error: msg };
    }

    // 恢复文件后更新版本号。
    let restore = this.restoreSnapshot(serviceId, targetVersion, service.installPath);
    if (!restore.ok) {
      this.addHistory(serviceId, targetVersion, fromVersion, "rollback", "error", operator);
      this.logManager.record(serviceId, "version.rollback", "error", restore.message, operator);
      return { service: service, version: { version: fromVersion, previousVersion: fromVersion, action: "rollback" }, error: restore.message };
    }

    this.serviceManager.setVersion(serviceId, targetVersion);
    let restartError = this.restartIfRunning(service, operator);

    this.addHistory(serviceId, targetVersion, fromVersion, "rollback", restartError === null ? "success" : "error", operator);
    if (restartError !== null) {
      this.logManager.record(serviceId, "version.rollback", "error", "files restored but restart failed: " + restartError, operator);
    } else {
      this.logManager.record(serviceId, "version.rollback", "success", "rolled back from " + fromVersion + " to " + targetVersion, operator);
    }

    return {
      service: this.serviceManager.find(serviceId),
      version: { version: targetVersion, previousVersion: fromVersion, action: "rollback" },
    };
  }

  // 从固定路径快照恢复安装目录。
  restoreSnapshot(serviceId, version, installPath) {
    let snapshot = this.snapshotPath(serviceId, version);
    return installer.restoreInstallDir(snapshot, installPath);
  }

  // 若服务当前在运行，重启以应用新文件。返回 null 表示成功（或无需重启），否则返回错误信息。
  restartIfRunning(service, operator) {
    if (service.status !== "running") {
      return null;
    }
    let result = this.serviceManager.runLifecycle(service.id, "restart", operator);
    if (result !== null && result.status === "running") {
      return null;
    }
    return "service did not return to running state after restart";
  }

  nextPatchVersion(version) {
    let parts = String(version).split(".");
    if (parts.length < 3) {
      return version + ".1";
    }

    let patch = Number(parts[2]) + 1;
    return parts[0] + "." + parts[1] + "." + String(patch);
  }
}
