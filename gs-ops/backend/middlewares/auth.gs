// 认证中间件
import { extractToken, verifyToken } from "../utils/jwt.gs";
import { fail } from "../utils/response.gs";
import { hasPermission, hasAnyPermission, hasAllPermissions } from "../models/Permission.gs";

// 白名单路由（不需要认证）
const PUBLIC_ROUTES = [
  "/api/auth/login",
  "/api/health",
];

// 检查是否是公开路由
function isPublicRoute(path) {
  return PUBLIC_ROUTES.some((route) => path === route || path.startsWith(route));
}

// 认证中间件
export function auth(req, res, next) {
  try {
    // 检查是否是公开路由
    let path = req.path || req.url || "";
    if (isPublicRoute(path)) {
      return next();
    }

    // 提取 Token
    let token = extractToken(req);
    if (!token) {
      return fail(res, 401, "未提供认证令牌");
    }

    // 验证 Token
    let result = verifyToken(token);
    if (!result.valid) {
      if (result.error === "Token expired") {
        return fail(res, 401, "认证令牌已过期");
      }
      return fail(res, 401, "无效的认证令牌");
    }

    // 将用户信息附加到请求对象
    req.user = result.payload;

    return next();
  } catch (e) {
    console.error("Auth middleware error:", e);
    return fail(res, 500, "认证过程出错: " + String(e));
  }
}

// 权限中间件工厂函数 - 检查角色
export function requireRole(...roles) {
  return function(req, res, next) {
    // 检查用户是否已认证
    if (!req.user) {
      return fail(res, 401, "未登录");
    }

    // 检查用户角色
    let userRole = req.user.role;

    if (!roles.includes(userRole)) {
      return fail(res, 403, "权限不足：需要角色 " + roles.join(" 或 "));
    }

    return next();
  };
}

// 权限检查中间件工厂函数 - 检查具体权限（AND逻辑）
export function requirePermission(...permissions) {
  return function(req, res, next) {
    // 检查用户是否已认证
    if (!req.user) {
      return fail(res, 401, "未登录");
    }

    let userRole = req.user.role;

    // 管理员拥有所有权限
    if (userRole === "admin") {
      return next();
    }

    // 检查用户是否拥有所有指定的权限
    if (!hasAllPermissions(userRole, permissions)) {
      return fail(res, 403, "权限不足：缺少必要权限");
    }

    return next();
  };
}

// 权限检查中间件工厂函数 - 检查任一权限（OR逻辑）
export function requireAnyPermission(...permissions) {
  return function(req, res, next) {
    // 检查用户是否已认证
    if (!req.user) {
      return fail(res, 401, "未登录");
    }

    let userRole = req.user.role;

    // 管理员拥有所有权限
    if (userRole === "admin") {
      return next();
    }

    // 检查用户是否拥有任一指定的权限
    if (!hasAnyPermission(userRole, permissions)) {
      return fail(res, 403, "权限不足：缺少必要权限");
    }

    return next();
  };
}

