import { applySkillsToSystem, discoverSkills, renderSkillsSystem } from "@/agent/skills/loader";

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
let skillsRoot = path.join(root, ".agent", "skills");
let demoDir = path.join(skillsRoot, "demo");
let ignoredDir = path.join(skillsRoot, "ignored");

write(path.join(demoDir, "skill.toml"), "name = \"demo\"\ndescription = \"Demo skill for smoke tests.\"\n");
write(path.join(demoDir, "SKILL.md"), "# Demo Skill\n\nUse this when testing skill injection.\n");
write(path.join(ignoredDir, "SKILL.md"), "# Ignored Skill\n\nThis should not be loaded by name filter.\n");

let all = discoverSkills(root, {
  includeSkills: true,
  skillDir: ".agent/skills",
  skills: ["*"],
});
assert(all.length >= 2, "wildcard should discover local skills");

let selected = discoverSkills(root, {
  includeSkills: true,
  skillDir: ".agent/skills",
  skills: ["demo"],
});
assert(selected.length === 1, "name filter should select one skill");
assert(selected[0].name === "demo", "manifest name should be used");
assert(selected[0].description === "Demo skill for smoke tests.", "manifest description should be used");
assert(selected[0].content.includes("Use this when testing skill injection."), "SKILL.md content should be loaded");

let rendered = renderSkillsSystem(selected);
assert(rendered.includes("Available skills:"), "render should include skill header");
assert(rendered.includes("## demo"), "render should include skill name");

let system = applySkillsToSystem("Base system.", selected);
assert(system.includes("Base system."), "base system should be preserved");
assert(system.includes("Use a skill when"), "skill instructions should be appended");

let disabled = discoverSkills(root, {
  includeSkills: false,
});
assert(disabled.length === 0, "includeSkills=false should disable discovery");

println("skill-system:ok");
