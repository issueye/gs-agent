# Smoke Tests

The smoke scripts assume a running `gs-llm-bridge` service and use HTTP only. They are safe to run beside another worker's service when each service uses a different port and data directory.

## Start a Smoke Service

From `E:\codes\gts_codes\gs-llm-bridge`:

```powershell
$env:GS_LLM_BRIDGE_PORT = "18182"
$env:GS_LLM_BRIDGE_DATA_DIR = ".data-smoke-18182"
..\gts\gs.exe --timeout 0 run
```

The default service port is `18181`; the smoke port defaults to `18182` so it can run in parallel with the normal development instance.

## Run Management Smoke

In another terminal:

```powershell
$env:GS_LLM_BRIDGE_SMOKE_PORT = "18182"
..\gts\gs.exe --timeout 0 smoke-management.gs
```

If `GS_LLM_BRIDGE_SMOKE_PORT` is not set, the script targets `127.0.0.1:18182`.

## Run Proxy Smoke

In another terminal:

```powershell
$env:GS_LLM_BRIDGE_SMOKE_PORT = "18182"
..\gts\gs.exe --timeout 0 smoke-proxy.gs
```

`smoke-proxy.gs` starts an in-process mock upstream with `@std/web` on a random local port, configures the running bridge through the management API, then sends proxy requests to the bridge port. If `GS_LLM_BRIDGE_SMOKE_PORT` is not set, the script targets `127.0.0.1:18182`.

## Covered Flow

`smoke-management.gs` checks:

- `GET /healthz`
- `GET /api/v1/runtime/state`
- provider create/list/delete
- provider model create/list/delete
- routing rule create/list/delete
- API key create/list/reveal/delete
- proxy failure traffic recording through `POST /v1/chat/completions`
- traffic list and clear

The script creates IDs with a timestamp suffix and deletes the provider, model, rule, and API key before exit. It also clears traffic after its proxy-recording check, so use a dedicated smoke data directory when you want to preserve manual traffic records.

`smoke-proxy.gs` checks:

- management API setup for proxy API key, providers, provider models, and routing rules
- OpenAI Chat to OpenAI Chat non-streaming proxy through `POST /v1/chat/completions`
- OpenAI Chat to OpenAI Chat same-protocol streaming proxy through `POST /v1/chat/completions` with `stream: true`
- OpenAI Chat downstream to Anthropic upstream streaming conversion
- Anthropic downstream to OpenAI Chat upstream streaming conversion
- Responses downstream to OpenAI Chat upstream non-streaming and streaming conversion
- OpenAI Chat downstream to Responses upstream non-streaming and streaming conversion
- upstream mock receipt of `/v1/chat/completions` with the configured target model
- traffic recording of prompt, completion, and total tokens for the OpenAI proxy request
- OpenAI Chat downstream to Anthropic upstream conversion through `/v1/messages`
- upstream mock receipt of `/v1/messages` with the configured target model
- bridge conversion of the Anthropic message response back to OpenAI chat completion shape
- traffic recording of input, output, and total tokens for the converted request

The proxy script deletes the provider, model, rule, and API key records it creates. It does not clear all traffic records because the current API only supports clearing the entire traffic log; use a dedicated smoke data directory when you want proxy smoke traffic to be disposable.
