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
let skillDir = path.join(root, ".agent", "skills", "smoke_skill");
let manifestFile = path.join(skillDir, "skill.toml");
let skillFile = path.join(skillDir, "SKILL.md");

let registry = createRegistry();
registry.register(createCreateSkillTool(root));

let created = registry.safeCall("create_skill", {
  name: "smoke_skill",
  description: "Smoke test skill.",
  content: "# Smoke Skill\n\nUse this only for smoke tests.",
  overwrite: true,
});
assert(created.ok === true, "create_skill should create a skill");
assert(fs.existsSync(manifestFile), "skill.toml should exist");
assert(fs.existsSync(skillFile), "SKILL.md should exist");
assert(fs.readFileSync(skillFile).includes("Use this only for smoke tests."), "skill content should be written");

let duplicate = registry.safeCall("create_skill", {
  name: "smoke_skill",
  description: "Duplicate.",
});
assert(duplicate.ok === false, "create_skill should reject duplicates without overwrite");

let invalid = registry.safeCall("create_skill", {
  name: "../bad",
});
assert(invalid.ok === false, "create_skill should reject unsafe names");

let overwritten = registry.safeCall("create_skill", {
  name: "smoke_skill",
  description: "Updated smoke test skill.",
  content: "# Updated Smoke Skill\n\nUpdated content.",
  overwrite: true,
});
assert(overwritten.ok === true, "create_skill should overwrite when requested");
assert(fs.readFileSync(skillFile).includes("Updated content."), "skill content should be overwritten");

println("create-skill-tool:ok");
