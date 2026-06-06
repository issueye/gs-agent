import { createReadFileTool, createListDirTool, createWriteFileTool, createAppendFileTool } from "@/agent/tools/files";
import { createBashTool } from "@/agent/tools/bash";
import { createGrepTool } from "@/agent/tools/grep";
import { createTodoTool } from "@/agent/tools/todo";

function includes(list, value) {
  if (!list) {
    return false;
  }
  for (let item of list) {
    if (item === value) {
      return true;
    }
  }
  return false;
}

// coding tools 是面向代码项目的默认工具包。
export function createCodingTools(cwd, enabledTools) {
  if (!enabledTools) {
    enabledTools = ["read_file", "list_dir", "grep"];
  }

  let tools = [];
  if (includes(enabledTools, "read_file")) {
    tools.push(createReadFileTool(cwd));
  }
  if (includes(enabledTools, "list_dir")) {
    tools.push(createListDirTool(cwd));
  }
  if (includes(enabledTools, "write_file")) {
    tools.push(createWriteFileTool(cwd));
  }
  if (includes(enabledTools, "append_file")) {
    tools.push(createAppendFileTool(cwd));
  }
  if (includes(enabledTools, "bash")) {
    tools.push(createBashTool(cwd));
  }
  if (includes(enabledTools, "grep")) {
    tools.push(createGrepTool(cwd));
  }
  if (includes(enabledTools, "todo")) {
    tools.push(createTodoTool(cwd));
  }

  return tools;
}
