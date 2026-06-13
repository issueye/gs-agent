// 审计日志模型
import { nowIso } from "../utils/system.gs";

// 审计日志类型
export const AUDIT_TYPES = {
  AUTH: "auth",           // 认证相关
  USER: "user",           // 用户管理
  SERVICE: "service",     // 服务管理
  CONFIG: "config",       // 配置管理
  SECURITY: "security",   // 安全事件
};

// 审计操作
export const AUDIT_ACTIONS = {
  // 认证
  LOGIN: "login",
  LOGOUT: "logout",
  LOGIN_FAILED: "login_failed",
  TOKEN_REFRESH: "token_refresh",
  PASSWORD_CHANGE: "password_change",

  // 用户管理
  USER_CREATE: "user_create",
  USER_UPDATE: "user_update",
  USER_DELETE: "user_delete",
  USER_PASSWORD_RESET: "user_password_reset",

  // 服务管理
  SERVICE_CREATE: "service_create",
  SERVICE_START: "service_start",
  SERVICE_STOP: "service_stop",
  SERVICE_RESTART: "service_restart",
  SERVICE_DELETE: "service_delete",

  // 配置管理
  CONFIG_UPDATE: "config_update",
  CONFIG_BACKUP: "config_backup",
  CONFIG_RESTORE: "config_restore",

  // 安全事件
  ACCOUNT_LOCKED: "account_locked",
  SUSPICIOUS_LOGIN: "suspicious_login",
  RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",
};

export class AuditLog {
  constructor() {
    this.id = "";
    this.type = "";           // 日志类型
    this.action = "";         // 操作动作
    this.userId = "";         // 操作用户ID
    this.username = "";       // 操作用户名
    this.ip = "";             // 客户端IP
    this.userAgent = "";      // User-Agent
    this.resource = "";       // 资源（如服务ID、用户ID等）
    this.details = "";        // 详细信息（JSON字符串）
    this.success = true;      // 是否成功
    this.errorMessage = "";   // 错误信息
    this.createdAt = "";
  }

  toDBRecord() {
    return {
      id: this.id,
      type: this.type,
      action: this.action,
      user_id: this.userId,
      username: this.username,
      ip: this.ip,
      user_agent: this.userAgent,
      resource: this.resource,
      details: this.details,
      success: this.success ? 1 : 0,
      error_message: this.errorMessage,
      created_at: this.createdAt,
    };
  }

  static fromDBRecord(record) {
    let log = new AuditLog();
    log.id = record.id;
    log.type = record.type;
    log.action = record.action;
    log.userId = record.user_id || "";
    log.username = record.username || "";
    log.ip = record.ip || "";
    log.userAgent = record.user_agent || "";
    log.resource = record.resource || "";
    log.details = record.details || "";
    log.success = record.success === 1;
    log.errorMessage = record.error_message || "";
    log.createdAt = record.created_at;
    return log;
  }

  // 生成日志ID
  static generateId() {
    return "audit-" + String(Date.now()) + "-" + String(Math.floor(Math.random() * 1000));
  }

  // 创建审计日志
  static create(type, action, options = {}) {
    let log = new AuditLog();
    log.id = AuditLog.generateId();
    log.type = type;
    log.action = action;
    log.userId = options.userId || "";
    log.username = options.username || "";
    log.ip = options.ip || "";
    log.userAgent = options.userAgent || "";
    log.resource = options.resource || "";
    log.details = options.details ? JSON.stringify(options.details) : "";
    log.success = options.success !== undefined ? options.success : true;
    log.errorMessage = options.errorMessage || "";
    log.createdAt = nowIso();
    return log;
  }
}

// 创建审计日志表的 SQL
export function createAuditLogTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      action TEXT NOT NULL,
      user_id TEXT,
      username TEXT,
      ip TEXT,
      user_agent TEXT,
      resource TEXT,
      details TEXT,
      success INTEGER DEFAULT 1,
      error_message TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // 创建索引
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_type ON audit_logs(type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)`);
}
