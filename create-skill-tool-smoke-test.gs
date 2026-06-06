import { createRegistry } from "@/agent/tools/registry";
import { createCreateSkillTool } from "@/agent/tools/skills";

let fs = require("@std/fs");
let path = require("@std/path");
let process = require("@std/process");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

let root = process.cwd();
let skillDir = path.join(root, ".agent", "skills", "smoke-skill");
let skillFile = path.join(skillDir, "SKILL.md");

let registry = createRegistry();
registry.register(createCreateSkillTool(root));

let created = registry.safeCall("create_skill", {
  name: "smoke-skill",
  description: "Smoke test skill.",
  content: "# Smoke Skill\n\nUse this only for smoke tests.",
  overwrite: true,
});
assert(created.ok === true, "create_skill should create a skill");
assert(fs.existsSync(skillFile), "SKILL.md should exist");
assert(fs.readFileSync(skillFile).startsWith("---\n"), "SKILL.md should start with YAML frontmatter");
assert(fs.readFileSync(skillFile).includes("name: \"smoke-skill\""), "SKILL.md should include frontmatter name");
assert(fs.readFileSync(skillFile).includes("description: \"Smoke test skill.\""), "SKILL.md should include frontmatter description");
assert(fs.readFileSync(skillFile).includes("Use this only for smoke tests."), "skill content should be written");

let duplicate = registry.safeCall("create_skill", {
  name: "smoke-skill",
  description: "Duplicate.",
});
assert(duplicate.ok === false, "create_skill should reject duplicates without overwrite");

let invalid = registry.safeCall("create_skill", {
  name: "Bad_Name",
});
assert(invalid.ok === false, "create_skill should reject unsafe names");

let overwritten = registry.safeCall("create_skill", {
  name: "smoke-skill",
  description: "Updated smoke test skill.",
  content: "# Updated Smoke Skill\n\nUpdated content.",
  overwrite: true,
});
assert(overwritten.ok === true, "create_skill should overwrite when requested");
assert(fs.readFileSync(skillFile).includes("Updated content."), "skill content should be overwritten");

println("create-skill-tool:ok");
