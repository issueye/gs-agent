# GS-OPS Database Migration Guide

## 概述

从 v0.2.0 开始，GS-OPS 使用 **GTS std/orm** 替代 JSON 文件进行数据存储。

## 数据库架构

### 表结构

1. **services** - 服务信息
   - id (主键)
   - name, display_name, description
   - version, status, type
   - install_path, config_path, log_path
   - port, pid, uptime, auto_start
   - dependencies, commands, environment, health_check (JSON)
   - created_at, updated_at

2. **operation_logs** - 操作日志
   - id (自增主键)
   - service_id, operation, status, message
   - operator, timestamp

3. **version_history** - 版本历史
   - id (主键)
   - service_id, version, previous_version
   - action, status, operator, timestamp

4. **config_backups** - 配置备份
   - id (主键)
   - service_id, commands, environment, health_check (JSON)
   - created_by, created_at

5. **service_templates** - 服务模板
   - id (主键)
   - name, description, type
   - defaults (JSON)
   - created_at

## 自动迁移

首次启动时，系统会自动将旧的 JSON 文件迁移到 SQLite 数据库：

```bash
cd backend
../../gts/gs.exe --timeout 0 run
```

迁移过程：
- ✅ 读取 `storage/services.json` → `services` 表
- ✅ 读取 `storage/runtime-state.json` → 合并到 `services` 表
- ✅ 读取 `storage/operation-logs.json` → `operation_logs` 表
- ✅ 读取 `storage/versions.json` → `version_history` 表
- ✅ 读取 `storage/config-backups.json` → `config_backups` 表
- ✅ 读取 `storage/service-templates.json` → `service_templates` 表

## 数据库文件位置

默认位置：`backend/storage/gs-ops.db`

可通过环境变量自定义：
```bash
export GS_OPS_DB_DSN=storage/custom.db
```

## 手动迁移

如需手动执行迁移：

```javascript
import { migrateFromJsonFiles } from "./utils/migrate.gs";

let result = migrateFromJsonFiles(process.cwd());
console.log("Migrated:", result);
// { services: 2, logs: 10, versions: 5, backups: 3, templates: 2 }
```

## 兼容性

- ✅ 保持原有 API 接口不变
- ✅ 前端无需修改
- ✅ JSON 文件可保留作为备份
- ✅ 自动创建表结构和索引

## ORM 特性

使用 GTS std/orm 提供的功能：

- **链式查询**: `db.table("services").where("status = ?", "running").find()`
- **事务支持**: `db.begin()`, `commit()`, `rollback()`
- **批量操作**: `db.batchInsert()`
- **自动迁移**: `db.autoMigrate(schemas)`
- **参数化查询**: 防止 SQL 注入

## 性能优势

相比 JSON 文件存储：

1. **更快的查询** - 使用索引优化查询性能
2. **并发安全** - SQLite 提供事务和锁机制
3. **数据完整性** - 外键约束和类型检查
4. **增量更新** - 无需读写整个文件
5. **查询灵活** - 支持复杂的过滤和排序

## 故障排查

### 迁移失败

如果自动迁移失败，检查：
1. JSON 文件格式是否正确
2. 是否有文件权限问题
3. 查看控制台警告信息

### 数据库锁定

如果遇到 "database is locked" 错误：
1. 确保没有其他进程访问数据库
2. 重启后端服务
3. 删除 `storage/gs-ops.db` 重新迁移

### 回退到 JSON

如需回退，使用 git 恢复代码：
```bash
git checkout v0.1.0
```

## 备份建议

1. **定期备份数据库文件**
   ```bash
   cp storage/gs-ops.db storage/backups/gs-ops-$(date +%Y%m%d).db
   ```

2. **保留 JSON 文件** （至少一周）
   - 迁移成功后不要立即删除
   - 作为应急恢复手段

3. **导出 SQL**
   ```bash
   sqlite3 storage/gs-ops.db .dump > backup.sql
   ```
