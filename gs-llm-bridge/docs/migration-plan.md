# SQLite to GTS Store Migration Plan

This plan maps the Go `icoo_llm_bridge` SQLite/GORM persistence model to the current `gs-llm-bridge` JSON store. It is intentionally documentation-only and does not require changes to the GTS service main path.

## Source and Target

Source project: `E:\codes\icoo_proxy\icoo_llm_bridge`

Primary SQLite DB:

- default path: `.data/icoo_llm_bridge.db`
- tables: `providers`, `provider_models`, `ingress_endpoints`, `routing_rules`, `api_keys`, `ui_preferences`

Traffic SQLite DB:

- default path: `.data/icoo_llm_bridge_traffic.db`
- table: `traffic_records`

Target project: `E:\codes\gts_codes\gs-llm-bridge`

Target JSON store:

- default path: `.data/store.json`
- top-level arrays: `providers`, `providerModels`, `endpoints`, `routingRules`, `apiKeys`, `traffic`

## Value Normalization

Protocol values need normalization:

| Old SQLite value | GTS store value |
| --- | --- |
| `anthropic` | `anthropic` |
| `openai-chat` | `openai_chat` |
| `openai-responses` | `openai_responses` |

Vendor values can be copied as-is: `openai`, `deepseek`, `anthropic`, `custom`.

Time values should be emitted as RFC3339 strings, matching the GTS store's `created_at` and `updated_at` style.

## Table Mappings

### `providers` to `providers`

| SQLite column | GTS field | Notes |
| --- | --- | --- |
| `id` | `id` | Copy. |
| `name` | `name` | Copy. |
| `protocol` | `protocol` | Normalize protocol value. |
| `vendor` | `vendor` | Copy. |
| `base_url` | `base_url` | Copy. |
| `api_key_cipher` | `api_key` | Old field is named cipher but current Go service stores the revealable secret here. |
| `only_stream` | `only_stream` | Copy boolean. |
| `user_agent` | `user_agent` | Copy. If empty, GTS defaults to `gs-llm-bridge/0.1.0` on future writes. |
| `enabled` | `enabled` | Copy boolean. |
| `description` | `description` | Copy. |
| `created_at` | `created_at` | Copy as RFC3339. |
| `updated_at` | `updated_at` | Copy as RFC3339. |

Missing/changed semantics:

- Old `api_key_cipher` is not hashed and is used as the actual upstream API key. Migrating it into `api_key` is functionally equivalent.
- GTS list APIs derive `api_key_set` and `api_key_preview`; these are not stored.

### `provider_models` to `providerModels`

| SQLite column | GTS field | Notes |
| --- | --- | --- |
| `id` | `id` | Copy. |
| `provider_id` | `provider_id` | Copy, after ensuring the provider exists. |
| `name` | `name` | Copy. |
| `max_tokens` | `max_tokens` | Copy; if zero, consider filling with `default_max_tokens` during migration. |
| `enabled` | `enabled` | Copy boolean. |
| `created_at` | `created_at` | Copy as RFC3339. |
| `updated_at` | `updated_at` | Copy as RFC3339. |

### `ingress_endpoints` to `endpoints`

| SQLite column | GTS field | Notes |
| --- | --- | --- |
| `id` | `id` | Copy. GTS default IDs differ from old seed IDs, so preserve source IDs to avoid accidental duplicates. |
| `path` | `path` | Copy. |
| `downstream_protocol` | `downstream_protocol` | Normalize protocol value. |
| `enabled` | `enabled` | Copy boolean. |
| `protected` | `protected` | Copy boolean. |
| `built_in` | none | Not currently represented in GTS store. |
| `description` | `description` | Copy. |
| `created_at` | `created_at` | Copy as RFC3339. |
| `updated_at` | `updated_at` | Copy as RFC3339. |

Missing fields:

