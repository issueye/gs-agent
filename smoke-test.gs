import { createCodingAgent } from "@/agent/core/kit";
import { createScriptedProvider } from "@/agent/llm/fake";
import { createWorkspaceTools } from "@/agent/tools/workspace";

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
  let sessionFile = path.join(root, ".agent", "smoke-session.jsonl");
  if (fs.existsSync(sessionFile)) {
    fs.unlinkSync(sessionFile);
  }

  let provider = createScriptedProvider([
    {
      kind: "tool_call",
      name: "read_task",
      args: { path: "task.txt" },
    },
    {
      role: "assistant",
      content: "SMOKE_OK: tool loop and session recording work.",
    },
  ]);

  let kit = createCodingAgent({
    cwd: root,
    includeCodingTools: false,
    provider: provider,
    tools: createWorkspaceTools(path.join(root, "workspace")),
    sessionFile: sessionFile,
    maxTurns: 4,
  });

  let answer = kit.agent.run("Read the task file and finish.");
  let records = kit.session.readAll();

  assert(answer.content.includes("SMOKE_OK"), "fake provider did not produce final answer");
  assert(records.length >= 5, "session should contain message, tool call, result, and final answer");
  assert(records[2].kind === "tool_call", "expected a tool_call event");
  assert(records[3].kind === "tool_result", "expected a tool_result event");

  println("smoke:ok");
  println("smoke:events=" + String(records.length));
  println("smoke:session=" + sessionFile);

  let blockedProvider = createScriptedProvider([
    {
      role: "assistant",
      content: "<｜｜DSML｜｜tool_calls>\n<｜｜DSML｜｜invoke name=\"read_file\"></｜｜DSML｜｜invoke>\n</｜｜DSML｜｜tool_calls>",
    },
  ]);
  let blockedKit = createCodingAgent({
    cwd: root,
    includeCodingTools: false,
    provider: blockedProvider,
    tools: createWorkspaceTools(path.join(root, "workspace")),
    maxTurns: 1,
  });
  let blocked = blockedKit.agent.run("Try to finish without tools.");
  assert(blocked.content.includes("Agent stopped"), "text tool call should be blocked, got: " + blocked.content);
  println("smoke:text-tool-block=ok");

  let parsedProvider = createScriptedProvider([
    {
      role: "assistant",
      content: "<｜｜DSML｜｜tool_calls>\n<｜｜DSML｜｜invoke name=\"read_task\">\n<｜｜DSML｜｜parameter name=\"path\" string=\"true\">task.txt</｜｜DSML｜｜parameter>\n</｜｜DSML｜｜invoke>\n</｜｜DSML｜｜tool_calls>",
    },
    {
      role: "assistant",
      content: "TEXT_TOOL_OK",
    },
  ]);
  let parsedKit = createCodingAgent({
    cwd: root,
    includeCodingTools: false,
    provider: parsedProvider,
    tools: createWorkspaceTools(path.join(root, "workspace")),
    maxTurns: 3,
  });
  let parsed = parsedKit.agent.run("Parse text tool calls.");
  assert(parsed.content === "TEXT_TOOL_OK", "text tool call should execute when tools are allowed");
  println("smoke:text-tool-parse=ok");
}

main();
