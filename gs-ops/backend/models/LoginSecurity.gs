// 登录安全模型
import { nowIso } from "../utils/system.gs";

export class LoginSecurity {
  constructor() {
    this.username = "";
    this.failedAttempts = 0;     // 失败次数
    this.lockedUntil = null;     // 锁定到期时间
    this.lastFailedAt = null;    // 最后失败时间
    this.lastSuccessAt = null;   // 最后成功时间
    this.updatedAt = "";
  }

  toDBRecord() {
    return {
      username: this.username,
      failed_attempts: this.failedAttempts,
      locked_until: this.lockedUntil,
      last_failed_at: this.lastFailedAt,
      last_success_at: this.lastSuccessAt,
      updated_at: this.updatedAt,
    };
  }

  static fromDBRecord(record) {
    let security = new LoginSecurity();
    security.username = record.username;
    security.failedAttempts = record.failed_attempts || 0;
    security.lockedUntil = record.locked_until;
    security.lastFailedAt = record.last_failed_at;
    security.lastSuccessAt = record.last_success_at;
    security.updatedAt = record.updated_at;
    return security;
  }

  // 检查是否被锁定
  isLocked() {
    if (!this.lockedUntil) {
      return false;
    }
    let now = new Date();
    let lockExpiry = new Date(this.lockedUntil);
    return now < lockExpiry;
  }

  // 获取锁定剩余时间（秒）
  getLockRemainingSeconds() {
    if (!this.isLocked()) {
      return 0;
    }
    let now = new Date();
    let lockExpiry = new Date(this.lockedUntil);
    return Math.ceil((lockExpiry - now) / 1000);
  }
}

// 创建登录安全表的 SQL
export function createLoginSecurityTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS login_security (
      username TEXT PRIMARY KEY,
      failed_attempts INTEGER DEFAULT 0,
      locked_until TEXT,
      last_failed_at TEXT,
      last_success_at TEXT,
      updated_at TEXT NOT NULL
    )
  `);
}

// 登录安全配置
export const LOGIN_SECURITY_CONFIG = {
  MAX_FAILED_ATTEMPTS: 5,        // 最大失败次数
  LOCK_DURATION_MINUTES: 15,     // 锁定时长（分钟）
  FAILED_ATTEMPTS_WINDOW: 30,    // 失败计数窗口（分钟）
};
