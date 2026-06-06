import { createCodingAgent } from "@/agent/core/kit";
import { createScriptedProvider } from "@/agent/llm/fake";
import { createTodoTool } from "@/agent/tools/todo";

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
  let todoFile = path.join(root, ".agent", "todos.json");
  if (fs.existsSync(todoFile)) {
    fs.unlinkSync(todoFile);
  }

  let tool = createTodoTool(root);
  let added = tool.run({
    action: "add",
    title: "Write todo module",
    notes: "Cover CRUD behavior",
  });
  assert(added.todo.title === "Write todo module", "todo add title");
  assert(added.todo.status === "open", "todo add default status");
  assert(fs.existsSync(todoFile), "todo file should be created");

  let listed = tool.run({ action: "list" });
  assert(listed.count === 1, "todo list count");
  assert(listed.todos[0].id === added.todo.id, "todo list id");

  let fetched = tool.run({ action: "get", id: added.todo.id });
  assert(fetched.todo.notes === "Cover CRUD behavior", "todo get notes");

  let updated = tool.run({
    action: "update",
    id: added.todo.id,
    title: "Ship todo module",
    status: "done",
  });
  assert(updated.todo.title === "Ship todo module", "todo update title");
  assert(updated.todo.status === "done", "todo update status");

  let done = tool.run({ action: "list", status: "done" });
  assert(done.count === 1, "todo filtered done count");

  let deleted = tool.run({ action: "delete", id: added.todo.id });
  assert(deleted.deleted.id === added.todo.id, "todo delete id");
  assert(deleted.count === 0, "todo delete count");

  tool.run({ action: "add", title: "Keep open task" });
  tool.run({ action: "add", title: "Clear finished task", status: "done" });
  let cleared = tool.run({ action: "clear", status: "done" });
  assert(cleared.deletedCount === 1, "todo clear deleted count");
  assert(tool.run({ action: "list" }).count === 1, "todo clear leaves open");

  let provider = createScriptedProvider([
    {
      kind: "tool_call",
      name: "todo",
      args: { action: "add", title: "Agent-created todo" },
    },
    {
      role: "assistant",
      content: "TODO_TOOL_OK",
    },
  ]);
  let kit = createCodingAgent({
    cwd: root,
    includeCodingTools: true,
    enabledTools: ["todo"],
    provider: provider,
    maxTurns: 3,
  });

  let listedTool = false;
  for (let item of kit.registry.list()) {
    if (item.name === "todo") {
      listedTool = true;
    }
  }
  assert(listedTool, "todo tool listed to provider");

  let answer = kit.agent.run("Add a todo.");
  assert(answer.content === "TODO_TOOL_OK", "todo tool agent loop");

  println("todo-tool:ok");
}

main();
