import { createTool } from "@/agent/tools/registry";
import { workspacePath } from "@/agent/tools/files";
import { normalizeSkillDescription, normalizeSkillName, skillDocument } from "@/agent/skills/spec";

let fs = require("@std/fs");
let path = require("@std/path");

export function createCreateSkillTool(cwd) {
  return createTool(
    "create_skill",
    "Create a local agent skill under .agent/skills/<name>. Always writes exactly one standards-compliant .agent/skills/<name>/SKILL.md file. The SKILL.md YAML frontmatter contains only name and description. Never create skill.toml or main.gs for a skill. Use overwrite=true only when replacing an existing skill intentionally.",
    {
      type: "object",
      required: ["name", "description"],
      additionalProperties: false,
      properties: {
        name: { type: "string", minLength: 1 },
        description: { type: "string", minLength: 1 },
        content: { type: "string" },
        overwrite: { type: "boolean" },
      },
    },
    function(args) {
      let name = normalizeSkillName(args.name);
      let description = normalizeSkillDescription(args.description);
      let content = skillDocument(name, description, args.content);

      let skillDir = workspacePath(cwd, path.join(".agent", "skills", name));
      let skillFile = path.join(skillDir, "SKILL.md");
      if (!args.overwrite && fs.existsSync(skillFile)) {
        throw new ReferenceError("skill already exists: " + name + " (set overwrite=true to replace it)");
      }

      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeTextSync(skillFile, content);

      return {
        name: name,
        description: description,
        dir: path.join(".agent", "skills", name),
        skillFile: path.join(".agent", "skills", name, "SKILL.md"),
        overwritten: !!args.overwrite,
      };
    }
  );
}
