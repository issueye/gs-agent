import { createRegistry } from "@/agent/tools/registry";
import { createCreateSkillTool } from "@/agent/tools/skills";
import { createRunSkillTool } from "@/agent/tools/skill-runner";

let path = require("@std/path");
let process = require("@std/process");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

let root = process.cwd();
let agentConfig = {
  provider: "fake",
  system: "Parent system.",
  includeCodingTools: true,
  includeSkills: true,
  skillDir: ".agent/skills",
  skills: ["*"],
  tools: ["read_file", "list_dir", "grep", "todo", "create_skill", "run_skill"],
};
let config = {
  agent: agentConfig,
};

let registry = createRegistry();
registry.register(createCreateSkillTool(root));
registry.register(createRunSkillTool({
  root: root,
  config: config,
  agent: agentConfig,
  system: "Parent system with skill index.",
  skills: [],
}));

let created = registry.safeCall("create_skill", {
  name: "instant-skill",
  description: "Instant skill for same-session refresh tests.",
  content: "# Instant Skill\n\nUse this skill only for same-session refresh tests.",
  overwrite: true,
});
assert(created.ok === true, "create_skill should create instant-skill: " + String(created.error));
assert(created.result.skillFile === path.join(".agent", "skills", "instant-skill", "SKILL.md"), "create_skill should return the standard SKILL.md path");

let result = registry.safeCall("run_skill", {
  skill: "instant-skill",
  task: "Run the instant skill immediately after creation.",
  maxTurns: 2,
});
assert(result.ok === true, "run_skill should rediscover newly created skills: " + String(result.error));
assert(result.result.skill === "instant-skill", "run_skill should execute the newly created skill");
assert(result.result.answer.includes("Task file read"), "fake child provider should return its final answer");

println("run-skill-refresh:ok");
