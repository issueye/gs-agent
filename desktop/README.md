# Icoo Claw Desktop

Wails3 desktop chat client for the `icoo_claw` gateway.

## Current scope

- Chat-first shell
- Gateway mode only
- Local TOML settings
- Gateway HTTP discovery
- WebSocket streaming chat

## Commands

From this directory:

```powershell
wails3 generate bindings
wails3 dev -port 9346
wails3 build
```

Frontend checks live in `desktop/frontend`:

```powershell
Push-Location .\frontend
npm run test
npm run build
Pop-Location
```

## Local Chat E2E

From the repo root, install dependencies once:

```powershell
Push-Location .\desktop\frontend
npm ci
npx playwright install
Pop-Location
```

Run the full local smoke chain:

```powershell
.\scripts\dev\run-ui-smoke.ps1
```

The script starts `gateway`, the default fake agent `agent_desktop_default`, a ready fake agent instance, and a production-style Vite preview before running Playwright.

Playwright writes only transient status, traces, screenshots, and reports under `desktop/frontend/test-results/` and `desktop/frontend/playwright-report/`. These paths are ignored so reruns do not add noisy delivery files.

To run E2E against an already-started preview:

```powershell
Push-Location .\desktop\frontend
$env:GATEWAY_BASE_URL = "http://127.0.0.1:8080"
$env:E2E_DEFAULT_AGENT_ID = "agent_desktop_default"
$env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:4173"
npm run test:e2e
Pop-Location
```

## Final Verification

From the repo root before handoff:

```powershell
Push-Location .\desktop\frontend
npm run test
npm run build
Pop-Location

Push-Location .\desktop
go test ./...
Pop-Location

.\scripts\dev\run-ui-smoke.ps1
```

This desktop phase does not include external/vendor checkout work under `go_pkg/redka/`.
