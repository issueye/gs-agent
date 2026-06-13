// 安全响应头中间件

export function securityHeaders(req, res, next) {
  // X-Content-Type-Options: 防止 MIME 类型嗅探
  res.setHeader("X-Content-Type-Options", "nosniff");

  // X-Frame-Options: 防止点击劫持
  res.setHeader("X-Frame-Options", "SAMEORIGIN");

  // X-XSS-Protection: 启用浏览器 XSS 过滤
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Referrer-Policy: 控制 Referer 头信息
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Content-Security-Policy: 内容安全策略
  // 注意：这是一个基础策略，可能需要根据实际情况调整
  let csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Vue 需要 unsafe-eval
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
  res.setHeader("Content-Security-Policy", csp);

  // Permissions-Policy: 控制浏览器功能
  let permissionsPolicy = [
    "geolocation=()",
    "microphone=()",
    "camera=()",
    "payment=()",
    "usb=()",
  ].join(", ");
  res.setHeader("Permissions-Policy", permissionsPolicy);

  // 移除可能泄露服务器信息的头（GTS web 模块未提供 removeHeader，
  // 这里通过覆盖为空值来弱化信息泄露）
  try {
    res.setHeader("X-Powered-By", "");
    res.setHeader("Server", "");
  } catch (e) {
    // 忽略不支持的情况
  }

  return next();
}
