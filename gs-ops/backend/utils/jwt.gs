// JWT 工具库
import crypto from "@std/crypto";
import base64 from "@std/encoding/base64";
import { nowIso } from "./system.gs";

let process = require("@std/process");

// JWT 配置
const JWT_SECRET = process.getenv("JWT_SECRET", "gs-ops-secret-key-change-in-production");
const JWT_EXPIRES_IN = Number(process.getenv("JWT_EXPIRES_IN", "86400")); // 24小时
const JWT_REFRESH_EXPIRES_IN = Number(process.getenv("JWT_REFRESH_EXPIRES_IN", "604800")); // 7天

// Base64 URL 编码
function base64UrlEncode(str) {
  return base64.encodeURL(str);
}

// Base64 URL 解码
function base64UrlDecode(str) {
  return base64.decodeURL(str);
}

// HMAC SHA256 签名
function hmacSha256(data, secret) {
  return crypto.hmac("sha256", secret, data);
}

// 生成 JWT Token
export function generateToken(payload, expiresIn = JWT_EXPIRES_IN) {
  let now = Math.floor(Date.now() / 1000);

  // JWT Header
  let header = {
    alg: "HS256",
    typ: "JWT"
  };

  // JWT Payload
  let claims = {
    ...payload,
    iat: now,
    exp: now + expiresIn
  };

  // 编码 Header 和 Payload
  let encodedHeader = base64UrlEncode(JSON.stringify(header));
  let encodedPayload = base64UrlEncode(JSON.stringify(claims));

  // 生成签名
  let signingInput = encodedHeader + "." + encodedPayload;
  let signature = hmacSha256(signingInput, JWT_SECRET);
  let encodedSignature = base64UrlEncode(signature);

  // 组合 JWT
  return signingInput + "." + encodedSignature;
}

// 验证 JWT Token
export function verifyToken(token) {
  try {
    // 分割 JWT
    let parts = token.split(".");
    if (parts.length !== 3) {
      return { valid: false, error: "Invalid token format" };
    }

    let encodedHeader = parts[0];
    let encodedPayload = parts[1];
    let encodedSignature = parts[2];

    // 验证签名
    let signingInput = encodedHeader + "." + encodedPayload;
    let expectedSignature = hmacSha256(signingInput, JWT_SECRET);
    let expectedEncodedSignature = base64UrlEncode(expectedSignature);

    if (encodedSignature !== expectedEncodedSignature) {
      return { valid: false, error: "Invalid signature" };
    }

    // 解码 Payload
    let payloadJson = base64UrlDecode(encodedPayload);
    let payload = JSON.parse(payloadJson);

    // 检查过期时间
    let now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: "Token expired", payload: payload };
    }

    return { valid: true, payload: payload };
  } catch (e) {
    return { valid: false, error: "Token verification failed: " + String(e) };
  }
}

// 生成访问令牌
export function generateAccessToken(user) {
  return generateToken({
    userId: user.id,
    username: user.username,
    role: user.role
  }, JWT_EXPIRES_IN);
}

// 生成刷新令牌
export function generateRefreshToken(user) {
  return generateToken({
    userId: user.id,
    type: "refresh"
  }, JWT_REFRESH_EXPIRES_IN);
}

// 从请求中提取 Token
export function extractToken(req) {
  // HTTP 头名称可能是小写或大写，尝试两种
  let authHeader = null;
  if (req.headers) {
    authHeader = req.headers["authorization"] || req.headers["Authorization"];
  }

  if (!authHeader) {
    return null;
  }

  // 支持 "Bearer <token>" 格式
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  return authHeader;
}
