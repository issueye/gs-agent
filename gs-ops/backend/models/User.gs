// 用户模型
import { nowIso } from "../utils/system.gs";

export class User {
  constructor() {
    this.id = "";
    this.username = "";
    this.passwordHash = "";
    this.role = "viewer"; // admin, operator, viewer
    this.email = "";
    this.displayName = "";
    this.enabled = true;
    this.lastLoginAt = null;
    this.createdAt = "";
    this.updatedAt = "";
  }

  // 转换为 JSON 对象
  toJSON() {
    return {
      id: this.id,
      username: this.username,
      role: this.role,
      email: this.email,
      displayName: this.displayName,
      enabled: this.enabled,
      lastLoginAt: this.lastLoginAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      // 注意: 不返回 passwordHash
    };
  }

  // 转换为数据库记录
  toDBRecord() {
    return {
      id: this.id,
      username: this.username,
      password_hash: this.passwordHash,
      role: this.role,
      email: this.email || null,
      display_name: this.displayName || null,
      enabled: this.enabled ? 1 : 0,
      last_login_at: this.lastLoginAt || null,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    };
  }

  // 从数据库记录创建用户对象
  static fromDBRecord(record) {
    let user = new User();
    user.id = record.id;
    user.username = record.username;
    user.passwordHash = record.password_hash;
    user.role = record.role;
    user.email = record.email || "";
    user.displayName = record.display_name || "";
    user.enabled = record.enabled === 1;
    user.lastLoginAt = record.last_login_at || null;
    user.createdAt = record.created_at;
    user.updatedAt = record.updated_at;
    return user;
  }

  // 检查角色权限
  hasRole(roles) {
    if (typeof roles === "string") {
      return this.role === roles;
    }
    if (Array.isArray(roles)) {
      return roles.includes(this.role);
    }
    return false;
  }

  // 是否是管理员
  isAdmin() {
    return this.role === "admin";
  }

  // 是否可以操作
  canOperate() {
    return this.role === "admin" || this.role === "operator";
  }

  // 是否只读
  isViewer() {
    return this.role === "viewer";
  }
}

// 角色定义
export const ROLES = {
  ADMIN: "admin",       // 管理员 - 所有权限
  OPERATOR: "operator", // 操作员 - 服务管理权限
  VIEWER: "viewer",     // 查看者 - 只读权限
};

// 角色权限映射
export const ROLE_PERMISSIONS = {
  admin: [
    "service:read",
    "service:write",
    "service:manage",
    "user:read",
    "user:write",
    "config:read",
    "config:write",
    "log:read",
  ],
  operator: [
    "service:read",
    "service:write",
    "service:manage",
    "config:read",
    "log:read",
  ],
  viewer: [
    "service:read",
    "config:read",
    "log:read",
  ],
};

// 检查角色是否有权限
export function hasPermission(role, permission) {
  let permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}
