let fs = require("@std/fs");
let path = require("@std/path");
let zip = require("@std/archive/zip");

// 文件与安装管理：负责安装目录/日志目录的准备、安装包解压部署、
// 版本升级时的目录备份与恢复、卸载时的目录清理。
// 所有路径相对当前工作目录解析，由调用方传入绝对或相对路径。

// 确保目录存在（递归创建）。
export function ensureDir(dir) {
  if (!dir) {
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
}

// 准备服务运行所需的目录：安装目录与日志目录。
export function prepareServiceDirs(service) {
  if (service.installPath) {
    ensureDir(service.installPath);
  }
  if (service.logPath) {
    ensureDir(service.logPath);
  }
}

// 解析服务的 stdout/stderr 日志文件路径。logPath 为目录，文件名按服务 id 区分。
export function resolveLogFiles(service) {
  let dir = service.logPath || ".";
  ensureDir(dir);
  return {
    stdout: path.join(dir, service.id + ".out.log"),
    stderr: path.join(dir, service.id + ".err.log"),
  };
}

// 部署安装包到安装目录。
// pkgPath 支持 .zip 压缩包（解压到 installPath）或单个文件（拷贝到 installPath）。
// 返回: { ok: bool, message: string }
export function deployPackage(pkgPath, installPath) {
  if (!pkgPath) {
    return { ok: false, message: "package path is empty" };
  }
  if (!fs.existsSync(pkgPath)) {
    return { ok: false, message: "package not found: " + pkgPath };
  }

  ensureDir(installPath);

  let ext = path.extname(pkgPath).toLowerCase();
  if (ext === ".zip") {
    zip.extract(pkgPath, installPath);
    return { ok: true, message: "extracted " + pkgPath + " to " + installPath };
  }

  // 非压缩包：作为单文件拷贝到安装目录，保留原文件名。
  let target = path.join(installPath, path.basename(pkgPath));
  fs.copyFileSync(pkgPath, target);
  return { ok: true, message: "copied " + pkgPath + " to " + target };
}

// 将安装目录打包备份到指定 zip 文件，用于升级前留存可回滚的版本快照。
// 返回: { ok: bool, archive: string|null, message: string }
export function backupInstallDir(installPath, backupDir, label) {
  if (!installPath || !fs.existsSync(installPath)) {
    return { ok: false, archive: null, message: "install path not found: " + installPath };
  }

  ensureDir(backupDir);
  let name = (label || "backup") + "-" + String(Date.now()) + ".zip";
  let archive = path.join(backupDir, name);

  zip.create([{ path: installPath, name: path.basename(installPath) }], archive);
  return { ok: true, archive: archive, message: "backed up " + installPath + " to " + archive };
}

// 从 zip 备份恢复安装目录。先清空安装目录再解压，保证干净恢复。
// 返回: { ok: bool, message: string }
export function restoreInstallDir(archive, installPath) {
  if (!archive || !fs.existsSync(archive)) {
    return { ok: false, message: "backup archive not found: " + archive };
  }

  // 清空目标目录后重新解压，避免新旧文件混杂。
  if (fs.existsSync(installPath)) {
    fs.rmSync(installPath, { recursive: true, force: true });
  }
  ensureDir(installPath);
  zip.extract(archive, installPath);
  return { ok: true, message: "restored " + installPath + " from " + archive };
}

// 卸载时清理安装目录。removeData 为 true 时一并删除日志目录。
// 这是不可逆操作，由调用方在确认后触发。
// 返回: { ok: bool, message: string }
export function cleanupServiceDirs(service, removeData) {
  let removed = [];

  if (service.installPath && fs.existsSync(service.installPath)) {
    fs.rmSync(service.installPath, { recursive: true, force: true });
    removed.push(service.installPath);
  }

  if (removeData && service.logPath && fs.existsSync(service.logPath)) {
    fs.rmSync(service.logPath, { recursive: true, force: true });
    removed.push(service.logPath);
  }

  return { ok: true, message: "removed: " + (removed.length > 0 ? removed.join(", ") : "nothing") };
}

// 读取日志文件的最后若干字节内容（用于日志预览）。
// 返回字符串；文件不存在返回空串。
export function tailLogFile(logFile, maxBytes) {
  if (!logFile || !fs.existsSync(logFile)) {
    return "";
  }

  let content = fs.readTextSync(logFile);
  let limit = maxBytes || 65536;
  if (content.length <= limit) {
    return content;
  }
  return content.slice(content.length - limit);
}

// 读取日志文件的最后若干行（用于进程日志预览）。
// 返回: { exists: bool, size: number, lines: [string], truncated: bool }
export function tailLogLines(logFile, maxLines) {
  if (!logFile || !fs.existsSync(logFile)) {
    return { exists: false, size: 0, lines: [], truncated: false };
  }

  let stat = fs.statSync(logFile);
  // 只读取末尾一段字节，避免超大日志文件全量载入。
  let content = tailLogFile(logFile, 262144);
  let limit = maxLines || 200;

  // 按换行切分（手动实现，规避 GTS String.split 不支持正则）。
  let lines = [];
  let current = "";
  for (let i = 0; i < content.length; i++) {
    let ch = content[i];
    if (ch === "\n") {
      lines.push(current.charAt(current.length - 1) === "\r" ? current.slice(0, current.length - 1) : current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.length > 0) {
    lines.push(current);
  }

  let truncated = lines.length > limit;
  if (truncated) {
    lines = lines.slice(lines.length - limit);
  }

  return {
    exists: true,
    size: stat.size,
    lines: lines,
    truncated: truncated,
  };
}
