let fs = require("@std/fs");
let path = require("@std/path");
let toml = require("@std/toml");

function defaultOptions() {
  return {
    enabled: true,
    dir: ".agent/skills",
    names: ["*"],
    maxCharsPerSkill: 8000,
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
    maxCharsPerSkill: defaults.maxCharsPerSkill,
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
  if (agent.maxSkillChars) {
    options.maxCharsPerSkill = agent.maxSkillChars;
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

function readOptionalManifest(skillDir) {
  let file = path.join(skillDir, "skill.toml");
  if (!fs.existsSync(file)) {
    return {};
  }
  let manifest = toml.readFileSync(file);
  manifest.__file = file;
  return manifest;
}

function clipContent(content, maxChars) {
  if (!maxChars || content.length <= maxChars) {
    return content;
  }
  return content.slice(0, maxChars) + "\n\n[Skill content truncated by maxSkillChars.]";
}

function normalizeSkill(dirName, skillDir, manifest, maxChars) {
  let file = path.join(skillDir, "SKILL.md");
  if (!fs.existsSync(file)) {
    return undefined;
  }

  let name = manifest.name || dirName;
  let description = manifest.description || "";
  let content = clipContent(fs.readFileSync(file), maxChars);
  return {
    name: name,
    description: description,
    dir: skillDir,
    file: file,
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
    let manifest = readOptionalManifest(skillDir);
    let skill = normalizeSkill(entry.name, skillDir, manifest, options.maxCharsPerSkill);
    if (skill) {
      out.push(skill);
    }
  }

  return out;
}

function renderSkill(skill) {
  let header = "## " + skill.name;
  if (skill.description) {
    header = header + "\nDescription: " + skill.description;
  }
  return header + "\nSource: " + skill.file + "\n\n" + skill.content;
}

export function renderSkillsSystem(skills) {
  if (!skills || skills.length === 0) {
    return "";
  }

  let blocks = [];
  for (let skill of skills) {
    blocks.push(renderSkill(skill));
  }

  return "Available skills:\n"
    + "Use a skill when the user's request matches its name, description, or instructions. "
    + "Follow the skill's SKILL.md instructions while still obeying the main agent system message.\n\n"
    + blocks.join("\n\n---\n\n");
}

export function applySkillsToSystem(system, skills) {
  let rendered = renderSkillsSystem(skills);
  if (rendered === "") {
    return system;
  }
  return String(system || "") + "\n\n" + rendered;
}
