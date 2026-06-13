import { createApplication } from "./app/bootstrap.gs";
import { migrateFromJsonFiles } from "./utils/migrate.gs";

let process = require("@std/process");

let portValue = process.getenv("GS_OPS_PORT", "7310");
let port = Number(portValue);

// 执行数据迁移
console.log("Migrating data from JSON files to database...");
let migrated = migrateFromJsonFiles(process.cwd());
console.log("Migration completed:", migrated);

// 启动应用
let app = createApplication();
app.listen(port);
console.log("GS-OPS backend listening on http://127.0.0.1:" + String(port));
