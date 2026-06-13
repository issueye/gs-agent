import orm from "@std/orm";
let process = require("@std/process");

// 数据库配置
export const DB_DRIVER = "sqlite";
export const DB_DSN = process.getenv("GS_OPS_DB_DSN", "storage/gs-ops.db");

// 数据库表结构定义
export const SCHEMAS = [
  // 服务表
  {
    table: "services",
    columns: [
      { name: "id", type: "text", primaryKey: true },
      { name: "name", type: "text", notNull: true },
      { name: "display_name", type: "text", notNull: true },
      { name: "description", type: "text" },
      { name: "version", type: "text", notNull: true },
      { name: "status", type: "text", notNull: true },
      { name: "type", type: "text", notNull: true },
      { name: "install_path", type: "text" },
      { name: "config_path", type: "text" },
      { name: "log_path", type: "text" },
      { name: "port", type: "integer" },
      { name: "pid", type: "integer" },
      { name: "uptime", type: "integer", defaultValue: 0 },
      { name: "started_at", type: "text" },
      { name: "auto_start", type: "integer", defaultValue: 0 },
      { name: "dependencies", type: "text" },
      { name: "commands", type: "text" },
      { name: "environment", type: "text" },
      { name: "health_check", type: "text" },
      { name: "created_at", type: "text", notNull: true },
      { name: "updated_at", type: "text", notNull: true },
    ],
    indexes: [
      { columns: ["name"], unique: true },
      { columns: ["status"] },
      { columns: ["type"] },
    ],
  },
  // 操作日志表
  {
    table: "operation_logs",
    columns: [
      { name: "id", type: "integer", primaryKey: true, autoIncrement: true },
      { name: "service_id", type: "text", notNull: true },
      { name: "operation", type: "text", notNull: true },
      { name: "status", type: "text", notNull: true },
      { name: "message", type: "text" },
      { name: "operator", type: "text" },
      { name: "timestamp", type: "text", notNull: true },
    ],
    indexes: [
      { columns: ["service_id"] },
      { columns: ["operation"] },
      { columns: ["timestamp"] },
    ],
  },
  // 版本历史表
  {
    table: "version_history",
    columns: [
      { name: "id", type: "text", primaryKey: true },
      { name: "service_id", type: "text", notNull: true },
      { name: "version", type: "text", notNull: true },
      { name: "previous_version", type: "text" },
      { name: "action", type: "text", notNull: true },
      { name: "status", type: "text", notNull: true },
      { name: "operator", type: "text" },
      { name: "timestamp", type: "text", notNull: true },
    ],
    indexes: [
      { columns: ["service_id"] },
      { columns: ["timestamp"] },
    ],
  },
  // 配置备份表
  {
    table: "config_backups",
    columns: [
      { name: "id", type: "text", primaryKey: true },
      { name: "service_id", type: "text", notNull: true },
      { name: "commands", type: "text" },
      { name: "environment", type: "text" },
      { name: "health_check", type: "text" },
      { name: "created_by", type: "text" },
      { name: "created_at", type: "text", notNull: true },
    ],
    indexes: [
      { columns: ["service_id"] },
      { columns: ["created_at"] },
    ],
  },
  // 服务模板表
  {
    table: "service_templates",
    columns: [
      { name: "id", type: "text", primaryKey: true },
      { name: "name", type: "text", notNull: true },
      { name: "description", type: "text" },
      { name: "type", type: "text", notNull: true },
      { name: "defaults", type: "text" },
      { name: "created_at", type: "text", notNull: true },
    ],
    indexes: [
      { columns: ["name"], unique: true },
      { columns: ["type"] },
    ],
  },
];

// 初始化数据库连接
export function createDatabase() {
  let conn = orm.connect(DB_DRIVER, DB_DSN);
  conn.autoMigrate(SCHEMAS);
  return conn;
}

// 单例数据库连接
let dbInstance = null;

export function getDatabase() {
  if (dbInstance === null) {
    dbInstance = createDatabase();
  }
  return dbInstance;
}

export function closeDatabase() {
  if (dbInstance !== null) {
    dbInstance.close();
    dbInstance = null;
  }
}
