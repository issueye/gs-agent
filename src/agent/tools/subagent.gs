import { createCodingAgent } from "@/agent/core/kit";
import { createProvider } from "@/agent/llm/providers";
import { createAgentSession } from "@/agent/session/manager";
import { createTool } from "@/agent/tools/registry";

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

function cloneAgentConfig(agent, system, maxTurns) {
  let out = {};
  for (let key in agent) {
    out[key] = agent[key];
  }
  out.system = system;
  out.maxTurns = maxTurns;
  return out;
}

function defaultSubagentTools(parentTools) {
  let defaults = ["read_file", "list_dir", "grep", "todo"];
  let out = [];
  for (let tool of defaults) {
    if (includes(parentTools, tool)) {
      out.push(tool);
    }
  }
  return out;
}

function normalizeRequestedTools(parentTools, requested) {
  if (!requested) {
    return defaultSubagentTools(parentTools);
  }
  if (requested.length === 0) {
    return defaultSubagentTools(parentTools);
  }

  let out = [];
  for (let tool of requested) {
    if (tool === "run_subagent") {
      continue;
    }
    if (!includes(parentTools, tool)) {
      throw new ReferenceError("subagent tool is not enabled for parent agent: " + tool);
    }
    out.push(tool);
  }
  return out;
}

function roleSystem(baseSystem, role, task) {
  let text = String(baseSystem || "");
  text = text + "\n\nYou are running as a subagent.";
  if (role && String(role).trim() !== "") {
    text = text + "\nRole: " + String(role).trim();
  }
  text = text + "\nFocus only on the delegated task. Return a concise result with key findings, changed files if any, and any blockers.";
  text = text + "\nDelegated task:\n" + String(task || "").trim();
  return text;
}

export function createRunSubagentTool(options) {
  let root = options.root;
  let config = options.config;
  let parentAgent = options.agent;
  let baseSystem = options.system || parentAgent.system;
  let contextTokenThreshold = options.contextTokenThreshold;
  let onEvent = options.onEvent;

  return createTool(
    "run_subagent",
    "Run a synchronous child agent for a focused delegated task. The child uses its own session and returns its final answer. By default it receives read_file, list_dir, grep, and todo if those tools are enabled for the parent.",
    {
      type: "object",
      required: ["task"],
      additionalProperties: false,
      properties: {
        task: { type: "string", minLength: 1 },
        role: { type: "string" },
        maxTurns: { type: "integer", minimum: 1, maximum: 12 },
        tools: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    function(args) {
      let maxTurns = args.maxTurns || 4;
      let childTools = normalizeRequestedTools(parentAgent.tools, args.tools);
      let session = createAgentSession(root);
      let childSystem = roleSystem(baseSystem, args.role, args.task);
      let childAgentConfig = cloneAgentConfig(parentAgent, childSystem, maxTurns);
      childAgentConfig.tools = childTools;

      if (onEvent) {
        onEvent({
          kind: "subagent_start",
          payload: {
            role: args.role || "",
            task: args.task,
            maxTurns: maxTurns,
            tools: childTools,
            sessionId: session.sessionId,
            sessionFile: session.sessionFile,
          },
        });
      }

      let kit = createCodingAgent({
        cwd: root,
        includeCodingTools: parentAgent.includeCodingTools,
        enabledTools: childTools,
        includeDynamicTools: false,
        includeSessionArchiveTool: true,
        provider: createProvider(config, childAgentConfig),
        sessionFile: session.sessionFile,
        sessionArchiveFile: session.sessionArchiveFile,
        contextTokenThreshold: contextTokenThreshold,
        maxTurns: maxTurns,
        onEvent: function(event) {
          if (onEvent) {
            onEvent({
              kind: "subagent_event",
              payload: {
                sessionId: session.sessionId,
                event: event,
              },
            });
          }
        },
      });

      let answer = kit.agent.run(String(args.task).trim());
      let records = kit.session.readAll();

      if (onEvent) {
        onEvent({
          kind: "subagent_end",
          payload: {
            sessionId: session.sessionId,
            events: records.length,
            answer: answer.content,
          },
        });
      }

      return {
        role: args.role || "",
        task: args.task,
        answer: answer.content,
        events: records.length,
        sessionId: session.sessionId,
        sessionDir: session.sessionDir,
        sessionFile: session.sessionFile,
        sessionArchiveFile: session.sessionArchiveFile,
        tools: childTools,
      };
    }
  );
}
