# Agent Current State

> Updated: 2026-06-08.

`gs-agent` is a GoScript application that runs an AI coding agent on top of the GoScript runtime.
It has three entry modes:

- `run`: read `workspace/task.txt`, run one agent task, write session and answer files.
- `--tui`: run the terminal UI for interactive task editing and session viewing.
- `--im`: attach the IM plugin bridge and process inbound IM messages as agent inputs.

## Runtime Composition

The application entrypoint is `main.gs`.
Application assembly is in `src/agent/app.gs`.

At startup the agent:

- Determines the app root from the interpreter or packaged executable path.
- Loads `agent.local.toml` first, then `agent.toml`.
- Discovers skills from `.agent/skills`.
- Applies the skill index to the system prompt.
- Creates or loads session metadata under `.agent/sessions`.
- Creates run logs under `.agent/logs`.
- Builds the provider and tool registry.
- Runs the agent loop in `src/agent/core/agent.gs`.

## Provider State

Default provider: `anthropic`.

The default committed configuration points to the DeepSeek Anthropic-compatible endpoint:

```toml
[llm.anthropic]
baseUrl = "https://api.deepseek.com/anthropic"
model = "deepseek-v4-flash"
```

`agent.local.toml` is required for real execution because it must provide `apiKey`.
There is no local `agent.local.toml` in the current checkout.

The codebase still contains a scripted fake provider for agent-local tests.
That provider belongs to the agent test surface and is not part of the gateway bridge contract.

## Tools

The committed default `agent.toml` enables:

- `read_file`
- `list_dir`
- `grep`
- `write_file`
- `append_file`
- `bash`
- `todo`
- `create_skill`
- `run_subagent`
- `run_skill`

Application assembly also registers:

- workspace tools
- dynamic tools discovered from `.agent/tools/*/tool.toml`
- session archive search when a session archive exists
- skill runner when skills are enabled
- subagent runner when subagents are enabled

Dynamic tools are local executable GoScript code and should be treated as trusted code.

## Session And Logs

Each real run creates a session under:

```text
.agent/sessions/<session-id>/
  session.jsonl
  answer.md
```

The current session pointer is:

```text
.agent/current-session.json
```

Run logs are written under:

```text
.agent/logs/
  gs-agent.log
  latest.log
  llm-body.jsonl
```

## Current Gaps

- Real model execution cannot be verified in this checkout until `agent.local.toml` is added.
- README still references several legacy smoke scripts that were removed in the latest local commit.
- The scripted fake provider remains useful for agent-local tests, but gateway bridge tests should not depend on it.
- The agent has broad file and shell tools enabled in committed defaults. That is suitable for local development but should be reviewed before exposing the gateway outside localhost.

## Recommended Next Steps

- Add `agent.local.toml` locally and run one real gateway bridge task.
- Refresh the README smoke-test section to match current files.
- Decide whether `write_file`, `append_file`, and `bash` should remain enabled by default or move to local-only config.
- Keep gateway changes focused on task orchestration and audit; keep all model execution behavior in `gs-agent`.

