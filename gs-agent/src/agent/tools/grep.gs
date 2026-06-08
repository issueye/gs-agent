import { createTool } from "@/agent/tools/registry";
import { workspacePath } from "@/agent/tools/files";

let fs = require("@std/fs");
let path = require("@std/path");

// 在单个文件中做纯字符串匹配，避免引入正则差异和转义问题。
function searchFile(root, relativePath, query, results, limit) {
  if (results.length >= limit) {
    return;
  }

  let fullPath = path.join(root, relativePath);
  let stat = fs.statSync(fullPath);
  if (!stat.isFile()) {
    return;
  }

  let text = fs.readFileSync(fullPath);
  if (!text.includes(query)) {
    return;
  }

  let lines = text.split("\n");
  for (let i = 0; i < lines.length; i = i + 1) {
    if (results.length >= limit) {
      return;
    }
    if (lines[i].includes(query)) {
      results.push({
        path: relativePath,
        line: i + 1,
        text: lines[i],
      });
    }
  }
}

// 递归遍历时跳过明显不该扫描的目录，减少噪声和运行时间。
function walk(root, relativePath, query, results, limit) {
  if (results.length >= limit) {
    return;
  }

  let fullPath = path.join(root, relativePath);
  let stat = fs.statSync(fullPath);
  if (stat.isFile()) {
    searchFile(root, relativePath, query, results, limit);
    return;
  }

  if (!stat.isDirectory()) {
    return;
  }

  let entries = fs.readdirSync(fullPath);
  for (let entry of entries) {
    if (entry === ".git" || entry === "node_modules" || entry === ".agent") {
      continue;
    }
    let child = entry;
    if (relativePath !== "." && relativePath !== "") {
      child = path.join(relativePath, entry);
    }
    walk(root, child, query, results, limit);
  }
}

// grep 工具暴露给模型，用于在项目内按字符串查找上下文。
export function createGrepTool(cwd) {
  return createTool(
    "grep",
    "Search UTF-8 text files in the workspace using plain string matching.",
    {
      type: "object",
      required: ["query"],
      additionalProperties: false,
      properties: {
        query: { type: "string", minLength: 1 },
        path: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
    },
    function(args) {
      let start = ".";
      if (args.path) {
        start = args.path;
      }
      let limit = 20;
      if (args.limit) {
        limit = args.limit;
      }

      let root = workspacePath(cwd, ".");
      let relativeStart = start;
      workspacePath(cwd, relativeStart);

      let results = [];
      walk(root, relativeStart, args.query, results, limit);
      return {
        query: args.query,
        matches: results,
      };
    }
  );
}