- `built_in` is absent in GTS. If the desktop UI needs to distinguish built-in endpoints from user-created endpoints, add `built_in` later; otherwise this can be dropped.

### `routing_rules` to `routingRules`

| SQLite column | GTS field | Notes |
| --- | --- | --- |
| `id` | `id` | Copy. |
| `name` | `name` | Copy. |
| `priority` | `priority` | Copy. |
| `match_protocol` | `match_protocol` | Normalize protocol value. |
| `match_model_pattern` | `match_model_pattern` | Copy. |
| `upstream_protocol` | `upstream_protocol` | Normalize protocol value. |
| `target_provider_id` | `target_provider_id` | Copy; validate provider exists. |
| `target_model` | `target_model` | Copy. |
| `enabled` | `enabled` | Copy boolean. |
| `created_at` | `created_at` | Copy as RFC3339. |
| `updated_at` | `updated_at` | Copy as RFC3339. |

### `api_keys` to `apiKeys`

| SQLite column | GTS field | Notes |
| --- | --- | --- |
| `id` | `id` | Copy. |
| `name` | `name` | Copy. |
| `secret_hash` | none | GTS currently verifies by comparing stored plaintext `secret`. |
| `secret_preview` | derived | GTS derives preview from `secret`. |
| `secret_cipher` | `secret` | Old service stores the revealable secret in this field. |
| `scopes` | `scopes` | Copy. |
| `enabled` | `enabled` | Copy boolean. |
| `expires_at` | none | Not currently represented or enforced by GTS. |
| `created_at` | `created_at` | Copy as RFC3339. |
| `updated_at` | `updated_at` | Copy as RFC3339. |

Missing/changed semantics:

- `expires_at` is dropped unless GTS adds expiry support.
- `secret_hash` is dropped unless GTS adds hashed key verification.
- Rows with empty `secret_cipher` cannot be migrated into a working GTS key because GTS cannot verify from the old hash. Mark these as disabled or emit a migration warning requiring key regeneration.
- GTS currently stores secrets in plaintext. That matches old reveal behavior but is weaker than the old hash-plus-secret metadata model.

### `traffic_records` to `traffic`

| SQLite column | GTS field | Notes |
| --- | --- | --- |
| `id` | `id` | Copy. |
| `request_id` | `request_id` | Copy. |
| `endpoint` | `endpoint` | Copy. |
| `method` | `method` | Copy. |
| `client_ip` | `client_ip` | Copy. |
| `user_agent` | `user_agent` | Copy. |
| `content_type` | `content_type` | Copy. |
| `upstream_protocol` | `upstream_protocol` | Normalize if values use old constants. |
| `downstream_protocol` | `downstream_protocol` | Normalize if values use old constants. |
| `route_name` | `route_name` | Copy. |
| `route_source` | `route_source` | Copy. |
| `matched_rule_id` | `matched_rule_id` | Copy. |
| `matched_rule_name` | `matched_rule_name` | Copy. |
| `request_model` | `requested_model` | Rename. |
| `model` | `model` | Copy. |
| `request_body` | `request_body` | Prefer parse JSON string to object; if parsing fails, store the raw string. |
| `request_body_bytes` | none | Not currently recorded by GTS. |
| `request_body_truncated` | none | Not currently recorded by GTS. |
| `status_code` | `status_code` | Copy. |
| `duration_ms` | `duration_ms` | Copy. |
| `input_tokens` | `input_tokens` | Copy. |
| `output_tokens` | `output_tokens` | Copy. |
| `total_tokens` | `total_tokens` | Copy. |
| `error` | `error` | Copy. |
| `created_at` | `created_at` | Copy as RFC3339. |

Missing fields:

- `request_body_bytes` and `request_body_truncated` are present in newly recorded GTS traffic and should be preserved by migration.
- Current GTS caps traffic to 2000 entries when recording through the service. A file-level migration should either respect this cap or explicitly document that historical traffic can exceed it.

### `ui_preferences`

