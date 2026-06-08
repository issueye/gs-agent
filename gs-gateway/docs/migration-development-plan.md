# gs-agent to gs-gateway Migration Development Plan

## Goal

Move management and integration responsibilities from `gs-agent` into `gs-gateway`, while keeping `gs-agent` focused on reasoning and local tool execution.

Boundary:

- `gs-gateway`: external integrations, management APIs, task queue, scheduling, persistence, event stream, resource registry.
- `gs-agent`: LLM loop, provider calls, local tool execution, final task execution.

## Current State

`gs-gateway` already has:

- HTTP app with MVC structure.
- SQLite-backed event and task records.
- Read-only discovery for `gs-agent` skills, dynamic tools, plugins, and sessions.
- IM inbound endpoint that creates a pending agent task.

`gs-agent` currently owns too much:

- IM plugin lifecycle and reply bridge.
- Session creation, current-session pointer, IM session mapping.
- Skill creation and skill execution tool.
- Dynamic tool discovery and execution.
- Todo state in `.agent/todos.json`.

## Phase 1: Gateway Management Surface

Implement these first because they do not require changing `gs-agent`.

### 1. Skill Management

Add gateway APIs:

- `POST /api/skills`
- `PUT /api/skills/:name`
- `DELETE /api/skills/:name`

Behavior:

- Validate skill names.
- Write exactly one `SKILL.md`.
- Preserve the standard frontmatter shape: `name` and `description`.
- Record create/update/delete events in SQLite.

### 2. Task Scheduling

Add task fields and APIs for scheduling:

- `POST /api/schedules`
- `GET /api/schedules`
- `PATCH /api/schedules/:id`
- `DELETE /api/schedules/:id`

Behavior:

- Keep schedules in SQLite.
- Convert due schedules into pending gateway tasks.
- First version can use poll-on-request or a lightweight in-process tick.

### 3. Agent Bridge Stub

Add a gateway-side bridge module that can:

- Create a task from desktop/IM/plugin requests.
- Mark task as `running`.
- Call a configurable agent command or script later.
- Mark task as `done` or `failed`.

Historical note: the first version did not require real LLM execution and supported dry-run style attempts.
That behavior has been removed. The current gateway bridge delegates directly to the real `gs-agent` runtime.

## Phase 2: gs-agent Execution Contract

Add a small contract in `gs-agent`:

- Input: JSON task payload.
- Output: JSON result with answer, session paths, event count, and error.

Suggested shape:

```json
{
  "taskId": "task-...",
  "kind": "agent.im",
  "input": {
    "text": "..."
  },
  "conversationId": "im:onebot:qq-local:..."
}
```

Gateway should eventually call this contract via:

- `@std/runtime.callScript`, if running in the same process.
- A child `gs.exe` command, if isolation is preferred.
- HTTP, if `gs-agent` later exposes an API.

Status:

- Added `gs-agent/gateway-task.gs`.
- `gs-gateway` now calls it through `@std/runtime.callScript`.
- Gateway task execution is wired to the existing `runAgentTask` path and requires a valid local model configuration.
- The gateway no longer accepts `mode`, `dryRun`, or `allowReal` controls.
- Missing or invalid model configuration is persisted as a failed gateway task and `agent_bridge failed` event.
- Every bridge run records `agent_bridge` events for start, done, or failed.

## Phase 3: Move External Integrations

Move these responsibilities from `gs-agent` to `gs-gateway`:

- IM plugin startup and GTP protocol handling.
- IM message normalization.
- IM reply sending.
- Plugin registration and health checks.
- Dynamic tool registry management.

After this phase, `gs-agent --im` should be deprecated or become a thin compatibility wrapper.

## Phase 4: Session and Audit Center

Gateway becomes the main session query surface:

- List sessions.
- Read current session.
- Search session archive.
- Store gateway events and agent run events together.
- Expose event stream for desktop UI.

`gs-agent` may still write JSONL locally, but gateway owns the management API.

## Parallel Work Plan

Split work into isolated file ownership:

- Worker A: Skill management.
  - Owns `src/models/skills.gs`, `src/controllers/skill_admin_controller.gs`.
  - May update routes only through a clearly named exported registration helper if needed.

- Worker B: Task scheduling.
  - Owns `src/models/scheduler.gs`, `src/controllers/scheduler_controller.gs`.
  - May extend `src/models/store.gs` only for schedule table support.

- Worker C: Agent bridge.
  - Owns `src/models/agent_bridge.gs`, `src/controllers/agent_bridge_controller.gs`.
  - May extend `src/models/gateway.gs` with a bridge object.

Main integrator:

- Owns `src/routes.gs`, `README.md`, `smoke-test.gs`.
- Runs final integration tests.

## Acceptance Tests

Minimum:

- `smoke-test.gs` passes.
- HTTP `/health` works.
- Skill create/list/read/update/delete works.
- Schedule create/list/update/delete works.
- IM inbound still creates pending task.
- Agent bridge dispatch records `start` and records either `done` or `failed`.

Commands:

```powershell
cd E:\codes\gts_codes\gs-gateway
E:\codes\gts\dist\gs.exe --timeout 20s smoke-test.gs
E:\codes\gts\dist\gs.exe --timeout 0 run
```
