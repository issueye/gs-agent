import { createRegistry } from "@/agent/tools/registry";
import { createTodoTool } from "@/agent/tools/todo";

let fs = require("@std/fs");
let path = require("@std/path");
let process = require("@std/process");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

let root = process.cwd();
let file = path.join(root, ".agent", "todos.json");
if (fs.existsSync(file)) {
  fs.unlinkSync(file);
}

let registry = createRegistry();
registry.register(createTodoTool(root));

let done = registry.safeCall("todo", {
  action: "add",
  title: "status uppercase",
  status: " DONE ",
});
assert(done.ok === true, "uppercase done should be accepted");
assert(done.result.todo.status === "done", "uppercase done should normalize to done");

let zhDone = registry.safeCall("todo", {
  action: "add",
  title: "status zh done",
  status: "已完成",
});
assert(zhDone.ok === true, "Chinese done should be accepted");
assert(zhDone.result.todo.status === "done", "Chinese done should normalize to done");

let pending = registry.safeCall("todo", {
  action: "add",
  title: "status pending",
  status: "pending",
});
assert(pending.ok === true, "pending should be accepted");
assert(pending.result.todo.status === "open", "pending should normalize to open");

let listDone = registry.safeCall("todo", {
  action: "list",
  status: "Completed",
});
assert(listDone.ok === true, "Completed filter should be accepted");
assert(listDone.result.count === 2, "done filter should find normalized done todos");

println("todo-status:ok");
