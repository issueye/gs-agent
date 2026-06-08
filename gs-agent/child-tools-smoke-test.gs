import { childAgentTools } from "@/agent/tools/child-tools";
import { createCodingAgent } from "@/agent/core/kit";
import { createScriptedProvider } from "@/agent/llm/fake";

let process = require("@std/process");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

let parentTools = ["read_file", "list_dir", "grep", "write_file", "bash", "todo", "create_skill", "run_subagent", "run_skill"];
let childTools = childAgentTools(parentTools);
assert(childTools.includes("read_file"), "child should inherit read_file");
assert(childTools.includes("write_file"), "child should inherit write_file");
assert(childTools.includes("bash"), "child should inherit bash");
assert(!childTools.includes("create_skill"), "child should not inherit create_skill");
assert(!childTools.includes("run_subagent"), "child should not inherit run_subagent");
assert(!childTools.includes("run_skill"), "child should not inherit run_skill");

let explicit = childAgentTools(parentTools, ["read_file", "create_skill", "run_subagent", "run_skill", "bash"]);
assert(explicit.length === 2, "explicit child tools should filter blocked tools");
assert(explicit.includes("read_file"), "explicit child tools should keep read_file");
assert(explicit.includes("bash"), "explicit child tools should keep bash");

let rejected = false;
try {
  childAgentTools(parentTools, ["missing_tool"]);
} catch (err) {
  rejected = String(err).includes("not enabled");
}
assert(rejected, "child tools should reject tools not enabled for the parent");

let kit = createCodingAgent({
  cwd: process.cwd(),
  includeCodingTools: true,
  enabledTools: childTools,
  includeDynamicTools: true,
  provider: createScriptedProvider([
    {
      role: "assistant",
      content: "done",
    },
  ]),
  maxTurns: 1,
});

let names = [];
for (let tool of kit.registry.list()) {
  names.push(tool.name);
}
assert(names.includes("web_fetch"), "child agent should receive discovered dynamic tools such as web_fetch");
assert(!names.includes("create_skill"), "child registry should not include create_skill");
assert(!names.includes("run_subagent"), "child registry should not include run_subagent");

println("child-tools:ok");
