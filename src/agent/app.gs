import { createCodingAgent } from "@/agent/core/kit";
import { createProvider } from "@/agent/llm/providers";
import { createRunLogger, eventLogFields, logPaths } from "@/agent/log";
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

// TUI 和命令行共用的任务读取函数；TUI 启动时允许文件尚不存在。
export function readTaskText(root, taskFile) {
  let target = path.resolve(path.join(root, taskFile));
  if (!fs.existsSync(target)) {
    return "";
  }
  return fs.readFileSync(target);
}

// 保存任务时一并创建目录，避免首次运行没有 workspace 目录。
export function writeTaskText(root, taskFile, text) {
  let target = path.resolve(path.join(root, taskFile));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeTextSync(target, text);
  return target;
}

// 真实任务来自 workspace/task.txt；这里把文件名和内容一起交给模型，便于 session 回放。
export function taskPrompt(root, taskFile, taskText) {
  if (!taskText) {
    taskText = readTaskText(root, taskFile);
  }

  if (taskText.trim() === "") {
    throw new ReferenceError("task file not found: " + taskFile);
  }

  let task = taskText.trim();
  if (task === "") {
    throw new ReferenceError("task file is empty: " + taskFile);
  }

  return "Project root: .\nTask file: " + taskFile + "\n\n" + task + "\n\nUse read_task only for the task file. Use list_dir/read_file/grep on the project root when inspecting this agent project.";
}

// 应用级装配点：配置、工具、provider、session 路径和 workspace 都在这里连起来。
export function loadAgentApp(root) {
  if (!root) {
    root = process.cwd();
  }

  let config = readConfig(root);
  let agent = agentConfig(config);
  let workspace = path.join(root, "workspace");
  let sessionFile = path.join(root, ".agent", "session.jsonl");
  let answerFile = path.join(root, ".agent", "answer.md");
  let logs = logPaths(root);

  return {
    root: root,
    config: config,
    agent: agent,
    workspace: workspace,
    taskFile: agent.taskFile,
    sessionFile: sessionFile,
    answerFile: answerFile,
    logFile: logs.file,
    latestLogFile: logs.latest,
  };
}

// TUI 和命令行共用的真实运行入口；调用方可传入 taskText 和 onEvent。
export function runAgentTask(options) {
  let app = options.app;
  if (!app) {
    app = loadAgentApp(options.root);
  }
  let logger = options.logger;
  if (!logger) {
    logger = createRunLogger(app.root, "agent");
  }

  let sessionFile = app.sessionFile;
  // 每次运行生成一份新的 session，避免旧事件干扰本次排查。
  if (fs.existsSync(sessionFile)) {
    fs.unlinkSync(sessionFile);
  }

  let model = "unknown";
  let baseUrl = "";
  if (app.config.llm) {
    if (app.config.llm.anthropic) {
      if (app.config.llm.anthropic.model) {
        model = app.config.llm.anthropic.model;
      }
      if (app.config.llm.anthropic.baseUrl) {
        baseUrl = app.config.llm.anthropic.baseUrl;
      }
    }
  }
  logger.info("agent run started", {
    root: app.root,
    provider: app.agent.provider,
    model: model,
    baseUrl: baseUrl,
    maxTurns: app.agent.maxTurns,
    tools: app.agent.tools,
    taskFile: app.taskFile,
    sessionFile: sessionFile,
    answerFile: app.answerFile,
  });

  let kit = createCodingAgent({
    cwd: app.root,
    includeCodingTools: app.agent.includeCodingTools,
    enabledTools: app.agent.tools,
    provider: createProvider(app.config, app.agent),
    tools: createWorkspaceTools(app.workspace),
    sessionFile: sessionFile,
    maxTurns: app.agent.maxTurns,
    onEvent: function(event) {
      logger.info("agent event", eventLogFields(event));
      if (options.onEvent) {
        options.onEvent(event);
      }
    },
  });

  // agent.run 是同步闭环：模型 -> 工具 -> 模型，直到最终回答或达到 maxTurns。
  let answer = undefined;
  try {
    answer = kit.agent.run(taskPrompt(app.root, app.agent.taskFile, options.taskText));
    let records = kit.session.readAll();
    fs.mkdirSync(path.dirname(app.answerFile), { recursive: true });
    fs.writeTextSync(app.answerFile, answer.content + "\n");
    logger.info("agent run finished", {
      events: records.length,
      answerFile: app.answerFile,
      sessionFile: sessionFile,
    });

    return {
      answer: answer.content,
      events: records.length,
      sessionFile: sessionFile,
      answerFile: app.answerFile,
      logFile: app.logFile,
      latestLogFile: app.latestLogFile,
    };
  } catch (err) {
    logger.error("agent run failed", {
      error: String(err),
    });
    throw err;
  }
}

// 保持现有命令行入口行为不变。
export function runAgentApp() {
  let app = loadAgentApp(process.cwd());
  return runAgentTask({
    app: app,
    taskText: readTaskText(app.root, app.taskFile),
  });
}
