# gs-llm-bridge Development Plan

## Goal

Build `gs-llm-bridge` as the GoScript implementation of the local-first LLM API bridge previously prototyped in Go.

The bridge should expose Anthropic Messages, OpenAI Chat Completions, and OpenAI Responses compatible endpoints, route requests to configured upstream providers, record traffic, and provide management APIs that are comfortable for the desktop app to consume.

## Current Baseline

The project currently has:

- A GoScript project layout with `project.toml` and `main.gs`.
- Web server bootstrapping through `@std/web`.
- Health, readiness, runtime-state, management, and proxy routes.
- File-backed JSON store for providers, models, endpoints, routing rules, API keys, and traffic.
- Basic direct/rule route resolution.
- Non-streaming upstream forwarding with model rewrite.

## Phase 1: Stable Script Service

Status: in progress

Deliverables:

- Keep startup deterministic with `--timeout 0 run`.
- Support config overrides for `--addr`, `--config`, and `--data-dir`.
- Keep generated runtime files under `.data`.
- Ensure health and runtime endpoints work without upstream configuration.
- Add smoke tests that start on a temporary port and exercise management APIs.

Acceptance:

- `GET /healthz` returns `gs-llm-bridge`.
- `GET /api/v1/runtime/state` returns counts and config.
- The service can start on a non-default port while the old Go bridge is still running.

## Phase 2: Management and Routing

Status: next

Deliverables:

- Harden CRUD behavior for duplicate IDs and missing parent providers.
- Add route-plan inspection API for debugging routing decisions.
- Add input normalization for snake_case and camelCase fields.
- Add provider/model seed examples in README.
- Keep secrets masked in list APIs and revealable only through explicit secret endpoints.

Acceptance:

- Creating a provider, model, rule, and API key through HTTP works end to end.
- Direct route `provider/model` and rule route `match_model_pattern` both resolve.
- Invalid route targets return clear JSON errors.

## Phase 3: Protocol Conversion

Status: next

Deliverables:

- Add converter helpers for:
  - OpenAI Chat Completions request to Anthropic Messages request.
  - Anthropic Messages response to OpenAI Chat Completions response.
  - OpenAI Responses request/response passthrough shape normalization.
  - Anthropic passthrough shape normalization.
- Keep converter code independent from web and store modules.
- Preserve the requested downstream response format whenever upstream protocol differs.
- Record token usage when it exists in upstream response bodies.

Acceptance:

- Chat Completions downstream can target Anthropic upstream and receive Chat Completions shaped JSON.
- Anthropic downstream can target OpenAI Chat upstream where the shape can be represented.
- Same-protocol routes remain passthrough except for model rewrite.

## Phase 4: Streaming, Traffic, and Packaging

Status: partial

Deliverables:

- Add SSE stream forwarding for same-protocol routes. Not delivered yet.
- Add stream conversion where practical after non-stream converters stabilize. Not delivered yet.
- Add traffic body-preview limits according to config.
- Add packaging scripts aligned with the root GTS build layout. Delivered with `scripts/package.ps1` and `scripts/package.sh`.
- Add regression smoke scripts for management, routing, and non-stream proxy flow.

Acceptance:

- Packaging creates `dist/gs-llm-bridge` without `.data`, `.data-*`, or nested `dist` output.
- The package contains `src`, `docs`, `config.example.toml`, `project.toml`, `main.gs`, smoke scripts, and `README.md`.
- Streaming requests do not buffer entire upstream responses for same-protocol forwarding. Pending true streaming support.
- Traffic list remains bounded and does not leak full request bodies unless explicitly enabled.
- Smoke scripts pass from a clean checkout.

## Worker Split

Worker A owns protocol conversion files under `src/services/converters*.gs` and may make focused changes to `src/services/proxy_service.gs`.

Worker B owns store/admin/routing hardening under `src/models/store.gs`, `src/controllers/admin_controller.gs`, `src/controllers/runtime_controller.gs`, and `src/routes.gs`.

Worker C owns smoke scripts and docs under `smoke-*.gs`, `README.md`, and `docs/*`.

The main coordinator integrates worker changes, resolves conflicts, and runs the final smoke tests.
