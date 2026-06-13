// 用户管理服务
import { User, ROLES } from "../models/User.gs";
import { getDatabase } from "../config/database.gs";
import { encryptPassword, verifyPassword, validatePasswordStrength } from "../utils/hash.gs";
import { nowIso } from "../utils/system.gs";

export class UserManager {
  constructor() {
    this.db = getDatabase();
  }

  // 生成用户 ID
  generateUserId() {
    return "user-" + String(Date.now()) + "-" + String(Math.floor(Math.random() * 1000));
  }

  // 创建用户
  create(data) {
    // 验证用户名
    if (!data.username || data.username.length < 3) {
      throw new Error("用户名长度至少 3 位");
    }

    // 验证密码强度
    let passwordCheck = validatePasswordStrength(data.password);
    if (!passwordCheck.valid) {
      throw new Error(passwordCheck.errors.join(", "));
    }

    // 检查用户名是否已存在
    let existing = this.db.table("users").where("username = ?", data.username).first();
    if (existing !== null) {
      throw new Error("用户名已存在");
    }

    // 创建用户对象
    let user = new User();
    user.id = this.generateUserId();
    user.username = data.username;
    user.passwordHash = encryptPassword(data.password);
    user.role = data.role || ROLES.VIEWER;
    user.email = data.email || "";
    user.displayName = data.displayName || data.username;
    user.enabled = true;
    user.createdAt = nowIso();
    user.updatedAt = nowIso();

    // 保存到数据库
    this.db.table("users").insert(user.toDBRecord());

    return user.toJSON();
  }

  // 用户列表
  list() {
    let records = this.db.table("users").orderBy("created_at DESC").find();
    return records.map((record) => User.fromDBRecord(record).toJSON());
  }

  // 查找用户
  find(id) {
    let record = this.db.table("users").where("id = ?", id).first();
    if (record === null) {
      return null;
    }
    return User.fromDBRecord(record);
  }

  // 根据用户名查找
  findByUsername(username) {
    let record = this.db.table("users").where("username = ?", username).first();
    if (record === null) {
      return null;
    }
    return User.fromDBRecord(record);
  }

  // 更新用户
  update(id, data) {
    let user = this.find(id);
    if (user === null) {
      throw new Error("用户不存在");
    }

    // 更新字段
    if (data.email !== undefined) {
      user.email = data.email;
    }
    if (data.displayName !== undefined) {
      user.displayName = data.displayName;
    }
    if (data.role !== undefined) {
      user.role = data.role;
    }
    if (data.enabled !== undefined) {
      user.enabled = data.enabled;
    }

    user.updatedAt = nowIso();

    // 保存到数据库
    this.db.table("users").where("id = ?", id).update(user.toDBRecord());

    return user.toJSON();
  }

  // 删除用户
  delete(id) {
    // 不能删除自己
    let user = this.find(id);
    if (user === null) {
      throw new Error("用户不存在");
    }

    this.db.table("users").where("id = ?", id).delete();
    return true;
  }

  // 修改密码
  changePassword(id, oldPassword, newPassword) {
    let user = this.find(id);
    if (user === null) {
      throw new Error("用户不存在");
    }

    // 验证旧密码
    if (!verifyPassword(oldPassword, user.passwordHash)) {
      throw new Error("旧密码错误");
    }

    // 验证新密码强度
    let passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.valid) {
      throw new Error(passwordCheck.errors.join(", "));
    }

    // 更新密码
    user.passwordHash = encryptPassword(newPassword);
    user.updatedAt = nowIso();

    this.db.table("users").where("id = ?", id).update({
      password_hash: user.passwordHash,
      updated_at: user.updatedAt,
    });

    return true;
  }

  // 管理员重置密码
  resetPassword(id, newPassword) {
    let user = this.find(id);
    if (user === null) {
      throw new Error("用户不存在");
    }

    // 验证新密码强度
    let passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.valid) {
      throw new Error(passwordCheck.errors.join(", "));
    }

    // 更新密码
    user.passwordHash = encryptPassword(newPassword);
    user.updatedAt = nowIso();

    this.db.table("users").where("id = ?", id).update({
      password_hash: user.passwordHash,
      updated_at: user.updatedAt,
    });

    return true;
  }

  // 用户认证
  authenticate(username, password) {
    let user = this.findByUsername(username);
    if (user === null) {
      return null;
    }

    // 检查用户是否启用
    if (!user.enabled) {
      throw new Error("用户已被禁用");
    }

    // 验证密码
    if (!verifyPassword(password, user.passwordHash)) {
      return null;
    }

    // 更新最后登录时间
    user.lastLoginAt = nowIso();
    this.db.table("users").where("id = ?", user.id).update({
      last_login_at: user.lastLoginAt,
    });

    return user;
  }

  // 更新最后登录时间
  updateLastLogin(id) {
    let now = nowIso();
    this.db.table("users").where("id = ?", id).update({
      last_login_at: now,
    });
  }

  // 初始化默认管理员
  initDefaultAdmin() {
    // 检查是否已存在管理员
    let adminCount = this.db.table("users").where("role = ?", ROLES.ADMIN).count();
    if (adminCount > 0) {
      return null;
    }

    // 创建默认管理员
    let admin = new User();
    admin.id = this.generateUserId();
    admin.username = "admin";
    admin.passwordHash = encryptPassword("Admin123");
    admin.role = ROLES.ADMIN;
    admin.displayName = "系统管理员";
    admin.enabled = true;
    admin.createdAt = nowIso();
    admin.updatedAt = nowIso();

    this.db.table("users").insert(admin.toDBRecord());

    console.log("Default admin user created: admin/Admin123");
    console.log("⚠️  Please change the default password after first login!");

    return admin.toJSON();
  }
}