There is no GTS store equivalent.

Options:

- Do not migrate UI preferences for the first replacement pass.
- If needed later, add a top-level `uiPreferences` array with `{ key, value_json, created_at, updated_at }`.

## Recommended Migration Command Design

The repository includes a PowerShell migration helper at
`scripts/migrate-sqlite-to-store.ps1`. It is intentionally outside the service
main path and writes the same JSON store shape used by the current GTS bridge.

Dry-run first:

```powershell
.\scripts\migrate-sqlite-to-store.ps1 `
  -SqliteDb E:\codes\icoo_proxy\icoo_llm_bridge\.data\icoo_llm_bridge.db `
  -TrafficDb E:\codes\icoo_proxy\icoo_llm_bridge\.data\icoo_llm_bridge_traffic.db `
  -Out E:\codes\gts_codes\gs-llm-bridge\.data\store.json `
  -IncludeTraffic false `
  -DryRun
```

Then run the write step when the counts look right:

```powershell
.\scripts\migrate-sqlite-to-store.ps1 `
  -SqliteDb E:\codes\icoo_proxy\icoo_llm_bridge\.data\icoo_llm_bridge.db `
  -TrafficDb E:\codes\icoo_proxy\icoo_llm_bridge\.data\icoo_llm_bridge_traffic.db `
  -Out E:\codes\gts_codes\gs-llm-bridge\.data\store.json `
  -IncludeTraffic true `
  -TrafficLimit 2000 `
  -Merge true `
  -Backup true
```

The helper requires `sqlite3` on `PATH`, or pass `-SqliteExe` with the full
path to the executable. `-IncludeTraffic`, `-Merge`, and `-Backup` accept
`true`/`false`, `1`/`0`, or `yes`/`no`.

Expected output format:

```text
migration dry-run
imported providers: 1
imported providerModels: 1
imported endpoints: 3
imported routingRules: 1
imported apiKeys: 1
imported traffic: 0
final providers: 1
final providerModels: 1
final endpoints: 3
final routingRules: 1
final apiKeys: 1
final traffic: 0
```

Warnings are emitted with `Write-Warning` after the count summary. Common
warnings are missing provider references, API keys that only have
`secret_hash`, and traffic rows whose `request_body` cannot be parsed as JSON.

Static and smoke validation for the helper:

```powershell
.\scripts\test-migration-static.ps1
```

This validation parses the migration script, checks comment-based help and
summary labels, and runs a temporary SQLite dry-run smoke when `sqlite3` is
available. Use `-SkipSqliteSmoke` for parse/help-only validation.

Earlier preferred GoScript command shape, kept here as a future target if GTS
gets native SQLite support:

```powershell
..\gts\gs.exe --timeout 0 migrate-sqlite-to-store.gs `
  --sqlite-db E:\codes\icoo_proxy\icoo_llm_bridge\.data\icoo_llm_bridge.db `
  --traffic-db E:\codes\icoo_proxy\icoo_llm_bridge\.data\icoo_llm_bridge_traffic.db `
  --out E:\codes\gts_codes\gs-llm-bridge\.data\store.json `
  --include-traffic true `
  --backup true
