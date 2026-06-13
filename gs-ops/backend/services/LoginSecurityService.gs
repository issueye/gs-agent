// 登录安全服务
import { getDatabase } from "../config/database.gs";
import { LoginSecurity, LOGIN_SECURITY_CONFIG } from "../models/LoginSecurity.gs";
import { nowIso } from "../utils/system.gs";

export class LoginSecurityService {
  constructor() {
    this.db = getDatabase();
  }

  // 获取或创建登录安全记录
  getOrCreate(username) {
    let record = this.db
      .table("login_security")
      .where("username = ?", username)
      .first();

    if (record) {
      return LoginSecurity.fromDBRecord(record);
    }

    // 创建新记录
    let security = new LoginSecurity();
    security.username = username;
    security.updatedAt = nowIso();

    this.db.table("login_security").insert(security.toDBRecord());
    return security;
  }

  // 检查账户是否被锁定
  isLocked(username) {
    let security = this.getOrCreate(username);
    return security.isLocked();
  }

  // 获取锁定剩余时间
  getLockRemainingSeconds(username) {
    let security = this.getOrCreate(username);
    return security.getLockRemainingSeconds();
  }

  // 记录登录失败
  recordFailedAttempt(username) {
    let security = this.getOrCreate(username);
    let now = nowIso();

    // 检查是否在失败计数窗口内
    let windowMinutes = LOGIN_SECURITY_CONFIG.FAILED_ATTEMPTS_WINDOW;
    let windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - windowMinutes);

    let shouldResetCount = false;
    if (security.lastFailedAt) {
      let lastFailed = new Date(security.lastFailedAt);
      if (lastFailed < windowStart) {
        // 超出窗口，重置计数
        shouldResetCount = true;
      }
    }

    if (shouldResetCount) {
      security.failedAttempts = 1;
    } else {
      security.failedAttempts += 1;
    }

    security.lastFailedAt = now;
    security.updatedAt = now;

    // 检查是否需要锁定
    if (security.failedAttempts >= LOGIN_SECURITY_CONFIG.MAX_FAILED_ATTEMPTS) {
      let lockUntil = new Date();
      lockUntil.setMinutes(
        lockUntil.getMinutes() + LOGIN_SECURITY_CONFIG.LOCK_DURATION_MINUTES
      );
      security.lockedUntil = lockUntil.toISOString();
    }

    // 更新数据库
    this.db
      .table("login_security")
      .where("username = ?", username)
      .update(security.toDBRecord());

    return security;
  }

  // 记录登录成功
  recordSuccessfulLogin(username) {
    let security = this.getOrCreate(username);
    let now = nowIso();

    // 重置失败计数和锁定
    security.failedAttempts = 0;
    security.lockedUntil = null;
    security.lastSuccessAt = now;
    security.updatedAt = now;

    // 更新数据库
    this.db
      .table("login_security")
      .where("username = ?", username)
      .update(security.toDBRecord());

    return security;
  }

  // 手动解锁账户
  unlock(username) {
    let security = this.getOrCreate(username);
    security.failedAttempts = 0;
    security.lockedUntil = null;
    security.updatedAt = nowIso();

    this.db
      .table("login_security")
      .where("username = ?", username)
      .update(security.toDBRecord());

    return security;
  }

  // 获取所有被锁定的账户
  getLockedAccounts() {
    let now = new Date().toISOString();
    let records = this.db
      .table("login_security")
      .where("locked_until IS NOT NULL")
      .where("locked_until > ?", now)
      .get();

    return records.map((r) => LoginSecurity.fromDBRecord(r));
  }

  // 清理过期的锁定记录
  cleanupExpiredLocks() {
    let now = new Date().toISOString();

    this.db
      .table("login_security")
      .where("locked_until IS NOT NULL")
      .where("locked_until <= ?", now)
      .update({
        locked_until: null,
        updated_at: nowIso(),
      });
  }
}
