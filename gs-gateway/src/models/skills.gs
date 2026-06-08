import {
  normalizeSkillName,
  normalizeSkillDescription,
  parseSkillDocument,
  skillDocument,
} from "../../../gs-agent/src/agent/skills/spec";

let fs = require("@std/fs");
let path = require("@std/path");

function makeError(status, code, message) {
  return new Error("GATEWAY_ERROR|" + String(status) + "|" + code + "|" + message);
}

function validateName(name) {
  try {
    return normalizeSkillName(name);
  } catch (error) {
    throw makeError(400, "INVALID_SKILL_NAME", "skill name must use lowercase letters, numbers, and hyphens, without leading or trailing hyphens");
  }
}

function validateDescription(description) {
  try {
    return normalizeSkillDescription(description);
  } catch (error) {
    throw makeError(400, "INVALID_SKILL_DESCRIPTION", "skill description is required");
  }
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
    let parsed = parseSkillDocument(fs.readFileSync(file));
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
    let description = String((input && input.description) || "");
    description = validateDescription(description);
    let file = skillFile(name);
    if (fs.existsSync(file)) {
      throw makeError(409, "SKILL_EXISTS", "skill already exists");
    }
    let content = String((input && input.content) || "");
    fs.mkdirSync(skillDir(name), { recursive: true });
    fs.writeFileSync(file, skillDocument(name, description, content));
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
      description = validateDescription(description);
    }
    if (input && "content" in input) {
      content = String(input.content || "");
    }
    fs.writeFileSync(skillFile(skillName), skillDocument(skillName, description, content));
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
