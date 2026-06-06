import { createTool } from "@/agent/tools/registry";
import { workspacePath } from "@/agent/tools/files";

let fs = require("@std/fs");
let path = require("@std/path");

function isSkillNameChar(ch) {
  return (ch >= "a" && ch <= "z")
    || (ch >= "A" && ch <= "Z")
    || (ch >= "0" && ch <= "9")
    || ch === "-"
    || ch === "_";
}

function normalizeSkillName(name) {
  let value = String(name || "").trim();
  if (value === "") {
    throw new TypeError("skill name is required");
  }

  let out = "";
  for (let i = 0; i < value.length; i = i + 1) {
    let ch = value[i];
    if (!isSkillNameChar(ch)) {
      throw new TypeError("skill name may only contain letters, numbers, hyphen, and underscore");
    }
    out = out + ch;
  }

  if (out === "." || out === "..") {
    throw new TypeError("invalid skill name: " + out);
  }
  return out;
}

function tomlString(value) {
  return "\"" + String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\"", "\\\"")
    .replaceAll("\r", "\\r")
    .replaceAll("\n", "\\n") + "\"";
}

function defaultSkillContent(name, description) {
  let title = name;
  if (description && description.trim() !== "") {
    return "# " + title + "\n\n" + description.trim() + "\n\n## Instructions\n\n- Add the concrete workflow for this skill here.\n";
  }
  return "# " + title + "\n\n## Instructions\n\n- Add the concrete workflow for this skill here.\n";
}

export function createCreateSkillTool(cwd) {
  return createTool(
    "create_skill",
    "Create a local agent skill under .agent/skills/<name>. Writes skill.toml and SKILL.md. Use overwrite=true only when replacing an existing skill intentionally.",
    {
      type: "object",
      required: ["name"],
      additionalProperties: false,
      properties: {
        name: { type: "string", minLength: 1 },
        description: { type: "string" },
        content: { type: "string" },
        overwrite: { type: "boolean" },
      },
    },
    function(args) {
      let name = normalizeSkillName(args.name);
      let description = args.description || "";
      let content = args.content;
      if (!content || content.trim() === "") {
        content = defaultSkillContent(name, description);
      }

      let skillDir = workspacePath(cwd, path.join(".agent", "skills", name));
      let manifestFile = path.join(skillDir, "skill.toml");
      let skillFile = path.join(skillDir, "SKILL.md");
      if (!args.overwrite && (fs.existsSync(manifestFile) || fs.existsSync(skillFile))) {
        throw new ReferenceError("skill already exists: " + name + " (set overwrite=true to replace it)");
      }

      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeTextSync(
        manifestFile,
        "name = " + tomlString(name) + "\n"
          + "description = " + tomlString(description) + "\n"
      );
      fs.writeTextSync(skillFile, content.trim() + "\n");

      return {
        name: name,
        description: description,
        dir: path.join(".agent", "skills", name),
        manifestFile: path.join(".agent", "skills", name, "skill.toml"),
        skillFile: path.join(".agent", "skills", name, "SKILL.md"),
        overwritten: !!args.overwrite,
      };
    }
  );
}
