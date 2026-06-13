// 用户管理控制器
import { BaseController } from "./BaseController.gs";
import { ROLES } from "../models/User.gs";
import { AuditLogService } from "../services/AuditLogService.gs";

export class UserController extends BaseController {
  constructor(userManager) {
    super();
    this.userManager = userManager;
    this.auditLogService = new AuditLogService();
  }

  // 获取客户端IP
  getClientIp(req) {
    return req.headers["x-forwarded-for"] ||
           req.headers["x-real-ip"] ||
           "unknown";
  }

  // 获取用户列表（仅管理员）
  list(req, res) {
    try {
      let users = this.userManager.list();
      return this.ok(res, users, "获取用户列表成功");
    } catch (e) {
      console.error("List users error:", e);
      return this.badRequest(res, "获取用户列表失败: " + String(e));
    }
  }

  // 获取用户详情
  get(req, res) {
    try {
      let id = req.param("id");
      let user = this.userManager.find(id);

      if (user === null) {
        return this.notFound(res, "用户不存在");
      }

      return this.ok(res, user.toJSON(), "获取用户信息成功");
    } catch (e) {
      console.error("Get user error:", e);
      return this.badRequest(res, "获取用户信息失败: " + String(e));
    }
  }

  // 创建用户（仅管理员）
  create(req, res) {
    try {
      let body = req.body;
      let currentUser = req.user;
      let ip = this.getClientIp(req);

      // 验证必填字段
      if (!body.username || !body.password) {
        return this.badRequest(res, "用户名和密码不能为空");
      }

      // 验证角色
      if (body.role && ![ROLES.ADMIN, ROLES.OPERATOR, ROLES.VIEWER].includes(body.role)) {
        return this.badRequest(res, "无效的角色");
      }

      let user = this.userManager.create(body);

      // 记录审计日志
      this.auditLogService.logUserCreate(
        currentUser.username,
        currentUser.userId,
        user.username,
        ip
      );

      return this.created(res, user, "创建用户成功");
    } catch (e) {
      console.error("Create user error:", e);
      return this.badRequest(res, "创建用户失败: " + String(e));
    }
  }

  // 更新用户（仅管理员）
  update(req, res) {
    try {
      let id = req.param("id");
      let body = req.body;
      let currentUser = req.user;
      let ip = this.getClientIp(req);

      // 不能通过这个接口修改密码
      if (body.password) {
        return this.badRequest(res, "请使用修改密码接口");
      }

      // 获取旧的用户信息
      let oldUser = this.userManager.find(id);
      if (!oldUser) {
        return this.notFound(res, "用户不存在");
      }

      let user = this.userManager.update(id, body);

      // 记录审计日志
      this.auditLogService.logUserUpdate(
        currentUser.username,
        currentUser.userId,
        user.username,
        ip,
        {
          role: body.role,
          enabled: body.enabled,
          displayName: body.displayName,
        }
      );

      return this.ok(res, user, "更新用户成功");
    } catch (e) {
      console.error("Update user error:", e);
      return this.badRequest(res, "更新用户失败: " + String(e));
    }
  }

  // 删除用户（仅管理员）
  delete(req, res) {
    try {
      let id = req.param("id");
      let currentUser = req.user;
      let ip = this.getClientIp(req);

      // 不能删除自己
      if (currentUser && currentUser.userId === id) {
        return this.badRequest(res, "不能删除当前登录用户");
      }

      // 获取要删除的用户信息
      let targetUser = this.userManager.find(id);
      if (!targetUser) {
        return this.notFound(res, "用户不存在");
      }

      this.userManager.delete(id);

      // 记录审计日志
      this.auditLogService.logUserDelete(
        currentUser.username,
        currentUser.userId,
        targetUser.username,
        ip
      );

      return this.ok(res, null, "删除用户成功");
    } catch (e) {
      console.error("Delete user error:", e);
      return this.badRequest(res, "删除用户失败: " + String(e));
    }
  }

  // 重置用户密码（仅管理员）
  resetPassword(req, res) {
    try {
      let id = req.param("id");
      let body = req.body;
      let currentUser = req.user;
      let ip = this.getClientIp(req);

      if (!body.newPassword) {
        return this.badRequest(res, "新密码不能为空");
      }

      // 获取目标用户信息
      let targetUser = this.userManager.find(id);
      if (!targetUser) {
        return this.notFound(res, "用户不存在");
      }

      this.userManager.resetPassword(id, body.newPassword);

      // 记录审计日志
      this.auditLogService.logPasswordReset(
        currentUser.username,
        currentUser.userId,
        targetUser.username,
        ip
      );

      return this.ok(res, null, "重置密码成功");
    } catch (e) {
      console.error("Reset password error:", e);
      return this.badRequest(res, "重置密码失败: " + String(e));
    }
  }
}
