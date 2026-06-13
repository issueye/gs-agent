let fs = require("@std/fs");
let path = require("@std/path");

import { getDatabase } from "../config/database.gs";
import { nowIso } from "../utils/system.gs";

export class ConfigManager {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.db = getDatabase();
    this.ensureStorage();
  }

  resolve(relativePath) {
    return path.join(this.rootDir, relativePath);
  }

  ensureStorage() {
    let storagePath = this.resolve("storage");
    fs.mkdirSync(storagePath, { recursive: true });
  }

  backupServiceConfig(service) {
    let backup = {
      id: "cfg-" + String(Date.now()),
      service_id: service.id,
      commands: JSON.stringify(service.commands || {}),
      environment: JSON.stringify(service.environment || {}),
      health_check: JSON.stringify(service.healthCheck || {}),
      created_by: "system",
      created_at: nowIso(),
    };

    this.db.table("config_backups").insert(backup);
    return {
      id: backup.id,
      serviceId: backup.service_id,
      commands: JSON.parse(backup.commands),
      environment: JSON.parse(backup.environment),
      healthCheck: JSON.parse(backup.health_check),
      createdBy: backup.created_by,
      createdAt: backup.created_at,
    };
  }

  listServiceBackups(serviceId) {
    let records = this.db
      .table("config_backups")
      .where("service_id = ?", serviceId)
      .orderBy("created_at DESC")
      .limit(30)
      .find();

    return records.map((record) => ({
      id: record.id,
      serviceId: record.service_id,
      commands: JSON.parse(record.commands || "{}"),
      environment: JSON.parse(record.environment || "{}"),
      healthCheck: JSON.parse(record.health_check || "{}"),
      createdBy: record.created_by,
      createdAt: record.created_at,
    }));
  }

  findServiceBackup(serviceId, backupId) {
    let record = this.db
      .table("config_backups")
      .where("service_id = ?", serviceId)
      .where("id = ?", backupId)
      .first();

    if (record === null) {
      return null;
    }

    return {
      id: record.id,
      serviceId: record.service_id,
      commands: JSON.parse(record.commands || "{}"),
      environment: JSON.parse(record.environment || "{}"),
      healthCheck: JSON.parse(record.health_check || "{}"),
      createdBy: record.created_by,
      createdAt: record.created_at,
    };
  }
}
