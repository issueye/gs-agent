import { requireRole, requirePermission, requireAnyPermission } from "../middlewares/auth.gs";
import { PERMISSIONS } from "../models/Permission.gs";

export function registerApiRoutes(app, controllers) {
  let serviceController = controllers.serviceController;
  let monitorController = controllers.monitorController;
  let logController = controllers.logController;
  let configController = controllers.configController;
  let versionController = controllers.versionController;
  let actionController = controllers.actionController;
  let authController = controllers.authController;
  let userController = controllers.userController;

  // 公开路由（不需要认证）
  app.get("/api/health", (req, res) => configController.health(req, res));

  // 认证路由（需要登录但不检查权限）
  app.post("/api/auth/login", (req, res) => authController.login(req, res));
  app.post("/api/auth/logout", (req, res) => authController.logout(req, res));
  app.post("/api/auth/refresh", (req, res) => authController.refresh(req, res));
  app.get("/api/auth/me", (req, res) => authController.me(req, res));
  app.put("/api/auth/password", (req, res) => authController.changePassword(req, res));
  app.get("/api/auth/permissions", (req, res) => authController.permissions(req, res));

  // 用户管理路由（需要用户管理权限）
  app.get("/api/users", requirePermission(PERMISSIONS.USERS_MANAGE), (req, res) => userController.list(req, res));
  app.get("/api/users/:id", requirePermission(PERMISSIONS.USERS_MANAGE), (req, res) => userController.get(req, res));
  app.post("/api/users", requirePermission(PERMISSIONS.USERS_MANAGE), (req, res) => userController.create(req, res));
  app.put("/api/users/:id", requirePermission(PERMISSIONS.USERS_MANAGE), (req, res) => userController.update(req, res));
  app.delete("/api/users/:id", requirePermission(PERMISSIONS.USERS_MANAGE), (req, res) => userController.delete(req, res));
  app.put("/api/users/:id/password", requirePermission(PERMISSIONS.USERS_MANAGE), (req, res) => userController.resetPassword(req, res));

  // 服务管理路由
  // 查看服务列表和详情
  app.get("/api/service-templates", requirePermission(PERMISSIONS.TEMPLATES_READ), (req, res) => serviceController.templates(req, res));
  app.get("/api/services", requirePermission(PERMISSIONS.SERVICES_READ), (req, res) => serviceController.index(req, res));
  app.get("/api/services/:id", requirePermission(PERMISSIONS.SERVICES_READ), (req, res) => serviceController.show(req, res));
  app.get("/api/services/:id/status", requirePermission(PERMISSIONS.SERVICES_READ), (req, res) => serviceController.status(req, res));

  // 创建和删除服务
  app.post("/api/services", requirePermission(PERMISSIONS.SERVICES_CREATE), (req, res) => serviceController.create(req, res));

  // 服务控制操作（启动/停止/重启）
  app.post("/api/services/:id/install", requirePermission(PERMISSIONS.SERVICES_CONTROL), (req, res) => serviceController.lifecycle("install", req, res));
  app.post("/api/services/:id/start", requirePermission(PERMISSIONS.SERVICES_CONTROL), (req, res) => serviceController.lifecycle("start", req, res));
  app.post("/api/services/:id/stop", requirePermission(PERMISSIONS.SERVICES_CONTROL), (req, res) => serviceController.lifecycle("stop", req, res));
  app.post("/api/services/:id/restart", requirePermission(PERMISSIONS.SERVICES_CONTROL), (req, res) => serviceController.lifecycle("restart", req, res));
  app.delete("/api/services/:id/uninstall", requirePermission(PERMISSIONS.SERVICES_DELETE), (req, res) => serviceController.lifecycle("uninstall", req, res));

  // GET 方式的操作（兼容旧版前端）
  app.get("/api/services/:id/actions/install", requirePermission(PERMISSIONS.SERVICES_CONTROL), (req, res) => serviceController.lifecycle("install", req, res));
  app.get("/api/services/:id/actions/start", requirePermission(PERMISSIONS.SERVICES_CONTROL), (req, res) => serviceController.lifecycle("start", req, res));
  app.get("/api/services/:id/actions/stop", requirePermission(PERMISSIONS.SERVICES_CONTROL), (req, res) => serviceController.lifecycle("stop", req, res));
  app.get("/api/services/:id/actions/restart", requirePermission(PERMISSIONS.SERVICES_CONTROL), (req, res) => serviceController.lifecycle("restart", req, res));

  // 配置管理
  app.put("/api/services/:id/config", requirePermission(PERMISSIONS.CONFIG_UPDATE), (req, res) => serviceController.updateConfig(req, res));
  app.get("/api/services/:id/config/backups", requirePermission(PERMISSIONS.BACKUPS_READ), (req, res) => serviceController.backups(req, res));
  app.post("/api/services/:id/config/backups", requirePermission(PERMISSIONS.BACKUPS_CREATE), (req, res) => serviceController.backupConfig(req, res));
  app.get("/api/services/:id/config/actions/backup", requirePermission(PERMISSIONS.BACKUPS_CREATE), (req, res) => serviceController.backupConfig(req, res));
  app.post("/api/services/:id/config/backups/:backupId/restore", requirePermission(PERMISSIONS.BACKUPS_RESTORE), (req, res) => serviceController.restoreConfig(req, res));
  app.get("/api/services/:id/config/backups/:backupId/actions/restore", requirePermission(PERMISSIONS.BACKUPS_RESTORE), (req, res) => serviceController.restoreConfig(req, res));

  // 监控和日志
  app.get("/api/services/:id/metrics", requirePermission(PERMISSIONS.MONITOR_READ), (req, res) => monitorController.metrics(req, res));
  app.get("/api/services/:id/logs", requirePermission(PERMISSIONS.LOGS_READ), (req, res) => logController.index(req, res));
  app.delete("/api/services/:id/logs", requirePermission(PERMISSIONS.LOGS_DELETE), (req, res) => logController.clear(req, res));

  // 版本管理
  app.get("/api/services/:id/versions", requirePermission(PERMISSIONS.VERSIONS_READ), (req, res) => versionController.index(req, res));
  app.post("/api/services/:id/upgrade", requirePermission(PERMISSIONS.SERVICES_UPDATE), (req, res) => versionController.upgradeService(req, res));
  app.post("/api/services/:id/rollback", requirePermission(PERMISSIONS.SERVICES_UPDATE), (req, res) => versionController.rollbackService(req, res));
  app.get("/api/services/:id/actions/upgrade", requirePermission(PERMISSIONS.SERVICES_UPDATE), (req, res) => versionController.upgradeService(req, res));
  app.get("/api/services/:id/actions/rollback", requirePermission(PERMISSIONS.SERVICES_UPDATE), (req, res) => versionController.rollbackService(req, res));

  // 通用操作路由（兼容旧版）
  app.get("/api/actions/:action/:id", (req, res) => actionController.run(req, res));
  app.get("/api/actions/restore-config/:id/:backupId", requirePermission(PERMISSIONS.BACKUPS_RESTORE), (req, res) => actionController.restoreConfig(req, res));
}
