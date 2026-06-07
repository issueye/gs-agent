import { createCodingAgent } from "@/agent/core/kit";
import { createScriptedProvider } from "@/agent/llm/fake";
import { discoverSkills } from "@/agent/skills/loader";
import { createRunSkillTool } from "@/agent/tools/skill-runner";

let fs = require("@std/fs");
let path = require("@std/path");
let process = require("@std/process");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeTextSync(file, text);
}

let root = process.cwd();
let skillDir = path.join(root, ".agent", "skills", "delegate-demo");
write(path.join(skillDir, "SKILL.md"), "---\nname: delegate-demo\ndescription: Demo skill executed by a subagent.\ntrigger_keywords:\n  - delegate\n---\n\n# Delegate Demo\n\nUse this skill only through the run_skill smoke test.\n");

let agentConfig = {
  provider: "fake",
  system: "Parent system.",
  includeCodingTools: true,
  includeSkills: true,
  skillDir: ".agent/skills",
  skills: ["delegate-demo"],
  tools: ["read_file", "list_dir", "grep", "todo", "run_skill"],
};
let config = {
  agent: agentConfig,
};
let skills = discoverSkills(root, agentConfig);
let events = [];
let skillTool = createRunSkillTool({
  root: root,
  config: config,
  agent: agentConfig,
  system: "Parent system with skill index.",
  skills: skills,
  onEvent: function(event) {
    events.push(event);
  },
});

let direct = skillTool.run({
  skill: "delegate-demo",
  task: "Run the demo skill.",
  maxTurns: 2,
});
assert(direct.skill === "delegate-demo", "direct run should return the skill name");
assert(direct.answer.includes("Task file read"), "fake child provider should return its final answer");
assert(fs.existsSync(direct.sessionFile), "skill subagent session file should exist");

events = [];
let parent = createCodingAgent({
  cwd: root,
  includeCodingTools: false,
  includeDynamicTools: false,
  provider: createScriptedProvider([
    {
      kind: "tool_call",
      id: "skill_1",
      name: "run_skill",
      args: {
        skill: "delegate-demo",
        task: "Run the demo skill.",
        maxTurns: 2,
      },
    },
    {
      role: "assistant",
      content: "Parent received skill result.",
    },
  ]),
  tools: [
    skillTool,
  ],
  maxTurns: 4,
});

let answer = parent.agent.run("Use the delegate-demo skill.");
assert(answer.content === "Parent received skill result.", "parent should continue after skill result");

let start = undefined;
let end = undefined;
for (let event of events) {
  if (event.kind === "skill_start") {
    start = event.payload;
  }
  if (event.kind === "skill_end") {
    end = event.payload;
  }
}

assert(start !== undefined, "skill_start should be emitted");
assert(end !== undefined, "skill_end should be emitted");
assert(start.skill === "delegate-demo", "skill_start should include skill name");
assert(end.answer.includes("Task file read"), "skill_end should include child answer");

println("run-skill:ok");
