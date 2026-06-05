import { createAgent } from "@/agent/core/agent";
import { createRegistry } from "@/agent/tools/registry";
import { createCodingTools } from "@/agent/tools/coding";
import { createDynamicTools } from "@/agent/tools/dynamic";
import { createJSONLSession } from "@/agent/session/jsonl";

// kit 是应用装配层：把 registry、内置工具、session 和 agent loop 组合成可运行对象。
export function createCodingAgent(options) {
  let registry = options.registry;
  if (!registry) {
    registry = createRegistry();
  }

  if (options.tools) {
    registry.registerAll(options.tools);
  }

  // includeCodingTools=false 时只保留调用方显式传入的工具，适合受限运行。
  if (options.cwd && options.includeCodingTools !== false) {
    registry.registerAll(createCodingTools(options.cwd, options.enabledTools));
  }

  // 动态工具放在 .agent/tools/*，由语言侧 @std/runtime 在独立 VM 中执行。
  if (options.cwd && options.includeDynamicTools !== false) {
    registry.registerAll(createDynamicTools(options.cwd));
  }

  let session = options.session;
  // 默认使用 JSONL 记录事件，便于人工审计和后续回放。
  if (!session && options.sessionFile) {
    session = createJSONLSession(options.sessionFile);
  }

  let agent = createAgent({
    provider: options.provider,
    registry: registry,
    session: session,
    maxTurns: options.maxTurns,
    onEvent: options.onEvent,
  });

  return {
    agent: agent,
    registry: registry,
    session: session,
  };
}
