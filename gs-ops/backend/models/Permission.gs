// 权限模型和常量定义

// 权限常量 - 使用资源:操作的命名约定
export const PERMISSIONS = {
  // 服务管理权限
  SERVICES_READ: "services:read",
  SERVICES_CREATE: "services:create",
  SERVICES_UPDATE: "services:update",
  SERVICES_DELETE: "services:delete",
  SERVICES_CONTROL: "services:control", // 启动/停止/重启

  // 用户管理权限
  USERS_READ: "users:read",
  USERS_CREATE: "users:create",
  USERS_UPDATE: "users:update",
  USERS_DELETE: "users:delete",
  USERS_MANAGE: "users:manage", // 包含所有用户管理权限

  // 日志管理权限
  LOGS_READ: "logs:read",
  LOGS_DELETE: "logs:delete",

  // 监控权限
  MONITOR_READ: "monitor:read",
  MONITOR_REALTIME: "monitor:realtime", // 实时监控

  // 版本管理权限
  VERSIONS_READ: "versions:read",
  VERSIONS_CREATE: "versions:create",
  VERSIONS_DELETE: "versions:delete",

  // 备份管理权限
  BACKUPS_READ: "backups:read",
  BACKUPS_CREATE: "backups:create",
  BACKUPS_RESTORE: "backups:restore",
  BACKUPS_DELETE: "backups:delete",

  // 配置管理权限
  CONFIG_READ: "config:read",
  CONFIG_UPDATE: "config:update",

  // 模板管理权限
  TEMPLATES_READ: "templates:read",
  TEMPLATES_MANAGE: "templates:manage",
};

// 角色权限映射
export const ROLE_PERMISSIONS = {
  // 管理员 - 拥有所有权限
  admin: [
    PERMISSIONS.SERVICES_READ,
    PERMISSIONS.SERVICES_CREATE,
    PERMISSIONS.SERVICES_UPDATE,
    PERMISSIONS.SERVICES_DELETE,
    PERMISSIONS.SERVICES_CONTROL,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.LOGS_READ,
    PERMISSIONS.LOGS_DELETE,
    PERMISSIONS.MONITOR_READ,
    PERMISSIONS.MONITOR_REALTIME,
    PERMISSIONS.VERSIONS_READ,
    PERMISSIONS.VERSIONS_CREATE,
    PERMISSIONS.VERSIONS_DELETE,
    PERMISSIONS.BACKUPS_READ,
    PERMISSIONS.BACKUPS_CREATE,
    PERMISSIONS.BACKUPS_RESTORE,
    PERMISSIONS.BACKUPS_DELETE,
    PERMISSIONS.CONFIG_READ,
    PERMISSIONS.CONFIG_UPDATE,
    PERMISSIONS.TEMPLATES_READ,
    PERMISSIONS.TEMPLATES_MANAGE,
  ],

  // 操作员 - 可以管理服务、查看日志、监控
  operator: [
    PERMISSIONS.SERVICES_READ,
    PERMISSIONS.SERVICES_CREATE,
    PERMISSIONS.SERVICES_UPDATE,
    PERMISSIONS.SERVICES_DELETE,
    PERMISSIONS.SERVICES_CONTROL,
    PERMISSIONS.LOGS_READ,
    PERMISSIONS.MONITOR_READ,
    PERMISSIONS.MONITOR_REALTIME,
    PERMISSIONS.VERSIONS_READ,
    PERMISSIONS.BACKUPS_READ,
    PERMISSIONS.BACKUPS_CREATE,
    PERMISSIONS.CONFIG_READ,
    PERMISSIONS.TEMPLATES_READ,
  ],

  // 查看者 - 只读权限
  viewer: [
    PERMISSIONS.SERVICES_READ,
    PERMISSIONS.LOGS_READ,
    PERMISSIONS.MONITOR_READ,
    PERMISSIONS.VERSIONS_READ,
    PERMISSIONS.BACKUPS_READ,
    PERMISSIONS.CONFIG_READ,
    PERMISSIONS.TEMPLATES_READ,
  ],
};

// 检查角色是否拥有某个权限
export function hasPermission(role, permission) {
  let permissions = ROLE_PERMISSIONS[role];
  if (!permissions) {
    return false;
  }
  return permissions.includes(permission);
}

// 检查角色是否拥有某些权限中的任意一个（OR逻辑）
export function hasAnyPermission(role, permissions) {
  if (!Array.isArray(permissions)) {
    permissions = [permissions];
  }
  return permissions.some((permission) => hasPermission(role, permission));
}

// 检查角色是否拥有所有指定权限（AND逻辑）
export function hasAllPermissions(role, permissions) {
  if (!Array.isArray(permissions)) {
    permissions = [permissions];
  }
  return permissions.every((permission) => hasPermission(role, permission));
}

// 获取角色的所有权限
export function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}
