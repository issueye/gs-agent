import { createRegistry } from "@/agent/tools/registry";
import { createReadFileTool, createWriteFileTool, createAppendFileTool } from "@/agent/tools/files";

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
  let file = path.join(root, ".agent", "file-tools-smoke.md");
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }

  let registry = createRegistry();
  registry.register(createReadFileTool(root));
  registry.register(createWriteFileTool(root));
  registry.register(createAppendFileTool(root));

  let invalid = registry.safeCall("write_file", {});
  assert(invalid.ok === false, "empty write_file args should fail");
  assert(invalid.expectedInputSchema.required[0] === "path", "write_file failure should include schema");
  assert(invalid.expectedInputSchema.required[1] === "content", "write_file schema should require content");

  let written = registry.safeCall("write_file", {
    path: ".agent/file-tools-smoke.md",
    content: "# Report\n\nPart 1.\n",
  });
  assert(written.ok === true, "write_file should succeed");

  let appended = registry.safeCall("append_file", {
    path: ".agent/file-tools-smoke.md",
    content: "\nPart 2.\n",
  });
  assert(appended.ok === true, "append_file should succeed");

  let read = registry.safeCall("read_file", {
    path: ".agent/file-tools-smoke.md",
  });
  assert(read.result.content.includes("Part 1."), "read should include written content");
  assert(read.result.content.includes("Part 2."), "read should include appended content");

  println("file-tools:ok");
}

main();
