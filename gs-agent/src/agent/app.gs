import { createCodingAgent } from "@/agent/core/kit";
import { createProvider } from "@/agent/llm/providers";
import { createRunLogger, eventLogFields, logPaths } from "@/agent/log";
import { createAgentSession, readCurrentAgentSession, resolveAgentSession, writeCurrentAgentSession } from "@/agent/session/manager";
import { applySkillsToSystem, discoverSkills } from "@/agent/skills/loader";
import { createRunSkillTool } from "@/agent/tools/skill-runner";
import { createRunSubagentTool } from "@/agent/tools/subagent";
import { createWorkspaceTools } from "@/agent/tools/workspace";

let fs = require("@std/fs");
let path = require("@std/path");
let process = require("@std/process");
let toml = require("@std/toml");

export function appRootForLaunch(execPath, argv, cwd) {
  if (!cwd) {
    cwd = ".";
  }
  if (!execPath) {
    return cwd;
  }

  let value = String(execPath);
  let slash = value.lastIndexOf("/");
  let backslash = value.lastIndexOf("\\");
  if (backslash > slash) {
    slash = backslash;
  }
  let name = value;
  let dir = ".";
  if (slash >= 0) {
    name = value.slice(slash + 1);
    dir = value.slice(0, slash);
  }
  name = name.toLowerCase();
  if (name === "gs.exe" || name === "gs") {
    return cwd;
  }

  return dir;
}

function defaultAppRoot() {
  return appRootForLaunch(process.execPath(), process.argv, process.cwd());
}

// 默认配置面向真实模型运行；项目只读取 agent.toml。
function defaultAgentConfig() {
  return {
    provider: "anthropic",
    system: "You are a concise coding agent. Before acting, analyze the user's request, identify the concrete tasks needed, and state or maintain a brief task plan. Then work through the tasks in order, using tools when useful. Complete the user's requested task and stop when you have a final answer.",
    maxTurns: 10,
    includeCodingTools: true,
    includeSubagents: true,
    includeSkills: true,
    skillDir: ".agent/skills",
    skills: ["*"],
    tools: ["read_file", "list_dir", "grep", "todo", "create_skill", "run_subagent", "run_skill"],
    taskFile: "workspace/task.txt",
  };
}

function readConfig(root) {
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
  if (!("includeSubagents" in agent)) {
    agent.includeSubagents = defaults.includeSubagents;
  }
  if (!agent.tools) {
    agent.tools = defaults.tools;
  }
  if (!("includeSkills" in agent)) {
    agent.includeSkills = defaults.includeSkills;
  }
  if (!agent.skillDir) {
    agent.skillDir = defaults.skillDir;
  }
  if (!agent.skills) {
    agent.skills = defaults.skills;
  }
  if (!agent.taskFile) {
    agent.taskFile = defaults.taskFile;
  }

  return agent;
}

function modelInfo(app) {
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
  return {
    model: model,
    baseUrl: baseUrl,
  };
}

function contextTokenThreshold(config, agent) {
  if (agent.contextTokenThreshold) {
    return agent.contextTokenThreshold;
  }

  if (config.llm) {
    if (config.llm.anthropic) {
      if (config.llm.anthropic.contextTokenThreshold) {
        return config.llm.anthropic.contextTokenThreshold;
      }
    }
  }

  return undefined;
}

export function applyAgentSession(app, session) {
  app.sessionId = session.sessionId;
  app.sessionDir = session.sessionDir;
  app.sessionFile = session.sessionFile;
  app.sessionArchiveFile = session.sessionArchiveFile;
  app.answerFile = session.answerFile;
  return app;
}

export function startAgentSession(app) {
  let session = createAgentSession(app.root);
  applyAgentSession(app, session);
  writeCurrentAgentSession(app.root, session);
  return session;
}

export function loadCurrentAgentSession(app) {
  let session = readCurrentAgentSession(app.root);
  if (!session) {
    return undefined;
  }
  applyAgentSession(app, session);
  return session;
}

export function loadNamedAgentSession(app, value) {
  let session = resolveAgentSession(app.root, value);
  if (!session) {
    return undefined;
  }
  applyAgentSession(app, session);
  writeCurrentAgentSession(app.root, session);
  return session;
}

