import { createRegistry } from "@/agent/tools/registry";
import { createWriteFileTool, createAppendFileTool } from "@/agent/tools/files";

let process = require("@std/process");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

let root = process.cwd();
let registry = createRegistry();
registry.register(createWriteFileTool(root));
registry.register(createAppendFileTool(root));

let directSkillFile = registry.safeCall("write_file", {
  path: ".agent/skills/SKILL.md",
  content: "# Wrong\n",
});
assert(directSkillFile.ok === false, "write_file should reject direct .agent/skills/SKILL.md writes");
assert(String(directSkillFile.error).includes("Use create_skill"), "write_file error should direct the model to create_skill");

let nestedSkillFile = registry.safeCall("write_file", {
  path: ".agent/skills/query-weather/SKILL.md",
  content: "# Wrong\n",
});
assert(nestedSkillFile.ok === false, "write_file should reject nested skill writes");

let appendSkillFile = registry.safeCall("append_file", {
  path: ".agent/skills/query-weather/SKILL.md",
  content: "More\n",
});
assert(appendSkillFile.ok === false, "append_file should reject skill writes");

let normalWrite = registry.safeCall("write_file", {
  path: "workspace/skill-write-guard.tmp",
  content: "ok\n",
});
assert(normalWrite.ok === true, "write_file should still allow ordinary workspace files");

println("skill-write-guard:ok");
