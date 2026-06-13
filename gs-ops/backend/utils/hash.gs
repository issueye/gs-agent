// 密码加密工具
import crypto from "@std/crypto";

// Bcrypt 风格的密码加密
// 注意: GTS 的 crypto 库可能不支持完整的 bcrypt，这里使用 SHA256 + Salt 模拟
// 生产环境建议使用真正的 bcrypt 库

const SALT_ROUNDS = 10;
const SALT_LENGTH = 16;

// 生成随机 Salt
function generateSalt(length = SALT_LENGTH) {
  let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let salt = "";
  for (let i = 0; i < length; i++) {
    salt += chars[Math.floor(Math.random() * chars.length)];
  }
  return salt;
}

// Hash 密码
function hashPassword(password, salt) {
  let combined = salt + password;
  // 多次迭代增强安全性
  let hash = combined;
  for (let i = 0; i < SALT_ROUNDS; i++) {
    hash = crypto.sha256(hash);
  }
  return hash;
}

// 加密密码
export function encryptPassword(password) {
  let salt = generateSalt();
  let hash = hashPassword(password, salt);
  // 格式: $salt$hash
  return "$" + salt + "$" + hash;
}

// 验证密码
export function verifyPassword(password, encrypted) {
  try {
    // 解析存储的密码
    let parts = encrypted.split("$");
    if (parts.length !== 3 || parts[0] !== "") {
      return false;
    }

    let salt = parts[1];
    let storedHash = parts[2];

    // 计算输入密码的 hash
    let hash = hashPassword(password, salt);

    // 比较 hash
    return hash === storedHash;
  } catch (e) {
    console.error("Password verification error:", e);
    return false;
  }
}

// 验证密码强度
export function validatePasswordStrength(password) {
  let errors = [];

  // 最小长度
  if (password.length < 8) {
    errors.push("密码长度至少 8 位");
  }

  // 包含大写字母
  let hasUpperCase = false;
  for (let i = 0; i < password.length; i++) {
    let char = password[i];
    if (char >= "A" && char <= "Z") {
      hasUpperCase = true;
      break;
    }
  }
  if (!hasUpperCase) {
    errors.push("密码必须包含至少一个大写字母");
  }

  // 包含小写字母
  let hasLowerCase = false;
  for (let i = 0; i < password.length; i++) {
    let char = password[i];
    if (char >= "a" && char <= "z") {
      hasLowerCase = true;
      break;
    }
  }
  if (!hasLowerCase) {
    errors.push("密码必须包含至少一个小写字母");
  }

  // 包含数字
  let hasDigit = false;
  for (let i = 0; i < password.length; i++) {
    let char = password[i];
    if (char >= "0" && char <= "9") {
      hasDigit = true;
      break;
    }
  }
  if (!hasDigit) {
    errors.push("密码必须包含至少一个数字");
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}
