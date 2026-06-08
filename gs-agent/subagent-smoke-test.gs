import { createCodingAgent } from "@/agent/core/kit";
import { createScriptedProvider } from "@/agent/llm/fake";
import { createRegistry } from "@/agent/tools/registry";
import { createRunSubagentTool } from "@/agent/tools/subagent";

let fs = require("@std/fs");
let path = require("@std/path");
let process = require("@std/process");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

let root = process.cwd();
let childConfig = {
  agent: {
    provider: "fake",
    system: "Parent system.",
    includeCodingTools: true,
    tools: ["read_file", "list_dir", "grep", "todo", "run_subagent"],
  },
};
let parentAgent = {
  provider: "fake",
  system: "Parent system.",
  includeCodingTools: true,
  tools: ["read_file", "list_dir", "grep", "todo", "run_subagent"],
};
let events = [];
let subagentTool = createRunSubagentTool({
  root: root,
  config: childConfig,
  agent: parentAgent,
  system: parentAgent.system,
  onEvent: function(event) {
    events.push(event);
  },
});

let registry = createRegistry();
registry.register(subagentTool);
let direct = registry.safeCall("run_subagent", {
  role: "explorer",
  task: "Inspect the project structure and summarize it.",
  maxTurns: 2,
});
assert(direct.ok === true, "direct subagent tool call should succeed: " + String(direct.error));
events = [];

let parent = createCodingAgent({
  cwd: root,
  includeCodingTools: false,
  includeDynamicTools: false,
  provider: createScriptedProvider([
    {
      kind: "tool_call",
      id: "subagent_1",
      name: "run_subagent",
      args: {
        role: "explorer",
        task: "Inspect the project structure and summarize it.",
        maxTurns: 2,
      },
    },
    {
      role: "assistant",
      content: "Parent received subagent result.",
    },
  ]),
  tools: [
    subagentTool,
  ],
  maxTurns: 4,
});

let answer = parent.agent.run("Delegate a small inspection task.");
assert(answer.content === "Parent received subagent result.", "parent should continue after subagent result");
assert(events.length > 0, "subagent should emit events");

let start = undefined;
let end = undefined;
for (let event of events) {
  if (event.kind === "subagent_start") {
    start = event.payload;
  }
  if (event.kind === "subagent_end") {
    end = event.payload;
  }
}

assert(start !== undefined, "subagent_start should be emitted");
assert(end !== undefined, "subagent_end should be emitted");
assert(end.answer.includes("Task file read"), "fake child provider should return its final answer");
assert(fs.existsSync(start.sessionFile), "subagent session file should exist");
assert(path.dirname(start.sessionFile).includes(".agent"), "subagent session should be under .agent");

println("subagent:ok");