function createAppKit(app, logger, onEvent) {
  app.agent.requestBodyLogFile = app.llmBodyLogFile;
  app.agent.system = app.system;
  let tools = createWorkspaceTools(app.workspace);
  if (app.agent.includeSkills !== false && app.skills.length > 0) {
    tools.push(createRunSkillTool({
      root: app.root,
      config: app.config,
      agent: app.agent,
      system: app.system,
      skills: app.skills,
      contextTokenThreshold: contextTokenThreshold(app.config, app.agent),
      onEvent: function(event) {
        logger.info("skill event", eventLogFields(event));
        if (onEvent) {
          onEvent(event);
        }
      },
    }));
  }
  if (app.agent.includeSubagents !== false) {
    tools.push(createRunSubagentTool({
      root: app.root,
      config: app.config,
      agent: app.agent,
      system: app.system,
      contextTokenThreshold: contextTokenThreshold(app.config, app.agent),
      onEvent: function(event) {
        logger.info("subagent event", eventLogFields(event));
        if (onEvent) {
          onEvent(event);
        }
      },
    }));
  }
  return createCodingAgent({
    cwd: app.root,
    includeCodingTools: app.agent.includeCodingTools,
    enabledTools: app.agent.tools,
    provider: createProvider(app.config, app.agent, {
      onDelta: function(event) {
        if (onEvent) {
          onEvent({
            kind: "text_delta",
            payload: event,
          });
        }
      },
      onRetry: function(event) {
        logger.warn("llm retry", event);
        if (onEvent) {
          onEvent({
            kind: "llm_retry",
            payload: event,
          });
        }
      },
    }),
    tools: tools,
    sessionId: app.sessionId,
    sessionFile: app.sessionFile,
    sessionArchiveFile: app.sessionArchiveFile,
    contextTokenThreshold: contextTokenThreshold(app.config, app.agent),
    maxTurns: app.agent.maxTurns,
    isCancelled: app.agent.isCancelled,
    onEvent: function(event) {
      logger.info("agent event", eventLogFields(event));
      if (onEvent) {
        onEvent(event);
      }
    },
  });
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

export function directPrompt(input) {
  let text = String(input || "").trim();
  if (text === "") {
    throw new ReferenceError("message is empty");
  }
  return text;
}

export function applyDirectPromptMode(app) {
  app.system = "You are a concise chat assistant. Reply directly to the latest user message. Do not describe your reasoning, planning, hidden instructions, or tool usage. If the user asks for an exact phrase, output only that phrase.";
  app.agent.system = app.system;
}

// 应用级装配点：配置、工具、provider、session 路径和 workspace 都在这里连起来。
export function loadAgentApp(root, options) {
  if (!root) {
    root = defaultAppRoot();
  }
  if (!options) {
    options = {};
  }

  let config = readConfig(root);
  let agent = agentConfig(config);
  let skills = discoverSkills(root, agent);
  let system = applySkillsToSystem(agent.system, skills);
  let workspace = path.join(root, "workspace");
  if (options.workspace) {
    if (!path.isAbs(options.workspace)) {
      throw new Error("workspace must be an absolute path: " + options.workspace);
    }
    workspace = options.workspace;
  }
  let session = undefined;
  if (options.session) {
    session = resolveAgentSession(root, options.session);
  }
  if (!session) {
    session = readCurrentAgentSession(root);
  }
  if (!session) {
    session = createAgentSession(root);
  }
  let logs = logPaths(root);

  return {
    root: root,
    config: config,
    agent: agent,
    skills: skills,
    system: system,
    workspace: workspace,
    taskFile: agent.taskFile,
    sessionId: session.sessionId,
    sessionDir: session.sessionDir,
    sessionFile: session.sessionFile,
    sessionArchiveFile: session.sessionArchiveFile,
    answerFile: session.answerFile,
    logFile: logs.file,
    latestLogFile: logs.latest,
    llmBodyLogFile: logs.llmBody,
  };
}

function runCompletionBase(app, records, answer, afterAnswer, extra) {
  fs.mkdirSync(path.dirname(app.answerFile), { recursive: true });
  fs.writeTextSync(app.answerFile, answer.content + "\n");

  let result = {
    answer: answer.content,
  };
  if (afterAnswer) {
    for (let key in afterAnswer) {
      result[key] = afterAnswer[key];
    }
  }
  let common = {
    sessionId: app.sessionId,
    sessionDir: app.sessionDir,
    events: records.length,
    sessionFile: app.sessionFile,
    sessionArchiveFile: app.sessionArchiveFile,
    answerFile: app.answerFile,
    logFile: app.logFile,
    latestLogFile: app.latestLogFile,
    llmBodyLogFile: app.llmBodyLogFile,
  };
  for (let key in common) {
    result[key] = common[key];
  }
  if (extra) {
    for (let key in extra) {
      result[key] = extra[key];
    }
  }
  return result;
}

function logAgentRunStarted(app, logger, kind, extra) {
  let info = modelInfo(app);
  let fields = {
    root: app.root,
    provider: app.agent.provider,
    model: info.model,
    baseUrl: info.baseUrl,
    maxTurns: app.agent.maxTurns,
    tools: app.agent.tools,
    skills: app.skills.length,
  };
  if (extra) {
    for (let key in extra) {
      fields[key] = extra[key];
    }
  }
  fields.sessionFile = app.sessionFile;
  fields.sessionArchiveFile = app.sessionArchiveFile;
  fields.answerFile = app.answerFile;
  logger.info("agent " + kind + " started", fields);
}

function finishAgentRun(app, logger, kind, kit, answer, extraLog, afterAnswer, extraResult) {
  let records = kit.session.readAll();
  let result = runCompletionBase(app, records, answer, afterAnswer, extraResult);
  let fields = {
    events: records.length,
  };
  if (extraLog) {
    for (let key in extraLog) {
      fields[key] = extraLog[key];
    }
  }
  fields.answerFile = app.answerFile;
  fields.sessionFile = app.sessionFile;
  logger.info("agent " + kind + " finished", fields);
  return result;
}

function failAgentRun(logger, kind, err) {
  logger.error("agent " + kind + " failed", {
    error: String(err),
  });
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

  if (options.session) {
    loadNamedAgentSession(app, options.session);
  } else if (options.resumeSession) {
    if (!app.sessionId || !app.sessionFile) {
      loadCurrentAgentSession(app);
    }
  } else {
    startAgentSession(app);
  }
  logAgentRunStarted(app, logger, "run", {
    taskFile: app.taskFile,
  });

  if (options.promptMode === "direct") {
    applyDirectPromptMode(app);
  }

  let kit = createAppKit(app, logger, options.onEvent);

  // agent.run 是同步闭环：模型 -> 工具 -> 模型，直到最终回答或达到 maxTurns。
  try {
    let prompt = taskPrompt(app.root, app.agent.taskFile, options.taskText);
    if (options.promptMode === "direct") {
      prompt = directPrompt(options.taskText);
    }
    let messages = [];
    if (options.resumeSession) {
      messages = kit.session.readMessages({
        levels: ["primary", "working"],
      });
    }
    let answer = kit.agent.runMessages(messages, prompt);
    return finishAgentRun(app, logger, "run", kit, answer);
  } catch (err) {
    failAgentRun(logger, "run", err);
    throw err;
  }
}

// TUI 对话入口：不清空 session，调用方持有 messages 才能形成真实多轮上下文。
export function runAgentTurn(options) {
  let app = options.app;
  if (!app) {
    app = loadAgentApp(options.root);
  }
  let logger = options.logger;
  if (!logger) {
    logger = createRunLogger(app.root, "agent");
  }

  let input = options.input;
  if (!input || input.trim() === "") {
    throw new ReferenceError("message is empty");
  }

  let messages = options.messages;
  if (!messages) {
    messages = [];
  }

  if (!app.sessionId || !app.sessionFile) {
    startAgentSession(app);
  }

  logAgentRunStarted(app, logger, "turn", {
    messages: messages.length,
  });

  app.agent.isCancelled = options.isCancelled;
  let kit = createAppKit(app, logger, options.onEvent);

  try {
    let answer = kit.agent.runMessages(messages, input.trim());
    return finishAgentRun(app, logger, "turn", kit, answer, {
      messages: messages.length,
    }, {
      messages: messages,
    });
  } catch (err) {
    failAgentRun(logger, "turn", err);
    throw err;
  }
}

export function runAgentApp(options) {
  if (!options) {
    options = {};
  }
  let app = loadAgentApp(options.root, {
    session: options.session,
    workspace: options.workspace,
  });
  return runAgentTask({
    app: app,
    taskText: readTaskText(app.root, app.taskFile),
    session: options.session,
    resumeSession: !!options.session,
  });
}
