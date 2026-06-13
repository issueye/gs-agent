// 认证控制器
import { BaseController } from "./BaseController.gs";
import { generateAccessToken, generateRefreshToken, verifyToken } from "../utils/jwt.gs";
import { fail } from "../utils/response.gs";
import { getRolePermissions } from "../models/Permission.gs";
import { LoginSecurityService } from "../services/LoginSecurityService.gs";
import { AuditLogService } from "../services/AuditLogService.gs";

export class AuthController extends BaseController {
  constructor(userManager) {
    super();
    this.userManager = userManager;
    this.loginSecurityService = new LoginSecurityService();
    this.auditLogService = new AuditLogService();
  }

  // 获取客户端IP
  getClientIp(req) {
    return req.headers["x-forwarded-for"] ||
           req.headers["x-real-ip"] ||
           "unknown";
  }

  // 获取 User-Agent
  getUserAgent(req) {
    return req.headers["user-agent"] || "";
  }

  // 用户登录
  login(req, res) {
    let username = "";
    let ip = this.getClientIp(req);
    let userAgent = this.getUserAgent(req);

    try {
      let body = req.body;
      username = body.username;
      let password = body.password;

      // 验证输入
      if (!username || !password) {
        return this.badRequest(res, "用户名和密码不能为空");
      }

      // 检查账户是否被锁定
      if (this.loginSecurityService.isLocked(username)) {
        let remainingSeconds = this.loginSecurityService.getLockRemainingSeconds(username);
        let remainingMinutes = Math.ceil(remainingSeconds / 60);

        // 记录审计日志
        this.auditLogService.logLoginFailed(
          username,
          ip,
          userAgent,
          `账户已锁定，剩余${remainingMinutes}分钟`
        );

        return fail(res, 403, `账户已被锁定，请在 ${remainingMinutes} 分钟后重试`);
      }

      // 认证用户
      let user = this.userManager.authenticate(username, password);
      if (user === null) {
        // 记录失败尝试
        this.loginSecurityService.recordFailedAttempt(username);

        // 检查是否被锁定
        if (this.loginSecurityService.isLocked(username)) {
          let remainingSeconds = this.loginSecurityService.getLockRemainingSeconds(username);
          let remainingMinutes = Math.ceil(remainingSeconds / 60);

          // 记录账户锁定事件
          this.auditLogService.logAccountLocked(
            username,
            ip,
            `连续登录失败${this.loginSecurityService.getOrCreate(username).failedAttempts}次`
          );

          return fail(res, 403, `登录失败次数过多，账户已被锁定 ${remainingMinutes} 分钟`);
        }

        // 记录登录失败
        this.auditLogService.logLoginFailed(username, ip, userAgent, "用户名或密码错误");

        return this.badRequest(res, "用户名或密码错误");
      }

      // 检查账户是否启用
      if (!user.enabled) {
        this.auditLogService.logLoginFailed(username, ip, userAgent, "账户已禁用");
        return fail(res, 403, "账户已被禁用");
      }

      // 登录成功，重置失败计数
      this.loginSecurityService.recordSuccessfulLogin(username);

      // 更新最后登录时间
      this.userManager.updateLastLogin(user.id);

      // 生成 Token
      let accessToken = generateAccessToken(user);
      let refreshToken = generateRefreshToken(user);

      // 记录登录成功
      this.auditLogService.logLoginSuccess(username, user.id, ip, userAgent);

      return this.ok(res, {
        user: user.toJSON(),
        accessToken: accessToken,
        refreshToken: refreshToken,
        expiresIn: 86400, // 24小时
      }, "登录成功");
    } catch (e) {
      console.error("Login error:", e);

      // 记录登录失败
      if (username) {
        this.auditLogService.logLoginFailed(username, ip, userAgent, String(e));
      }

      return this.badRequest(res, "登录失败: " + String(e));
    }
  }

  // 用户登出
  logout(req, res) {
    try {
      let currentUser = req.user;
      if (currentUser) {
        let ip = this.getClientIp(req);
        this.auditLogService.logLogout(currentUser.username, currentUser.userId, ip);
      }

      return this.ok(res, null, "登出成功");
    } catch (e) {
      console.error("Logout error:", e);
      return this.ok(res, null, "登出成功");
    }
  }

  // 刷新 Token
  refresh(req, res) {
    try {
      let body = req.body;
      let refreshToken = body.refreshToken;

      if (!refreshToken) {
        return this.badRequest(res, "Refresh token 不能为空");
      }

      // 验证 Refresh Token
      let result = verifyToken(refreshToken);
      if (!result.valid) {
        return this.badRequest(res, "无效的 refresh token");
      }

      // 检查 token 类型
      if (result.payload.type !== "refresh") {
        return this.badRequest(res, "无效的 refresh token");
      }

      // 查找用户
      let user = this.userManager.find(result.payload.userId);
      if (user === null) {
        return this.badRequest(res, "用户不存在");
      }

      // 生成新的 Access Token
      let accessToken = generateAccessToken(user);

      return this.ok(res, {
        accessToken: accessToken,
        expiresIn: 86400,
      }, "Token 刷新成功");
    } catch (e) {
      console.error("Refresh token error:", e);
      return this.badRequest(res, "Token 刷新失败: " + String(e));
    }
  }

  // 获取当前用户信息
  me(req, res) {
    try {
      // 从 req 中获取当前用户（由认证中间件设置）
      let currentUser = req.user;
      if (!currentUser) {
        return fail(res, 401, "未登录");
      }

      return this.ok(res, currentUser, "获取用户信息成功");
    } catch (e) {
      console.error("Get current user error:", e);
      return this.badRequest(res, "获取用户信息失败: " + String(e));
    }
  }

  // 修改当前用户密码
  changePassword(req, res) {
    try {
      let currentUser = req.user;
      if (!currentUser) {
        return fail(res, 401, "未登录");
      }

      let body = req.body;
      let oldPassword = body.oldPassword;
      let newPassword = body.newPassword;

      if (!oldPassword || !newPassword) {
        return this.badRequest(res, "旧密码和新密码不能为空");
      }

      // 修改密码
      this.userManager.changePassword(currentUser.userId, oldPassword, newPassword);

      // 记录审计日志
      let ip = this.getClientIp(req);
      this.auditLogService.logPasswordChange(
        currentUser.username,
        currentUser.userId,
        ip
      );

      return this.ok(res, null, "密码修改成功");
    } catch (e) {
      console.error("Change password error:", e);
      return this.badRequest(res, "密码修改失败: " + String(e));
    }
  }

  // 获取当前用户的权限列表
  permissions(req, res) {
    try {
      let currentUser = req.user;
      if (!currentUser) {
        return fail(res, 401, "未登录");
      }

      let permissions = getRolePermissions(currentUser.role);

      return this.ok(res, {
        role: currentUser.role,
        permissions: permissions,
      }, "获取权限列表成功");
    } catch (e) {
      console.error("Get permissions error:", e);
      return this.badRequest(res, "获取权限列表失败: " + String(e));
    }
  }
}
