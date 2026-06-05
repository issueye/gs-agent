import { createDynamicTools, discoverDynamicTools } from "@/agent/tools/dynamic";

let process = require("@std/process");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function findTool(tools, name) {
  for (let tool of tools) {
    if (tool.name === name) {
      return tool;
    }
  }
  return undefined;
}

function main() {
  let root = process.cwd();
  let definitions = discoverDynamicTools(root);
  assert(findTool(definitions, "web_fetch"), "web_fetch discovered");
  assert(findTool(definitions, "web_search"), "web_search discovered");

  let tools = createDynamicTools(root);
  let fetchTool = findTool(tools, "web_fetch");
  let searchTool = findTool(tools, "web_search");
  assert(fetchTool, "web_fetch loaded");
  assert(searchTool, "web_search loaded");

  let fetched = fetchTool.run({
    url: "http://127.0.0.1:9/",
    maxChars: 300,
    timeoutMs: 1000,
  });
  assert(fetched.ok === false, "web_fetch network errors are wrapped");
  assert(fetched.error.includes("http.get"), "web_fetch error message");
  println("web_fetch:error-wrapped");

  let searched = searchTool.run({
    query: "GoScript agent",
    count: 2,
    timeoutMs: 5000,
  });
  assert(searched.provider === "duckduckgo", "web_search provider");
  assert("results" in searched, "web_search results field");
  if (searched.ok) {
    println("web_search:ok");
  } else {
    assert(searched.error, "web_search error field");
    println("web_search:error-wrapped");
  }
}

main();
