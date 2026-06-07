let fs = require("@std/fs");
let path = require("@std/path");

function defaultOptions() {
  return {
    enabled: true,
    dir: ".agent/skills",
    names: ["*"],
  };
}

function asList(value, fallback) {
  if (value === undefined) {
    return fallback;
  }
  if (Array.isArray(value)) {
    return value;
  }
  return [String(value)];
}

function configuredOptions(agent) {
  let defaults = defaultOptions();
  let options = {
    enabled: defaults.enabled,
    dir: defaults.dir,
    names: defaults.names,
  };

  if (!agent) {
    return options;
  }

  if ("includeSkills" in agent) {
    options.enabled = !!agent.includeSkills;
  }
  if (agent.skillDir) {
    options.dir = agent.skillDir;
  }
  if (agent.skills) {
    options.names = asList(agent.skills, defaults.names);
  }
  return options;
}

function contains(list, value) {
  if (!list) {
    return false;
  }
  for (let item of list) {
    if (item === value || item === "*") {
      return true;
    }
  }
  return false;
}

function isSkillNameChar(ch) {
  return (ch >= "a" && ch <= "z")
    || (ch >= "0" && ch <= "9")
    || ch === "-";
}

function validSkillName(name) {
  let value = String(name || "");
  if (value === "" || value.length > 64) {
    return false;
  }
  if (value.startsWith("-") || value.endsWith("-")) {
    return false;
  }
  for (let i = 0; i < value.length; i = i + 1) {
    if (!isSkillNameChar(value[i])) {
      return false;
    }
  }
  return true;
}

function parseScalar(value) {
  let text = String(value || "").trim();
  if ((text.startsWith("\"") && text.endsWith("\"")) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, text.length - 1);
  }
  return text;
}

function parseFrontmatter(text, file) {
  let normalized = String(text || "").replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) {
    throw new TypeError("skill missing YAML frontmatter: " + file);
  }

  let end = normalized.indexOf("\n---", 4);
  if (end < 0) {
    throw new TypeError("skill frontmatter is not closed: " + file);
  }

  let yaml = normalized.slice(4, end).trim();
  let body = normalized.slice(end + 4);
  while (body.startsWith("\n")) {
    body = body.slice(1);
  }

  let metadata = {};
  let lines = yaml.split("\n");
  let currentList = "";
  for (let i = 0; i < lines.length; i = i + 1) {
    let line = lines[i];
    let trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }
    if (trimmed.startsWith("- ") && currentList !== "") {
      metadata[currentList].push(parseScalar(trimmed.slice(2)));
      continue;
    }

    currentList = "";
    let colon = trimmed.indexOf(":");
    if (colon < 0) {
      continue;
    }
    let key = trimmed.slice(0, colon).trim();
    let value = trimmed.slice(colon + 1).trim();
    if (value === ">-" || value === ">") {
      let folded = [];
      i = i + 1;
      while (i < lines.length) {
        let next = lines[i];
        if (!next.startsWith(" ") && !next.startsWith("\t")) {
          i = i - 1;
          break;
        }
        let part = next.trim();
        if (part !== "") {
          folded.push(part);
        }
        i = i + 1;
      }
      metadata[key] = folded.join(" ");
      continue;
    }
    if (value === "") {
      metadata[key] = [];
      currentList = key;
    } else {
      metadata[key] = parseScalar(value);
    }
  }

  return {
    metadata: metadata,
    body: body,
  };
}

function normalizeSkill(dirName, skillDir) {
  let file = path.join(skillDir, "SKILL.md");
  if (!fs.existsSync(file)) {
    return undefined;
  }

  let content = fs.readFileSync(file);
  let parsed = parseFrontmatter(content, file);
  let name = parsed.metadata.name || dirName;
  let description = parsed.metadata.description || "";
  if (String(name).trim() === "") {
    throw new TypeError("skill frontmatter missing name: " + file);
  }
  if (!validSkillName(String(name))) {
    throw new TypeError("skill frontmatter name must use lowercase letters, numbers, and hyphen: " + file);
  }
  if (String(description).trim() === "") {
    throw new TypeError("skill frontmatter missing description: " + file);
  }

  return {
    name: name,
    description: description,
    triggerKeywords: parsed.metadata.trigger_keywords || [],
    dir: skillDir,
    file: file,
    body: parsed.body,
    content: content,
  };
}

export function discoverSkills(root, agent) {
  let options = configuredOptions(agent);
  if (!options.enabled) {
    return [];
  }

  let skillsDir = path.resolve(path.join(root, options.dir));
  if (!fs.existsSync(skillsDir)) {
    return [];
  }

  let out = [];
  let entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (let entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (!contains(options.names, entry.name)) {
      continue;
    }

    let skillDir = path.join(skillsDir, entry.name);
    let skill = normalizeSkill(entry.name, skillDir);
    if (skill) {
      out.push(skill);
    }
  }

  return out;
}

function renderSkillIndex(skill) {
  let text = "- " + skill.name + ": " + skill.description + "\n  path: " + skill.file;
  if (skill.triggerKeywords && skill.triggerKeywords.length > 0) {
    text = text + "\n  trigger_keywords: " + skill.triggerKeywords.join(", ");
  }
  return text;
}

export function renderSkillsSystem(skills) {
  if (!skills || skills.length === 0) {
    return "";
  }

  let blocks = [];
  for (let skill of skills) {
    blocks.push(renderSkillIndex(skill));
  }

  return "Available skills (metadata only):\n"
    + "Each skill is a folder containing SKILL.md with YAML frontmatter. "
    + "Use a skill when the user's request matches its name, description, or trigger keywords. "
    + "When run_skill is available and a skill is relevant, call run_skill with the skill name and task so a subagent can execute that skill. "
    + "If run_skill is not available, read its SKILL.md file before acting and follow its Markdown instructions. "
    + "Do not load every skill body up front; use progressive disclosure.\n\n"
    + blocks.join("\n");
}

export function applySkillsToSystem(system, skills) {
  let rendered = renderSkillsSystem(skills);
  if (rendered === "") {
    return system;
  }
  return String(system || "") + "\n\n" + rendered;
}
