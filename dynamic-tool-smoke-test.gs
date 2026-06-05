import { createCodingAgent } from "@/agent/core/kit";
import { createScriptedProvider } from "@/agent/llm/fake";
import { createDynamicTools, discoverDynamicTools } from "@/agent/tools/dynamic";

let fs = require("@std/fs");
let path = require("@std/path");
let process = require("@std/process");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  let root = process.cwd();
  let toolDir = path.join(root, ".agent", "tools", "echo_dynamic");
  fs.mkdirSync(toolDir, { recursive: true });
  fs.writeTextSync(path.join(toolDir, "tool.toml"), [
    'name = "echo_dynamic"',
    'description = "Echo a message with a prefix from an external GoScript tool."',
    'entry = "main.gs"',
    "",
    "[[params]]",
    'name = "message"',
    'type = "string"',
    "required = true",
    'description = "Message to echo"',
    "",
  ].join("\n"));
  fs.writeTextSync(path.join(toolDir, "main.gs"), [
    "exports.run = function(input) {",
    "  return {",
    "    ok: true,",
    '    result: "dynamic:" + input.message',
    "  };",
    "};",
    "",
  ].join("\n"));

  let definitions = discoverDynamicTools(root);
  let found = false;
  for (let definition of definitions) {
    if (definition.name === "echo_dynamic") {
      found = true;
      assert(definition.inputSchema.required[0] === "message", "dynamic schema required");
    }
  }
  assert(found, "dynamic tool discovered");

  let tools = createDynamicTools(root);
  let direct = undefined;
  for (let tool of tools) {
    if (tool.name === "echo_dynamic") {
      direct = tool.run({ message: "hello" });
    }
  }
  assert(direct.result === "dynamic:hello", "dynamic tool direct run");

  let provider = createScriptedProvider([
    {
      kind: "tool_call",
      name: "echo_dynamic",
      args: { message: "agent" },
    },
    {
      role: "assistant",
      content: "DYNAMIC_TOOL_OK",
    },
  ]);
  let kit = createCodingAgent({
    cwd: root,
    includeCodingTools: false,
    provider: provider,
    maxTurns: 3,
  });
  let listed = kit.registry.list();
  let listedDynamic = false;
  for (let item of listed) {
    if (item.name === "echo_dynamic") {
      listedDynamic = true;
    }
  }
  assert(listedDynamic, "dynamic tool listed to provider");

  let answer = kit.agent.run("Use dynamic tool.");
  assert(answer.content === "DYNAMIC_TOOL_OK", "dynamic tool agent loop");

  println("dynamic-tool:ok");
}

main();
