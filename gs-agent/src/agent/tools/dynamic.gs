import { createTool } from "@/agent/tools/registry";

let fs = require("@std/fs");
let path = require("@std/path");
let toml = require("@std/toml");

function defaultSchema() {
  return {
    type: "object",
    additionalProperties: true,
    properties: {},
  };
}

function paramSchema(param) {
  let out = {
    type: param.type || "string",
  };
  if (param.description) {
    out.description = param.description;
  }
  return out;
}

// 将 tool.toml 的 params 数组转换为 LLM 工具 schema。
function schemaFromManifest(manifest) {
  if (manifest.inputSchema) {
    return manifest.inputSchema;
  }

  if (!manifest.params) {
    return defaultSchema();
  }

  let required = [];
  let properties = {};
  for (let param of manifest.params) {
    if (!param.name) {
      continue;
    }
    properties[param.name] = paramSchema(param);
    if (param.required) {
      required.push(param.name);
    }
  }

  return {
    type: "object",
    required: required,
    additionalProperties: false,
    properties: properties,
  };
}

function toolManifestPath(toolDir) {
  return path.join(toolDir, "tool.toml");
}

function readManifest(toolDir) {
  let file = toolManifestPath(toolDir);
  if (!fs.existsSync(file)) {
    return undefined;
  }
  let manifest = toml.readFileSync(file);
  manifest.__dir = toolDir;
  manifest.__file = file;
  return manifest;
}

function normalizeManifest(manifest) {
  if (!manifest.name) {
    throw new TypeError("dynamic tool missing name: " + manifest.__file);
  }
  if (!manifest.description) {
    throw new TypeError("dynamic tool missing description: " + manifest.__file);
  }

  let entry = manifest.entry || "main.gs";
  let entryPath = path.resolve(path.join(manifest.__dir, entry));
  return {
    name: manifest.name,
    description: manifest.description,
    inputSchema: schemaFromManifest(manifest),
    entry: entryPath,
    dir: manifest.__dir,
    manifestFile: manifest.__file,
  };
}

// 动态工具脚本运行在独立 VM 中，避免工具里的全局变量污染主 agent。
export function createDynamicTool(definition, cwd) {
  return createTool(
    definition.name,
    definition.description,
    definition.inputSchema,
    function(args) {
      let runtime = require("@std/runtime");
      return runtime.runTool(definition.entry, args, {
        cwd: cwd,
        argv: ["agent", definition.name],
      });
    }
  );
}

// 从 .agent/tools/*/tool.toml 发现动态工具。
export function discoverDynamicTools(root) {
  let toolsDir = path.join(root, ".agent", "tools");
  if (!fs.existsSync(toolsDir)) {
    return [];
  }

  let out = [];
  let entries = fs.readdirSync(toolsDir, { withFileTypes: true });
  for (let entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    let manifest = readManifest(path.join(toolsDir, entry.name));
    if (!manifest) {
      continue;
    }
    out.push(normalizeManifest(manifest));
  }
  return out;
}

export function createDynamicTools(root) {
  let definitions = discoverDynamicTools(root);
  let tools = [];
  for (let definition of definitions) {
    tools.push(createDynamicTool(definition, root));
  }
  return tools;
}
