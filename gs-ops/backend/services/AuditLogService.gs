// 审计日志服务
import { getDatabase } from "../config/database.gs";
import { AuditLog, AUDIT_TYPES, AUDIT_ACTIONS } from "../models/AuditLog.gs";

export class AuditLogService {
  constructor() {
    this.db = getDatabase();
  }

  // 记录审计日志
  log(type, action, options = {}) {
    try {
      let auditLog = AuditLog.create(type, action, options);
      this.db.table("audit_logs").insert(auditLog.toDBRecord());
      return auditLog;
    } catch (error) {
      console.error("Failed to create audit log:", error);
      return null;
    }
  }

  // 记录登录成功
  logLoginSuccess(username, userId, ip, userAgent) {
    return this.log(AUDIT_TYPES.AUTH, AUDIT_ACTIONS.LOGIN, {
      username,
      userId,
      ip,
      userAgent,
      success: true,
    });
  }

  // 记录登录失败
  logLoginFailed(username, ip, userAgent, reason) {
    return this.log(AUDIT_TYPES.AUTH, AUDIT_ACTIONS.LOGIN_FAILED, {
      username,
      ip,
      userAgent,
      success: false,
      errorMessage: reason,
    });
  }

  // 记录登出
  logLogout(username, userId, ip) {
    return this.log(AUDIT_TYPES.AUTH, AUDIT_ACTIONS.LOGOUT, {
      username,
      userId,
      ip,
    });
  }

  // 记录密码修改
  logPasswordChange(username, userId, ip) {
    return this.log(AUDIT_TYPES.AUTH, AUDIT_ACTIONS.PASSWORD_CHANGE, {
      username,
      userId,
      ip,
    });
  }

  // 记录用户创建
  logUserCreate(operatorUsername, operatorId, targetUsername, ip) {
    return this.log(AUDIT_TYPES.USER, AUDIT_ACTIONS.USER_CREATE, {
      username: operatorUsername,
      userId: operatorId,
      ip,
      resource: targetUsername,
    });
  }

  // 记录用户更新
  logUserUpdate(operatorUsername, operatorId, targetUsername, ip, details) {
    return this.log(AUDIT_TYPES.USER, AUDIT_ACTIONS.USER_UPDATE, {
      username: operatorUsername,
      userId: operatorId,
      ip,
      resource: targetUsername,
      details,
    });
  }

  // 记录用户删除
  logUserDelete(operatorUsername, operatorId, targetUsername, ip) {
    return this.log(AUDIT_TYPES.USER, AUDIT_ACTIONS.USER_DELETE, {
      username: operatorUsername,
      userId: operatorId,
      ip,
      resource: targetUsername,
    });
  }

  // 记录密码重置
  logPasswordReset(operatorUsername, operatorId, targetUsername, ip) {
    return this.log(AUDIT_TYPES.USER, AUDIT_ACTIONS.USER_PASSWORD_RESET, {
      username: operatorUsername,
      userId: operatorId,
      ip,
      resource: targetUsername,
    });
  }

  // 记录账户锁定
  logAccountLocked(username, ip, reason) {
    return this.log(AUDIT_TYPES.SECURITY, AUDIT_ACTIONS.ACCOUNT_LOCKED, {
      username,
      ip,
      errorMessage: reason,
    });
  }

  // 记录频率限制触发
  logRateLimitExceeded(username, ip, endpoint) {
    return this.log(AUDIT_TYPES.SECURITY, AUDIT_ACTIONS.RATE_LIMIT_EXCEEDED, {
      username,
      ip,
      resource: endpoint,
    });
  }

  // 查询审计日志
  query(options = {}) {
    let query = this.db.table("audit_logs");

    if (options.type) {
      query = query.where("type = ?", options.type);
    }

    if (options.action) {
      query = query.where("action = ?", options.action);
    }

    if (options.userId) {
      query = query.where("user_id = ?", options.userId);
    }

    if (options.username) {
      query = query.where("username = ?", options.username);
    }

    if (options.startDate) {
      query = query.where("created_at >= ?", options.startDate);
    }

    if (options.endDate) {
      query = query.where("created_at <= ?", options.endDate);
    }

    // 排序
    query = query.orderBy("created_at DESC");

    // 分页
    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    let records = query.get();
    return records.map((r) => AuditLog.fromDBRecord(r));
  }

  // 获取审计日志数量
  count(options = {}) {
    let query = this.db.table("audit_logs");

    if (options.type) {
      query = query.where("type = ?", options.type);
    }

    if (options.action) {
      query = query.where("action = ?", options.action);
    }

    if (options.userId) {
      query = query.where("user_id = ?", options.userId);
    }

    return query.count();
  }

  // 清理旧日志（保留最近N天）
  cleanup(daysToKeep = 90) {
    let cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    let cutoffDateStr = cutoffDate.toISOString();

    let deleted = this.db
      .table("audit_logs")
      .where("created_at < ?", cutoffDateStr)
      .delete();

    return deleted;
  }
}
