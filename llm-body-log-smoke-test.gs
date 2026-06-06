import { anthropicRequestBody } from "@/agent/llm/anthropic";
import { appendJsonLog } from "@/agent/log";

let fs = require("@std/fs");
let path = require("@std/path");
let process = require("@std/process");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  let file = path.join(process.cwd(), ".agent", "logs", "llm-body-smoke.jsonl");
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }

  let body = anthropicRequestBody(
    {
      model: "test-model",
      maxTokens: 64,
      system: "system prompt",
      thinking: "disabled",
    },
    [
      { role: "user", content: "hello" },
    ],
    [
      {
        name: "write_file",
        description: "Write a file.",
        inputSchema: {
          type: "object",
          required: ["path", "content"],
          properties: {
            path: { type: "string" },
            content: { type: "string" },
          },
        },
      },
    ],
    { allowTools: true }
  );

  appendJsonLog(file, {
    time: "test",
    provider: "anthropic",
    url: "https://example.test/v1/messages",
    body: body,
  });

  let line = fs.readFileSync(file).trim();
  let record = JSON.parse(line);
  assert(record.body.model === "test-model", "body log should include model");
  assert(String(record.body.messages[0].content).includes("hello"), "body log should include messages");
  assert(record.body.tools[0].name === "write_file", "body log should include tools");
  assert(record.body.tools[0].input_schema.required[1] === "content", "body log should include tool schema");

  println("llm-body-log:ok");
}

main();
