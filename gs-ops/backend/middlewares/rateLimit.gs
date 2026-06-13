// 速率限制中间件
import { fail } from "../utils/response.gs";

// 速率限制存储（内存）
const rateLimitStore = new Map();

// 上次清理时间（初始为0，首次请求时初始化）
let lastCleanup = 0;

// 速率限制配置（注意：GTS 不支持对象字面量中的算术表达式，需预先计算）
const RATE_LIMIT_CONFIG = {
  // 登录接口：每分钟最多5次
  "/api/auth/login": {
    windowMs: 60000,  // 1分钟 = 60 * 1000
    maxRequests: 5,
  },
  // 其他认证接口：每分钟最多10次
  "/api/auth/*": {
    windowMs: 60000,
    maxRequests: 10,
  },
  // 用户管理接口：每分钟最多20次
  "/api/users": {
    windowMs: 60000,
    maxRequests: 20,
  },
  // 默认限制：每分钟最多60次
  default: {
    windowMs: 60000,
    maxRequests: 60,
  },
};

// 惰性清理过期记录（每分钟最多执行一次）
function cleanupExpiredRecords() {
  let now = Date.now();
  // 限制清理频率，避免每次请求都清理
  if (now - lastCleanup < 60000) {
    return;
  }
  lastCleanup = now;

  // GTS 的 Map 不支持 keys()，使用 forEach 遍历
  let keysToDelete = [];
  rateLimitStore.forEach(function(data, key) {
    if (now > data.resetAt) {
      keysToDelete.push(key);
    }
  });

  for (let i = 0; i < keysToDelete.length; i++) {
    rateLimitStore.delete(keysToDelete[i]);
  }
}

// 获取客户端标识（IP + User-Agent）
function getClientIdentifier(req) {
  let ip = req.headers["x-forwarded-for"] ||
           req.headers["x-real-ip"] ||
           "unknown";
  let userAgent = req.headers["user-agent"] || "";
  return `${ip}:${userAgent}`;
}

// 获取路径的速率限制配置
function getRateLimitConfig(path) {
  // 精确匹配
  if (RATE_LIMIT_CONFIG[path]) {
    return RATE_LIMIT_CONFIG[path];
  }

  // 通配符匹配
  for (let pattern in RATE_LIMIT_CONFIG) {
    if (pattern.endsWith("*")) {
      let prefix = pattern.slice(0, -1);
      if (path.startsWith(prefix)) {
        return RATE_LIMIT_CONFIG[pattern];
      }
    }
  }

  // 默认配置
  return RATE_LIMIT_CONFIG.default;
}

// 速率限制中间件
export function rateLimit(req, res, next) {
  let path = req.path || req.url || "";
  let clientId = getClientIdentifier(req);
  let key = `${path}:${clientId}`;

  let config = getRateLimitConfig(path);
  let now = Date.now();

  // 惰性清理过期记录
  cleanupExpiredRecords();

  let record = rateLimitStore.get(key);

  if (!record) {
    // 首次请求
    record = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(key, record);
    return next();
  }

  // 检查是否过期
  if (now > record.resetAt) {
    // 重置计数
    record.count = 1;
    record.resetAt = now + config.windowMs;
    rateLimitStore.set(key, record);
    return next();
  }

  // 增加计数
  record.count += 1;

  // 检查是否超限
  if (record.count > config.maxRequests) {
    let retryAfter = Math.ceil((record.resetAt - now) / 1000);

    // 设置响应头
    res.setHeader("Retry-After", String(retryAfter));
    res.setHeader("X-RateLimit-Limit", String(config.maxRequests));
    res.setHeader("X-RateLimit-Remaining", "0");
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(record.resetAt / 1000)));

    return fail(res, 429, `请求过于频繁，请在 ${retryAfter} 秒后重试`);
  }

  // 设置响应头
  res.setHeader("X-RateLimit-Limit", String(config.maxRequests));
  res.setHeader("X-RateLimit-Remaining", String(config.maxRequests - record.count));
  res.setHeader("X-RateLimit-Reset", String(Math.ceil(record.resetAt / 1000)));

  return next();
}

// 获取速率限制统计
export function getRateLimitStats() {
  // GTS 的 Map 不支持 keys() 方法，使用 forEach 遍历
  let totalKeys = 0;
  let clients = {};
  let paths = {};

  rateLimitStore.forEach(function(data, key) {
    totalKeys += 1;
    let idx = key.indexOf(":");
    if (idx > 0) {
      paths[key.substring(0, idx)] = true;
      clients[key.substring(idx + 1)] = true;
    }
  });

  let clientCount = 0;
  for (let c in clients) {
    clientCount += 1;
  }
  let pathCount = 0;
  for (let p in paths) {
    pathCount += 1;
  }

  return {
    totalKeys: totalKeys,
    uniqueClients: clientCount,
    uniquePaths: pathCount,
  };
}

