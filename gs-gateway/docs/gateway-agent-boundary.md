# Gateway / Agent Boundary

> Updated: 2026-06-08.

This document anchors the ownership boundary between `gs-gateway` and `gs-agent`.
Future changes should keep this split unless a new architecture decision replaces it.

## Decision

`gs-gateway` is the integration, scheduling, persistence, and HTTP control plane.
`gs-agent` is the model execution, tool execution, skill execution, and session-producing runtime.

The gateway may create and track agent tasks, but it must not emulate agent output or contain model-loop behavior.
Gateway task execution always delegates to `gs-agent/gateway-task.gs`.

## Gateway Owns

- HTTP API routes and response formatting.
- IM inbound normalization into gateway events and pending tasks.
- Gateway task records, schedule records, client/plugin registration records, and gateway event audit records.
- Reading agent filesystem summaries for UI display:
  - current session metadata
  - session list
  - skill index
  - dynamic tool index
  - plugin directory index
- Skill file administration through the gateway API.
- Scheduler conversion from due schedules to pending tasks.
- Agent bridge dispatch and audit:
  - mark task `running`
  - call `gs-agent/gateway-task.gs`
  - persist result on success
  - persist structured failure on error
  - append `agent_bridge` events for `start`, `done`, and `failed`

## Agent Owns

- Loading `agent.toml` / `agent.local.toml`.
- Provider selection and model requests.
- Agent loop behavior:
  - message history
  - tool-call handling
  - final-turn behavior
  - cancellation
  - context selection and session archive search
- Built-in coding tools, workspace tools, dynamic tools, skill runner, and subagent runner.
- Skill discovery for prompt injection during agent execution.
- JSONL session creation, answer file creation, current-session updates, and model request body logs.
- IM plugin runtime bridge once control has entered `gs-agent`.
- Any fake provider or scripted provider used by agent-local tests.

## Gateway Must Not Own

- Model provider configuration, API keys, or request bodies.
- Fake agent results, fake sessions, or dry-run task completion.
- Tool execution semantics.
- Skill prompt application for model runs.
- Subagent orchestration.
- Agent session content generation.

## Bridge Contract

The gateway calls:

```text
runtime.callScript(<agentRoot>/gateway-task.gs, "runGatewayTask", [payload], {
  cwd: agentRoot,
  argv: ["gs-agent", "gateway-task"],
})
```

Payload shape:

```json
{
  "taskId": "task-...",
  "id": "task-...",
  "kind": "agent.im",
  "name": "IM message from user",
  "root": "absolute/path/to/gs-agent",
  "payload": {}
}
```

Expected result shape:

```json
{
  "ok": true,
  "answer": "...",
  "events": 12,
  "sessionId": "...",
  "sessionDir": "...",
  "sessionFile": "...",
  "sessionArchiveFile": "...",
  "answerFile": "...",
  "logFile": "...",
  "latestLogFile": "..."
}
```

Failure is represented by the gateway task status `failed` plus a result object:

```json
{
  "error": {
    "message": "..."
  }
}
```

## Testing Policy

Gateway smoke tests may verify dispatch error handling without a local model key.
They must not create fake agent answers.

Real end-to-end bridge testing requires `gs-agent/agent.local.toml` with a valid provider configuration.
When that file is absent, the expected bridge behavior is a persisted failure with a clear provider configuration error.