```

Suggested behavior:

1. Read the current `store.json` if it exists; otherwise start from the GTS default shape.
2. Read source SQLite tables.
3. Normalize protocol values.
4. Build target arrays with stable IDs from SQLite.
5. Merge by primary key:
   - providers by `id`
   - providerModels by `(provider_id, id)`
   - endpoints by `id`
   - routingRules by `id`
   - apiKeys by `id`
   - traffic by `id` or `request_id`
6. Validate references:
   - provider model `provider_id` exists.
   - routing rule `target_provider_id` exists.
7. Warn but continue for non-fatal issues:
   - API key row has `secret_hash` but no `secret_cipher`.
   - traffic `request_body` is not parseable JSON.
   - endpoint ID differs from GTS seed ID for the same path.
8. Write a timestamped backup beside existing `store.json` before overwrite.
9. Write JSON atomically.
10. Print a summary with counts imported, skipped, and warned.

Recommended flags:

| Flag | Purpose |
| --- | --- |
| `--sqlite-db` | Source management SQLite path. |
| `--traffic-db` | Optional source traffic SQLite path. |
| `--out` | Target `store.json` path. |
| `--include-traffic` | Import traffic records when true. |
| `--traffic-limit` | Optional max historical traffic rows to import. |
| `--merge` | Merge with existing store when true; replace arrays when false. |
| `--backup` | Create `store.json.YYYYMMDD-HHMMSS.bak`. |
| `--dry-run` | Validate and print summary without writing. |

## Implementation Options

### Option A: External SQLite Export plus GTS JSON Builder

Use `sqlite3` or a tiny Go helper to export each table as JSON, then run a GoScript migration script that normalizes and writes `store.json`.

Pros:

- Does not require GTS SQLite support.
- Low risk for the current GTS runtime.
- Keeps migration one-shot and separate from service persistence.

Cons:

- Requires an external `sqlite3` binary or a temporary Go helper.
- More moving parts in developer setup.

### Option B: Pure GoScript Migration with SQLite Standard Library

Add or use a GTS SQLite standard library and implement `migrate-sqlite-to-store.gs` entirely in GoScript.

Pros:

- Best operator experience: one command reads SQLite and writes JSON.
- Reusable if GTS later supports SQLite-backed persistence.

Cons:

- Requires SQLite read support in GTS.
- If write support is added too, locking and transaction behavior need real tests.

### Option C: Direct SQLite Persistence Replacement

Instead of migrating to JSON, add a GTS SQLite store implementation and keep the old DB files as the canonical persistence layer.

Pros:

- Best data fidelity.
- Keeps old fields like `expires_at`, `built_in`, matched rule metadata, and request body truncation metadata.

Cons:

- Larger service change and outside Worker C's current write scope.
- Requires GTS SQLite standard library support plus a store abstraction.
- Must decide whether to keep old protocol values or migrate them in place.

## Is GTS SQLite Standard Library Support Needed?

For a one-time migration to `store.json`: not strictly needed. The safest near-term path is exporting SQLite rows to JSON using `sqlite3` or a small Go helper, then using GoScript or Node-style JSON tooling to produce the GTS store.

For replacement-level persistence where GTS reads the old SQLite DB directly, or where migration must be a single GoScript command: yes, GTS needs SQLite standard library support. Minimum required APIs:

- Open read-only and read-write SQLite connections by filesystem path.
- Execute parameterized queries.
- Return rows as objects with stable column names.
- Close connections explicitly.
- Support transactions for future write-backed persistence.

Recommendation:

- Phase 1: implement one-shot export/import without blocking on GTS SQLite.
- Phase 2: add GTS SQLite support only if the product wants SQLite as the long-term store instead of `store.json`.

## Store Gaps to Consider Before Full Replacement

Current GTS store is enough for basic management and routing, but full replacement fidelity has gaps:

- API key expiry is not represented.
- API key hash verification is not represented.
- Endpoint `built_in` is not represented.
- UI preferences are not represented.
- Traffic matched rule fields are not represented.
- Traffic body byte count and truncation fields are not represented.
- Old and new protocol constants differ and must be normalized consistently.
- GTS `store.json` stores provider and API-key secrets directly; this should be an explicit security decision.

## Minimal Acceptance Checks

After migration:

1. `GET /api/v1/runtime/state` shows expected counts.
2. Provider list shows all migrated providers with `api_key_set` true when source had `api_key_cipher`.
3. Provider model list works for each provider.
4. Routing rules resolve after protocol normalization.
5. API keys with migrated `secret_cipher` can authorize admin/proxy requests.
6. Traffic list returns migrated historical records if `--include-traffic` was used.
