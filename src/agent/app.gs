import { createCodingAgent } from "@/agent/core/kit";
import { createProvider } from "@/agent/llm/providers";
import { createWorkspaceTools } from "@/agent/tools/workspace";

let fs = require("@std/fs");
let path = require("@std/path");
let process = require("@std/process");
let toml = require("@std/toml");

// 默认配置面向真实模型运行；agent.local.toml 可覆盖其中的密钥和模型参数。
function defaultAgentConfig() {
  return {
    provider: "anthropic",
    system: "You are a concise coding agent. Use tools when useful. Complete the user's requested task and stop when you have a final answer.",
    maxTurns: 10,
    includeCodingTools: true,
    tools: ["read_file", "list_dir", "grep"],
    taskFile: "workspace/task.txt",
  };
}

// 配置读取顺序：本地私密配置优先，其次是可提交的默认配置。
function readConfig(root) {
  let localFile = path.join(root, "agent.local.toml");
  if (fs.existsSync(localFile)) {
    return toml.readFileSync(localFile);
  }

  let configFile = path.join(root, "agent.toml");
  if (fs.existsSync(configFile)) {
    return toml.readFileSync(configFile);
  }

  return {
    agent: defaultAgentConfig(),
  };
}

// 将缺省项补齐，避免配置文件只写一部分时运行期取到 undefined。
function agentConfig(config) {
  if (!config.agent) {
    return defaultAgentConfig();
  }

  let defaults = defaultAgentConfig();
  let agent = config.agent;

  if (!agent.provider) {
    agent.provider = defaults.provider;
  }
  if (!agent.system) {
    agent.system = defaults.system;
  }
  if (!agent.maxTurns) {
    agent.maxTurns = defaults.maxTurns;
  }
  if (!("includeCodingTools" in agent)) {
    agent.includeCodingTools = defaults.includeCodingTools;
  }
  if (!agent.tools) {
    agent.tools = defaults.tools;
  }
  if (!agent.taskFile) {
    agent.taskFile = defaults.taskFile;
  }

  return agent;
}

// 真实任务来自 workspace/task.txt；这里把文件名和内容一起交给模型，便于 session 回放。
function readTaskPrompt(root, taskFile) {
  let target = path.resolve(path.join(root, taskFile));
  if (!fs.existsSync(target)) {
    throw new ReferenceError("task file not found: " + taskFile);
  }

  let task = fs.readFileSync(target).trim();
  if (task === "") {
    throw new ReferenceError("task file is empty: " + taskFile);
  }

  return "Project root: .\nTask file: " + taskFile + "\n\n" + task + "\n\nUse read_task only for the task file. Use list_dir/read_file/grep on the project root when inspecting this agent project.";
}

// 应用级装配点：配置、工具、provider、session 和 agent loop 都在这里连起来。
export function runAgentApp() {
  let root = process.cwd();
  let config = readConfig(root);
  let agent = agentConfig(config);
  let workspace = path.join(root, "workspace");
  let sessionFile = path.join(root, ".agent", "session.jsonl");

  // 每次运行生成一份新的 session，避免旧事件干扰本次排查。
  if (fs.existsSync(sessionFile)) {
    fs.unlinkSync(sessionFile);
  }

  let kit = createCodingAgent({
    cwd: root,
    includeCodingTools: agent.includeCodingTools,
    enabledTools: agent.tools,
    provider: createProvider(config, agent),
    tools: createWorkspaceTools(workspace),
    sessionFile: sessionFile,
    maxTurns: agent.maxTurns,
  });

  // agent.run 是同步闭环：模型 -> 工具 -> 模型，直到最终回答或达到 maxTurns。
  let answer = kit.agent.run(readTaskPrompt(root, agent.taskFile));
  let records = kit.session.readAll();
  let answerFile = path.join(root, ".agent", "answer.md");
  fs.writeTextSync(answerFile, answer.content + "\n");

  return {
    answer: answer.content,
    events: records.length,
    sessionFile: sessionFile,
    answerFile: answerFile,
  };
}
