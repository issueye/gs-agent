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

function defaultSkillTools(parentTools) {
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
    return defaultSkillTools(parentTools);
  }
  if (requested.length === 0) {
    return defaultSkillTools(parentTools);
  }

  let out = [];
  for (let tool of requested) {
    if (tool === "run_subagent" || tool === "run_skill") {
      continue;
    }
    if (!includes(parentTools, tool)) {
      throw new ReferenceError("skill subagent tool is not enabled for parent agent: " + tool);
    }
    out.push(tool);
  }
  return out;
}

function findSkill(skills, name) {
  for (let skill of skills || []) {
    if (skill.name === name) {
      return skill;
    }
  }
  return undefined;
}

function skillNames(skills) {
  let out = [];
  for (let skill of skills || []) {
    out.push(skill.name);
  }
  return out;
}

function skillSystem(baseSystem, skill, task) {
  let text = String(baseSystem || "");
  text = text + "\n\nYou are running as a subagent executing a local skill.";
  text = text + "\nSkill name: " + skill.name;
  text = text + "\nSkill file: " + skill.file;
  text = text + "\nFollow the full SKILL.md instructions below for this delegated task.";
  text = text + "\n\n--- SKILL.md ---\n" + skill.content.trim() + "\n--- END SKILL.md ---";
  text = text + "\n\nDelegated task:\n" + String(task || "").trim();
  text = text + "\n\nReturn a concise result with key findings, changed files if any, and any blockers.";
  return text;
}

export function createRunSkillTool(options) {
  let root = options.root;
  let config = options.config;
  let parentAgent = options.agent;
  let baseSystem = options.system || parentAgent.system;
  let contextTokenThreshold = options.contextTokenThreshold;
  let onEvent = options.onEvent;
  let skills = options.skills || [];

  return createTool(
    "run_skill",
    "Execute one discovered local skill in a synchronous child agent. The child receives the selected SKILL.md content in its system prompt and returns its final answer.",
    {
      type: "object",
      required: ["skill", "task"],
      additionalProperties: false,
      properties: {
        skill: { type: "string", minLength: 1 },
        task: { type: "string", minLength: 1 },
        maxTurns: { type: "integer", minimum: 1, maximum: 12 },
        tools: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    function(args) {
      let skill = findSkill(skills, String(args.skill || ""));
      if (!skill) {
        throw new ReferenceError("unknown skill: " + String(args.skill || "") + " (available: " + skillNames(skills).join(", ") + ")");
      }

      let maxTurns = args.maxTurns || 6;
      let childTools = normalizeRequestedTools(parentAgent.tools, args.tools);
      let session = createAgentSession(root);
      let childSystem = skillSystem(baseSystem, skill, args.task);
      let childAgentConfig = cloneAgentConfig(parentAgent, childSystem, maxTurns);
      childAgentConfig.tools = childTools;

      if (onEvent) {
        onEvent({
          kind: "skill_start",
          payload: {
            skill: skill.name,
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
              kind: "skill_subagent_event",
              payload: {
                skill: skill.name,
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
          kind: "skill_end",
          payload: {
            skill: skill.name,
            sessionId: session.sessionId,
            events: records.length,
            answer: answer.content,
          },
        });
      }

      return {
        skill: skill.name,
        skillFile: skill.file,
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
