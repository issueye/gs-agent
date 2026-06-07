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
assert(!fs.readFileSync(skillFile).includes("trigger_keywords:"), "SKILL.md should not include non-standard trigger keywords");
assert(fs.readFileSync(skillFile).includes("Use this only for smoke tests."), "skill content should be written");
assert(!fs.existsSync(path.join(skillDir, "skill.toml")), "create_skill should not create skill.toml");
assert(!fs.existsSync(path.join(skillDir, "main.gs")), "create_skill should not create main.gs");

let duplicate = registry.safeCall("create_skill", {
  name: "smoke-skill",
  description: "Duplicate.",
});
assert(duplicate.ok === false, "create_skill should reject duplicates without overwrite");

let invalid = registry.safeCall("create_skill", {
  name: "Bad_Name",
  description: "Invalid name.",
});
assert(invalid.ok === false, "create_skill should reject unsafe names");

let missingDescription = registry.safeCall("create_skill", {
  name: "missing-description",
});
assert(missingDescription.ok === false, "create_skill should require description");

let standardized = registry.safeCall("create_skill", {
  name: "standard-frontmatter",
  description: "Standard frontmatter skill.",
  content: "---\nname: wrong-name\ndescription: Wrong description.\ntrigger_keywords:\n  - old\n---\n\n# Standard Frontmatter\n\nBody survives.",
  overwrite: true,
});
assert(standardized.ok === true, "create_skill should accept content with frontmatter");
let standardFile = path.join(root, ".agent", "skills", "standard-frontmatter", "SKILL.md");
let standardContent = fs.readFileSync(standardFile);
assert(standardContent.includes("name: \"standard-frontmatter\""), "create_skill should own frontmatter name");
assert(standardContent.includes("description: \"Standard frontmatter skill.\""), "create_skill should own frontmatter description");
assert(!standardContent.includes("trigger_keywords:"), "create_skill should strip non-standard frontmatter keys");
assert(standardContent.includes("Body survives."), "create_skill should preserve body after supplied frontmatter");

let overwritten = registry.safeCall("create_skill", {
  name: "smoke-skill",
  description: "Updated smoke test skill.",
  content: "# Updated Smoke Skill\n\nUpdated content.",
  overwrite: true,
});
assert(overwritten.ok === true, "create_skill should overwrite when requested");
assert(fs.readFileSync(skillFile).includes("Updated content."), "skill content should be overwritten");

println("create-skill-tool:ok");
