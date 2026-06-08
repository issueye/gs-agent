import { parseSkillDocument } from "../../../gs-agent/src/agent/skills/spec";

let fs = require("@std/fs");
let path = require("@std/path");
let toml = require("@std/toml");

function readJSONFile(file, fallback) {
  if (!fs.existsSync(file)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(file));
}

function listDirs(root) {
  if (!fs.existsSync(root)) {
    return [];
  }
  let out = [];
  let entries = fs.readdirSync(root, { withFileTypes: true });
  for (let entry of entries) {
    if (entry.isDirectory()) {
      out.push(entry.name);
    }
  }
  return out;
}

function parseSkillFrontmatter(content) {
  try {
    return parseSkillDocument(content).metadata;
  } catch (error) {
    return {};
  }
}

export function createAgentModel(agentRoot) {
  function agentFile(parts) {
    let out = agentRoot;
    for (let part of parts) {
      out = path.join(out, part);
    }
    return out;
  }

  function summary() {
    return {
      root: agentRoot,
      exists: fs.existsSync(agentRoot),
      project: readJSONFile(agentFile([".agent", "current-session.json"]), undefined),
      skillCount: listSkills().length,
      pluginCount: listPlugins().length,
      dynamicToolCount: listDynamicTools().length,
      sessionCount: listSessions(20).length,
    };
  }

  function listSkills() {
    let root = agentFile([".agent", "skills"]);
    let out = [];
    for (let name of listDirs(root)) {
      let file = path.join(root, name, "SKILL.md");
      if (!fs.existsSync(file)) {
        continue;
      }
      let content = fs.readFileSync(file);
      let meta = parseSkillFrontmatter(content);
      out.push({
        name: meta.name || name,
        description: meta.description || "",
        dir: path.join(root, name),
        file: file,
      });
    }
    return out;
  }

  function readSkill(name) {
    let file = agentFile([".agent", "skills", String(name), "SKILL.md"]);
    if (!fs.existsSync(file)) {
      return undefined;
    }
    let content = fs.readFileSync(file);
    let meta = parseSkillFrontmatter(content);
    return {
      name: meta.name || String(name),
      description: meta.description || "",
      file: file,
      content: content,
    };
  }

  function listDynamicTools() {
    let root = agentFile([".agent", "tools"]);
    let out = [];
    for (let name of listDirs(root)) {
      let file = path.join(root, name, "tool.toml");
      if (!fs.existsSync(file)) {
        continue;
      }
      let manifest = toml.readFileSync(file);
      out.push({
        name: manifest.name || name,
        description: manifest.description || "",
        entry: manifest.entry || "main.gs",
        dir: path.join(root, name),
        manifestFile: file,
      });
    }
    return out;
  }

  function listPlugins() {
    let root = agentFile([".agent", "plugins"]);
    let out = [];
    for (let name of listDirs(root)) {
      out.push({
        name: name,
        dir: path.join(root, name),
      });
    }
    return out;
  }

  function listSessions(limit) {
    let root = agentFile([".agent", "sessions"]);
    let names = listDirs(root);
    names.sort(function(a, b) {
      if (a < b) {
        return -1;
      }
      if (a > b) {
        return 1;
      }
      return 0;
    });
    names.reverse();
    let out = [];
    let max = Number(limit || 50);
    for (let i = 0; i < names.length && i < max; i = i + 1) {
      let id = names[i];
      out.push({
        sessionId: id,
        dir: path.join(root, id),
        sessionFile: path.join(root, id, "session.jsonl"),
        answerFile: path.join(root, id, "answer.md"),
      });
    }
    return out;
  }

  function currentSession() {
    return readJSONFile(agentFile([".agent", "current-session.json"]), undefined);
  }

  return {
    root: agentRoot,
    summary: summary,
    listSkills: listSkills,
    readSkill: readSkill,
    listDynamicTools: listDynamicTools,
    listPlugins: listPlugins,
    listSessions: listSessions,
    currentSession: currentSession,
  };
}
