let fs = require("@std/fs");
let path = require("@std/path");

function makeError(status, code, message) {
  let error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function isNameChar(ch) {
  return (ch >= "a" && ch <= "z")
    || (ch >= "0" && ch <= "9")
    || ch === "-";
}

function validateName(name) {
  let value = String(name || "");
  if (value === "" || value.startsWith("-") || value.endsWith("-")) {
    throw makeError(400, "INVALID_SKILL_NAME", "skill name must use lowercase letters, numbers, and hyphens, without leading or trailing hyphens");
  }
  for (let i = 0; i < value.length; i = i + 1) {
    if (!isNameChar(value[i])) {
      throw makeError(400, "INVALID_SKILL_NAME", "skill name must use lowercase letters, numbers, and hyphens, without leading or trailing hyphens");
    }
  }
  if (value === "." || value === "..") {
    throw makeError(400, "INVALID_SKILL_NAME", "skill name must use lowercase letters, numbers, and hyphens, without leading or trailing hyphens");
  }
  return value;
}

function parseScalar(value) {
  let text = String(value || "").trim();
  if ((text.startsWith("\"") && text.endsWith("\"")) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, text.length - 1);
  }
  return text;
}

function parseSkillFile(content) {
  let text = String(content || "").replaceAll("\r\n", "\n");
  if (!text.startsWith("---\n")) {
    return {
      metadata: {},
      body: text,
    };
  }
  let end = text.indexOf("\n---", 4);
  if (end < 0) {
    return {
      metadata: {},
      body: text,
    };
  }
  let metadata = {};
  let lines = text.slice(4, end).split("\n");
  for (let line of lines) {
    let trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }
    let colon = trimmed.indexOf(":");
    if (colon < 0) {
      continue;
    }
    metadata[trimmed.slice(0, colon).trim()] = parseScalar(trimmed.slice(colon + 1));
  }
  let body = text.slice(end + 5);
  if (body.startsWith("\n")) {
    body = body.slice(1);
  }
  return {
    metadata: metadata,
    body: body,
  };
}

function stripFrontmatter(content) {
  return parseSkillFile(content).body;
}

function frontmatterValue(value) {
  return JSON.stringify(String(value || ""));
}

function skillMarkdown(name, description, content) {
  let body = stripFrontmatter(content || "");
  return "---\nname: " + frontmatterValue(name) + "\ndescription: " + frontmatterValue(description) + "\n---\n" + body;
}

export function createSkillsModel(model) {
  let agentRoot = model.agent && model.agent.root ? model.agent.root : model.config.gateway.agentRoot;
  let skillsRoot = path.join(agentRoot, ".agent", "skills");

  function skillDir(name) {
    return path.join(skillsRoot, name);
  }

  function skillFile(name) {
    return path.join(skillDir(name), "SKILL.md");
  }

  function readExisting(name) {
    let file = skillFile(name);
    if (!fs.existsSync(file)) {
      return undefined;
    }
    let parsed = parseSkillFile(fs.readFileSync(file));
    return {
      name: parsed.metadata.name || name,
      description: parsed.metadata.description || "",
      file: file,
      content: parsed.body,
    };
  }

  function event(type, name, payload) {
    return model.store.addEvent("skill", type, name, payload || {}, "accepted");
  }

  function create(input) {
    let name = validateName(input && input.name);
    let file = skillFile(name);
    if (fs.existsSync(file)) {
      throw makeError(409, "SKILL_EXISTS", "skill already exists");
    }
    let description = String((input && input.description) || "");
    let content = String((input && input.content) || "");
    fs.mkdirSync(skillDir(name), { recursive: true });
    fs.writeFileSync(file, skillMarkdown(name, description, content));
    event("create", name, {
      name: name,
      description: description,
      file: file,
    });
    return readExisting(name);
  }

  function update(name, input) {
    let skillName = validateName(name);
    let existing = readExisting(skillName);
    if (!existing) {
      throw makeError(404, "NOT_FOUND", "skill not found");
    }
    let description = existing.description;
    let content = existing.content;
    if (input && "description" in input) {
      description = String(input.description || "");
    }
    if (input && "content" in input) {
      content = String(input.content || "");
    }
    fs.writeFileSync(skillFile(skillName), skillMarkdown(skillName, description, content));
    event("update", skillName, {
      name: skillName,
      description: description,
      file: skillFile(skillName),
    });
    return readExisting(skillName);
  }

  function remove(name) {
    let skillName = validateName(name);
    let existing = readExisting(skillName);
    if (!existing) {
      throw makeError(404, "NOT_FOUND", "skill not found");
    }
    fs.unlinkSync(skillFile(skillName));
    try {
      fs.rmSync(skillDir(skillName), { recursive: false, force: true });
    } catch (error) {
      // Leave non-empty skill directories intact.
    }
    event("delete", skillName, {
      name: skillName,
      file: existing.file,
    });
    return existing;
  }

  return {
    create: create,
    update: update,
    remove: remove,
    validateName: validateName,
  };
}
