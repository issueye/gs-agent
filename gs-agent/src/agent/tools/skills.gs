import { createTool } from "@/agent/tools/registry";
import { workspacePath } from "@/agent/tools/files";

let fs = require("@std/fs");
let path = require("@std/path");

function isSkillNameChar(ch) {
  return (ch >= "a" && ch <= "z")
    || (ch >= "0" && ch <= "9")
    || ch === "-";
}

function normalizeSkillName(name) {
  let value = String(name || "").trim();
  if (value === "") {
    throw new TypeError("skill name is required");
  }
  if (value.length > 64) {
    throw new TypeError("skill name must be at most 64 characters");
  }
  if (value.startsWith("-") || value.endsWith("-")) {
    throw new TypeError("skill name cannot start or end with hyphen");
  }

  let out = "";
  for (let i = 0; i < value.length; i = i + 1) {
    let ch = value[i];
    if (!isSkillNameChar(ch)) {
      throw new TypeError("skill name may only contain lowercase letters, numbers, and hyphen");
    }
    out = out + ch;
  }

  if (out === "." || out === "..") {
    throw new TypeError("invalid skill name: " + out);
  }
  return out;
}

function yamlString(value) {
  return "\"" + String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\"", "\\\"")
    .replaceAll("\r", " ")
    .replaceAll("\n", " ") + "\"";
}

function defaultSkillContent(name, description) {
  let title = name;
  let intro = "Use this skill when the user's request matches the description in the frontmatter.";
  if (description && description.trim() !== "") {
    intro = description.trim();
  }
  return "# " + title + "\n\n" + intro + "\n\n## Instructions\n\n- Describe the concrete workflow for this skill.\n- Keep guidance concise and procedural.\n- Reference bundled scripts, references, or assets only when they are needed.\n";
}

function hasFrontmatter(content) {
  return String(content || "").replaceAll("\r\n", "\n").startsWith("---\n");
}

function bodyWithoutFrontmatter(content) {
  let text = String(content || "").replaceAll("\r\n", "\n");
  if (!hasFrontmatter(text)) {
    return text;
  }

  let end = text.indexOf("\n---", 4);
  if (end < 0) {
    throw new TypeError("skill content frontmatter is not closed");
  }

  let body = text.slice(end + 4);
  while (body.startsWith("\n")) {
    body = body.slice(1);
  }
  return body;
}

function skillDocument(name, description, content) {
  let body = bodyWithoutFrontmatter(content).trim();
  if (!body || body === "") {
    body = defaultSkillContent(name, description).trim();
  }
  return "---\n"
    + "name: " + yamlString(name) + "\n"
    + "description: " + yamlString(description) + "\n"
    + "---\n\n"
    + body + "\n";
}

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
      let description = String(args.description || "").trim();
      if (description === "") {
        throw new TypeError("skill description is required");
      }
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
