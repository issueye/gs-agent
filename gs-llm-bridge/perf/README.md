# gs-llm-bridge performance harness

A self-contained Go load generator for the bridge. It starts a native Go mock
upstream (OpenAI Chat + Anthropic Messages shapes, streaming + non-streaming),
provisions the bridge (provider, model, routing rule, api key) through the
management API, then drives concurrent load against the real proxy paths and
reports throughput (rps) and p50/p95/p99/max latency per scenario.

## Build

```powershell
cd perf
go build -o perf.exe .
```

## Run

Start the bridge on a known port with a clean data dir:

```powershell
# from gs-llm-bridge root
.\dist\gs-llm-bridge.exe --config .perf-config.toml --addr 127.0.0.1:18190 --data-dir .perf-data
```

Then run the harness:

```powershell
cd perf
.\perf.exe -bridge http://127.0.0.1:18190 -duration 8s -concurrency 1,10,50,100,200
```

Flags:
- `-bridge` bridge base URL (default `http://127.0.0.1:18181`)
- `-duration` per-scenario duration (default `8s`)
- `-concurrency` comma-separated concurrency levels for the proxy sweep (default `1,10,50,100`)
- `-warmup` run a 2s warmup before each measured scenario (default `true`)

## What it measures

- **Baseline** (fixed concurrency 50): `GET /healthz`, `GET /api/v1/runtime/state`, `GET /api/v1/providers`.
- **Proxy sweep** (per concurrency level):
  - chat same-protocol (`/v1/chat/completions` -> openai_chat upstream)
  - chat -> anthropic conversion (`/v1/chat/completions` -> anthropic upstream)
  - chat stream (`/v1/chat/completions` with `stream:true`)

The mock upstream returns fixed small bodies, so measured latency reflects
bridge work (routing, request/response conversion, traffic-store writes, SSE
forwarding) rather than upstream generation.

## Notes

- The harness uses a shared `http.Transport` with keep-alive to avoid
  ephemeral-port exhaustion (Windows WSAEADDRINUSE) under high request churn.
  Do not revert to one-connection-per-request.
- The bridge seeds a default api key; the harness creates a dedicated
  `perf-proxy-key`. Re-running against a non-fresh data dir keeps the previous
  provider/model/rule records, which point at a now-stopped upstream port and
  will yield 502s — use a clean `--data-dir` each run.
- At very high concurrency (>=200) latency dominates throughput; see
  `perf-final.txt` for a representative result.
