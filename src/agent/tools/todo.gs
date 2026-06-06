import { createTool } from "@/agent/tools/registry";
import { workspacePath } from "@/agent/tools/files";

let fs = require("@std/fs");
let path = require("@std/path");
let crypto = require("@std/crypto");

function now() {
  return (new Date()).toISOString();
}

function defaultStore() {
  return {
    version: 1,
    todos: [],
  };
}

function todoFile(cwd) {
  return workspacePath(cwd, path.join(".agent", "todos.json"));
}

function readStore(file) {
  if (!fs.existsSync(file)) {
    return defaultStore();
  }

  let text = fs.readFileSync(file).trim();
  if (text === "") {
    return defaultStore();
  }

  let store = JSON.parse(text);
  if (!store.todos) {
    store.todos = [];
  }
  return store;
}

function writeStore(file, store) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeTextSync(file, JSON.stringify(store, null, 2) + "\n");
}

function copyTodo(todo) {
  return {
    id: todo.id,
    title: todo.title,
    status: todo.status,
    notes: todo.notes,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
  };
}

function findTodo(store, id) {
  for (let i = 0; i < store.todos.length; i = i + 1) {
    if (store.todos[i].id === id) {
      return {
        index: i,
        todo: store.todos[i],
      };
    }
  }
  return undefined;
}

function normalizeStatus(status) {
  if (!status) {
    return "open";
  }
  if (status === "open" || status === "done") {
    return status;
  }
  throw new TypeError("todo status must be open or done");
}

function filteredTodos(store, status) {
  let results = [];
  for (let todo of store.todos) {
    if (!status || todo.status === status) {
      results.push(copyTodo(todo));
    }
  }
  return results;
}

function requireId(args) {
  if (!args.id) {
    throw new TypeError("todo action requires id");
  }
}

function requireTitle(args) {
  if (!args.title || args.title.trim() === "") {
    throw new TypeError("todo action requires title");
  }
}

function runTodoAction(file, args) {
  let store = readStore(file);
  let action = args.action;

  if (action === "add") {
    requireTitle(args);
    let created = now();
    let todo = {
      id: crypto.randomUUID(),
      title: args.title.trim(),
      status: normalizeStatus(args.status),
      notes: args.notes || "",
      createdAt: created,
      updatedAt: created,
    };
    store.todos.push(todo);
    writeStore(file, store);
    return {
      action: action,
      todo: copyTodo(todo),
      count: store.todos.length,
    };
  }

  if (action === "list") {
    let status = undefined;
    if (args.status) {
      status = normalizeStatus(args.status);
    }
    return {
      action: action,
      todos: filteredTodos(store, status),
      count: filteredTodos(store, status).length,
      total: store.todos.length,
    };
  }

  if (action === "get") {
    requireId(args);
    let found = findTodo(store, args.id);
    if (!found) {
      throw new ReferenceError("todo not found: " + args.id);
    }
    return {
      action: action,
      todo: copyTodo(found.todo),
    };
  }

  if (action === "update") {
    requireId(args);
    let found = findTodo(store, args.id);
    if (!found) {
      throw new ReferenceError("todo not found: " + args.id);
    }
    let todo = found.todo;
    if (args.title !== undefined) {
      if (args.title.trim() === "") {
        throw new TypeError("todo title cannot be empty");
      }
      todo.title = args.title.trim();
    }
    if (args.status !== undefined) {
      todo.status = normalizeStatus(args.status);
    }
    if (args.notes !== undefined) {
      todo.notes = args.notes;
    }
    todo.updatedAt = now();
    writeStore(file, store);
    return {
      action: action,
      todo: copyTodo(todo),
      count: store.todos.length,
    };
  }

  if (action === "delete") {
    requireId(args);
    let found = findTodo(store, args.id);
    if (!found) {
      throw new ReferenceError("todo not found: " + args.id);
    }
    let removed = store.todos.splice(found.index, 1)[0];
    writeStore(file, store);
    return {
      action: action,
      deleted: copyTodo(removed),
      count: store.todos.length,
    };
  }

  if (action === "clear") {
    let status = undefined;
    if (args.status) {
      status = normalizeStatus(args.status);
    }
    let kept = [];
    let deleted = [];
    for (let todo of store.todos) {
      if (!status || todo.status === status) {
        deleted.push(copyTodo(todo));
      } else {
        kept.push(todo);
      }
    }
    store.todos = kept;
    writeStore(file, store);
    return {
      action: action,
      deleted: deleted,
      deletedCount: deleted.length,
      count: store.todos.length,
    };
  }

  throw new TypeError("unknown todo action: " + action);
}

export function createTodoTool(cwd) {
  return createTool(
    "todo",
    "Manage persistent todo tasks in the workspace. Supports add, list, get, update, delete, and clear actions.",
    {
      type: "object",
      required: ["action"],
      additionalProperties: false,
      properties: {
        action: { type: "string" },
        id: { type: "string", minLength: 1 },
        title: { type: "string" },
        status: { type: "string" },
        notes: { type: "string" },
      },
    },
    function(args) {
      return runTodoAction(todoFile(cwd), args);
    }
  );
}
