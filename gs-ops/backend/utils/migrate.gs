let fs = require("@std/fs");
let json = require("@std/json");
import { getDatabase } from "../config/database.gs";
import { nowIso } from "./system.gs";

// 数据迁移脚本 - 从 JSON 文件迁移到 SQLite 数据库
export function migrateFromJsonFiles(rootDir) {
  let db = getDatabase();
  let migrated = {
    services: 0,
    logs: 0,
    versions: 0,
    backups: 0,
    templates: 0,
  };

  // 迁移服务数据
  let servicesFile = rootDir + "/storage/services.json";
  if (fs.existsSync(servicesFile)) {
    try {
      let servicesData = JSON.parse(fs.readTextSync(servicesFile));
      for (let service of servicesData) {
        let existing = db.table("services").where("id = ?", service.id).first();
        if (existing === null) {
          db.table("services").insert({
            id: service.id,
            name: service.name,
            display_name: service.displayName,
            description: service.description,
            version: service.version,
            status: service.status,
            type: service.type,
            install_path: service.installPath,
            config_path: service.configPath,
            log_path: service.logPath,
            port: service.port,
            pid: service.pid,
            uptime: service.uptime || 0,
            auto_start: service.autoStart ? 1 : 0,
            dependencies: JSON.stringify(service.dependencies || []),
            commands: JSON.stringify(service.commands || {}),
            environment: JSON.stringify(service.environment || {}),
            health_check: JSON.stringify(service.healthCheck || {}),
            created_at: service.createdAt,
            updated_at: service.updatedAt,
          });
          migrated.services = migrated.services + 1;
        }
      }
    } catch (e) {
      console.log("Warning: Failed to migrate services.json:", String(e));
    }
  }

  // 迁移运行时状态（合并到 services 表）
  let runtimeFile = rootDir + "/storage/runtime-state.json";
  if (fs.existsSync(runtimeFile)) {
    try {
      let runtimeData = JSON.parse(fs.readTextSync(runtimeFile));
      for (let serviceId in runtimeData) {
        let state = runtimeData[serviceId];
        db.table("services")
          .where("id = ?", serviceId)
          .update({
            version: state.version,
            status: state.status,
            pid: state.pid,
            uptime: state.uptime || 0,
            updated_at: state.updatedAt,
          });
      }
    } catch (e) {
      console.log("Warning: Failed to migrate runtime-state.json:", String(e));
    }
  }

  // 迁移操作日志
  let logsFile = rootDir + "/storage/operation-logs.json";
  if (fs.existsSync(logsFile)) {
    try {
      let logsData = JSON.parse(fs.readTextSync(logsFile));
      for (let log of logsData) {
        db.table("operation_logs").insert({
          service_id: log.serviceId,
          operation: log.operation,
          status: log.status,
          message: log.message,
          operator: log.operator,
          timestamp: log.timestamp,
        });
        migrated.logs = migrated.logs + 1;
      }
    } catch (e) {
      console.log("Warning: Failed to migrate operation-logs.json:", String(e));
    }
  }

  // 迁移版本历史
  let versionsFile = rootDir + "/storage/versions.json";
  if (fs.existsSync(versionsFile)) {
    try {
      let versionsData = JSON.parse(fs.readTextSync(versionsFile));
      for (let serviceId in versionsData) {
        let history = versionsData[serviceId];
        for (let entry of history) {
          db.table("version_history").insert({
            id: entry.id,
            service_id: serviceId,
            version: entry.version,
            previous_version: entry.previousVersion,
            action: entry.action,
            status: entry.status,
            operator: entry.operator,
            timestamp: entry.timestamp,
          });
          migrated.versions = migrated.versions + 1;
        }
      }
    } catch (e) {
      console.log("Warning: Failed to migrate versions.json:", String(e));
    }
  }

  // 迁移配置备份
  let backupsFile = rootDir + "/storage/config-backups.json";
  if (fs.existsSync(backupsFile)) {
    try {
      let backupsData = JSON.parse(fs.readTextSync(backupsFile));
      for (let serviceId in backupsData) {
        let backups = backupsData[serviceId];
        for (let backup of backups) {
          db.table("config_backups").insert({
            id: backup.id,
            service_id: serviceId,
            commands: JSON.stringify(backup.commands || {}),
            environment: JSON.stringify(backup.environment || {}),
            health_check: JSON.stringify(backup.healthCheck || {}),
            created_by: "system",
            created_at: backup.timestamp,
          });
          migrated.backups = migrated.backups + 1;
        }
      }
    } catch (e) {
      console.log("Warning: Failed to migrate config-backups.json:", String(e));
    }
  }

  // 迁移服务模板
  let templatesFile = rootDir + "/storage/service-templates.json";
  if (fs.existsSync(templatesFile)) {
    try {
      let templatesData = JSON.parse(fs.readTextSync(templatesFile));
      for (let template of templatesData) {
        let existing = db.table("service_templates").where("id = ?", template.id).first();
        if (existing === null) {
          db.table("service_templates").insert({
            id: template.id,
            name: template.name,
            description: template.description,
            type: template.type,
            defaults: JSON.stringify(template.defaults || {}),
            created_at: template.createdAt || nowIso(),
          });
          migrated.templates = migrated.templates + 1;
        }
      }
    } catch (e) {
      console.log("Warning: Failed to migrate service-templates.json:", String(e));
    }
  }

  return migrated;
}
