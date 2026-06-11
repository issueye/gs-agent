# gs-llm-bridge

`gs-llm-bridge` is a GoScript rewrite scaffold for `icoo_llm_bridge`.

It exposes Anthropic Messages, OpenAI Chat Completions, and OpenAI Responses compatible entrypoints, plus a small management API for providers, models, routing rules, API keys, and traffic records.

Development plan: [docs/development-plan.md](docs/development-plan.md).

## Run

From `E:\codes\gts_codes\gs-llm-bridge`:

```powershell
..\gts\gs.exe --timeout 0 run
```

Or from `E:\codes\gts_codes`:

```powershell
Push-Location .\gs-llm-bridge
..\gts\gs.exe --timeout 0 run
Pop-Location
```

Default address: `127.0.0.1:18181`.

To run beside another bridge or another worker's service, choose a separate port and data directory:

```powershell
$env:GS_LLM_BRIDGE_PORT = "18182"
$env:GS_LLM_BRIDGE_DATA_DIR = ".data-smoke-18182"
..\gts\gs.exe --timeout 0 run
```

Equivalent command-line overrides are also supported:

```powershell
..\gts\gs.exe --timeout 0 run --addr 127.0.0.1:18182 --data-dir .data-smoke-18182
```

## Smoke Tests

Start the service on the smoke port, then run the management smoke script from this directory:

```powershell
$env:GS_LLM_BRIDGE_SMOKE_PORT = "18182"
..\gts\gs.exe --timeout 0 smoke-management.gs
```

The smoke script checks health, runtime state, provider/model/rule/API-key management, and traffic recording. See [docs/smoke-tests.md](docs/smoke-tests.md).

## Packaging

Create a clean distributable copy under `dist/gs-llm-bridge`:

```powershell
.\scripts\package.ps1
```

The package includes `src`, `docs`, `config.example.toml`, `project.toml`, `main.gs`, smoke scripts, and this README. Runtime data directories such as `.data` and `.data-*`, plus previous `dist` output, are excluded.

On Unix-like shells, the equivalent helper is:

```sh
./scripts/package.sh
```

## Minimal Management Setup

Create a provider:

```json
{
  "id": "local-openai",
  "name": "Local OpenAI",
  "protocol": "openai_chat",
  "vendor": "openai",
  "base_url": "https://api.openai.com/v1",
  "api_key": "sk-...",
  "enabled": true
}
```

Create a model under that provider with `POST /api/v1/providers/local-openai/models`:

```json
{
  "id": "gpt-4.1-mini",
  "name": "gpt-4.1-mini",
  "max_tokens": 32768,
  "enabled": true
}
```

Create a routing rule:

```json
{
  "id": "default-openai-chat",
  "name": "Default OpenAI Chat",
  "priority": 100,
  "match_protocol": "openai_chat",
  "match_model_pattern": "*",
  "upstream_protocol": "openai_chat",
  "target_provider_id": "local-openai",
  "target_model": "gpt-4.1-mini",
  "enabled": true
}
```

## API

- `GET /`, `GET /healthz`, `GET /readyz`
- `POST /v1/messages`
- `POST /v1/chat/completions`
- `POST /v1/responses`
- `GET /api/v1/runtime/state`
- `GET|POST /api/v1/providers`
- `PUT|DELETE /api/v1/providers/:provider_id`
- `GET|POST /api/v1/providers/:provider_id/models`
- `PUT|DELETE /api/v1/providers/:provider_id/models/:id`
- `GET|POST|PUT|DELETE /api/v1/ingress-endpoints`
- `GET|POST|PUT|DELETE /api/v1/routing-rules`
- `GET|POST|DELETE /api/v1/api-keys`
- `GET /api/v1/api-keys/:id/secret`
- `GET|DELETE /api/v1/traffic`

The first script version stores data in `.data/store.json`. It is intentionally small and easy to inspect while the Go bridge behavior is migrated.
