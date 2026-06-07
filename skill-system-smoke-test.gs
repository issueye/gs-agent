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
let smokeDir = path.join(skillsRoot, "smoke-skill");

write(path.join(demoDir, "SKILL.md"), "---\nname: demo\ndescription: Demo skill for smoke tests. Use when validating skill discovery and progressive loading.\n---\n\n# Demo Skill\n\nUse this when testing skill progressive loading.\n");
write(path.join(ignoredDir, "SKILL.md"), "---\nname: ignored\ndescription: Ignored skill.\n---\n\n# Ignored Skill\n\nThis should not be loaded by name filter.\n");
write(path.join(smokeDir, "SKILL.md"), "---\nname: smoke-skill\ndescription: Smoke skill from create-skill tests.\n---\n\n# Smoke Skill\n\nUpdated to the current skill format.\n");

let all = discoverSkills(root, {
  includeSkills: true,
  skillDir: ".agent/skills",
  skills: ["demo", "ignored", "smoke-skill"],
});
assert(all.length >= 2, "wildcard should discover local skills");

let selected = discoverSkills(root, {
  includeSkills: true,
  skillDir: ".agent/skills",
  skills: ["demo"],
});
assert(selected.length === 1, "name filter should select one skill");
assert(selected[0].name === "demo", "frontmatter name should be used");
assert(selected[0].description === "Demo skill for smoke tests. Use when validating skill discovery and progressive loading.", "frontmatter description should be used");
assert(selected[0].triggerKeywords.length === 0, "standard SKILL.md should not require trigger keywords");
assert(selected[0].body.includes("Use this when testing skill progressive loading."), "SKILL.md body should be available");

let rendered = renderSkillsSystem(selected);
assert(rendered.includes("Available skills (metadata only):"), "render should include skill header");
assert(rendered.includes("- demo:"), "render should include skill name");
assert(rendered.includes("description is the primary trigger surface"), "render should describe standard skill frontmatter");
assert(rendered.includes("call create_skill"), "render should instruct models to use create_skill for skills");
assert(rendered.includes("progressive disclosure"), "render should describe progressive loading");
assert(!rendered.includes("Use this when testing skill progressive loading."), "render should not include full skill body");

let system = applySkillsToSystem("Base system.", selected);
assert(system.includes("Base system."), "base system should be preserved");
assert(system.includes("call run_skill with the skill name and task"), "skill index instructions should prefer run_skill");

let disabled = discoverSkills(root, {
  includeSkills: false,
});
assert(disabled.length === 0, "includeSkills=false should disable discovery");

println("skill-system:ok");
