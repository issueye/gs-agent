import { createTool } from "@/agent/tools/registry";
import { workspacePath } from "@/agent/tools/files";

let fs = require("@std/fs");

// 模型常会传 /workspace/task.txt；这里归一化到 workspace 根下的 task.txt。
function normalizeTaskPath(requested) {
  let normalized = requested;
  while (normalized.startsWith("/") || normalized.startsWith("\\")) {
    normalized = normalized.slice(1);
  }
  if (normalized.startsWith("workspace/") || normalized.startsWith("workspace\\")) {
    normalized = normalized.slice(10);
  }
  return normalized;
}

// 专门读取任务文件的工具，和通用 read_file 分开，便于以后限制任务目录权限。
export function createReadTaskTool(root) {
  return createTool(
    "read_task",
    "Read a task file from the agent workspace. Use task.txt for the default task.",
    {
      type: "object",
      required: ["path"],
      additionalProperties: false,
      properties: {
        path: { type: "string", minLength: 1 },
      },
    },
    function(args) {
      let taskPath = normalizeTaskPath(args.path);
      let target = workspacePath(root, taskPath);
      return {
        path: taskPath,
        content: fs.readFileSync(target),
      };
    }
  );
}

// workspace 专属工具集合，目前只有 read_task。
export function createWorkspaceTools(root) {
  return [
    createReadTaskTool(root),
  ];
}
