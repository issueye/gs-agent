import { createTool } from "@/agent/tools/registry";
import { workspacePath } from "@/agent/tools/files";

let exec = require("@std/exec");
let os = require("@std/os");

// 根据宿主平台选择 shell，保持 Windows 和类 Unix 都能运行。
function shellCommand(command) {
  if (os.platform === "windows") {
    return exec.command("powershell", ["-NoProfile", "-Command", command]);
  }
  return exec.command("bash", ["-lc", command]);
}

// bash 工具用于真实项目操作；cwd 仍会被限制在工作区内。
export function createBashTool(cwd) {
  return createTool(
    "bash",
    "Run a shell command in the workspace and return stdout, stderr, and exit code.",
    {
      type: "object",
      required: ["command"],
      additionalProperties: false,
      properties: {
        command: { type: "string", minLength: 1 },
        cwd: { type: "string" },
      },
    },
    function(args) {
      let runDir = cwd;
      if (args.cwd) {
        runDir = workspacePath(cwd, args.cwd);
      }
      let cmd = shellCommand(args.command);
      cmd.setDir(runDir);
      return cmd.run();
    }
  );
}
