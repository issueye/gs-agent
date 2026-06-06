import { createTool } from "@/agent/tools/registry";

let fs = require("@std/fs");
let path = require("@std/path");

// 所有文件工具都经过这个函数，防止模型通过 ../ 访问工作区外的文件。
export function workspacePath(cwd, requested) {
  let root = path.resolve(cwd);
  let target = path.resolve(path.join(root, requested));
  let prefix = root + path.sep;

  if (target !== root && !target.startsWith(prefix)) {
    throw new RangeError("path is outside workspace: " + requested);
  }

  return target;
}

// 读取 UTF-8 文本文件，返回相对路径和内容，便于模型继续推理。
export function createReadFileTool(cwd) {
  return createTool(
    "read_file",
    "Read a UTF-8 text file from the workspace.",
    {
      type: "object",
      required: ["path"],
      additionalProperties: false,
      properties: {
        path: { type: "string", minLength: 1 },
      },
    },
    function(args) {
      let target = workspacePath(cwd, args.path);
      return {
        path: args.path,
        content: fs.readFileSync(target),
      };
    }
  );
}

// 写文件工具会自动创建父目录；真实生产中可在这里增加审批/白名单。
export function createWriteFileTool(cwd) {
  return createTool(
    "write_file",
    "Write a UTF-8 text file inside the workspace. Never call this tool with empty input. Required input example: {\"path\":\"workspace/analysis.md\",\"content\":\"# Title\\n...\"}. For long documents, write the first chunk with write_file, then add more chunks with append_file.",
    {
      type: "object",
      required: ["path", "content"],
      additionalProperties: false,
      properties: {
        path: { type: "string", minLength: 1 },
        content: { type: "string" },
      },
    },
    function(args) {
      let target = workspacePath(cwd, args.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, args.content);
      return {
        path: args.path,
        bytes: args.content.length,
      };
    }
  );
}

export function createAppendFileTool(cwd) {
  return createTool(
    "append_file",
    "Append UTF-8 text to a file inside the workspace. Never call this tool with empty input. Required input example: {\"path\":\"workspace/analysis.md\",\"content\":\"\\nMore text...\"}. Use this to continue writing long documents after creating the file with write_file.",
    {
      type: "object",
      required: ["path", "content"],
      additionalProperties: false,
      properties: {
        path: { type: "string", minLength: 1 },
        content: { type: "string", minLength: 1 },
      },
    },
    function(args) {
      let target = workspacePath(cwd, args.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.appendTextSync(target, args.content);
      return {
        path: args.path,
        bytes: args.content.length,
      };
    }
  );
}

// 目录列表工具用于让模型快速了解项目结构。
export function createListDirTool(cwd) {
  return createTool(
    "list_dir",
    "List directory entries inside the workspace.",
    {
      type: "object",
      required: ["path"],
      additionalProperties: false,
      properties: {
        path: { type: "string" },
      },
    },
    function(args) {
      let target = workspacePath(cwd, args.path);
      return {
        path: args.path,
        entries: fs.readdirSync(target),
      };
    }
  );
}

// 基础文件工具集合：读、写、列目录。
export function createFileTools(cwd) {
  return [
    createReadFileTool(cwd),
    createWriteFileTool(cwd),
    createAppendFileTool(cwd),
    createListDirTool(cwd),
  ];
}
