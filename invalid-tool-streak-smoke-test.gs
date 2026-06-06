import { createAgent } from "@/agent/core/agent";
import { createRegistry } from "@/agent/tools/registry";
import { createWriteFileTool } from "@/agent/tools/files";
import { createScriptedProvider } from "@/agent/llm/fake";

let process = require("@std/process");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

let registry = createRegistry();
registry.register(createWriteFileTool(process.cwd()));

let provider = createScriptedProvider([
  {
    kind: "tool_call",
    name: "write_file",
    args: {},
  },
  {
    kind: "tool_call",
    name: "write_file",
    args: {},
  },
  {
    role: "assistant",
    content: "SHOULD_NOT_REACH",
  },
]);

let agent = createAgent({
  provider: provider,
  registry: registry,
  maxTurns: 5,
});

let answer = agent.run("write a document");
assert(answer.content.includes("repeatedly called write_file"), "agent should stop repeated invalid write_file calls");
assert(answer.content.includes("path, content"), "agent should mention required fields");

println("invalid-tool-streak:ok");
