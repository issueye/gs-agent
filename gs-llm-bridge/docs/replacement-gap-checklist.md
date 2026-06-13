# Replacement Gap Checklist

Scope: replacement-contract comparison between `E:\codes\icoo_proxy\icoo_llm_bridge` router/controller/service/tests and the current `E:\codes\gts_codes\gs-llm-bridge` API plus smoke scripts. This document is read-only analysis; it does not require source-chain changes.

## Must-Compatible HTTP Paths

Health and runtime:

- `GET /`
- `GET /healthz`
- `GET /readyz`
- `GET /api/v1/runtime/state`

Proxy ingress:

- `POST /v1/messages` for Anthropic Messages downstream.
- `POST /v1/chat/completions` for OpenAI Chat Completions downstream.
- `POST /v1/responses` for OpenAI Responses downstream.
- `POST <enabled ingress endpoint path>` through dynamic endpoint lookup. Old bridge matches enabled `ingress_endpoints`; current bridge now uses `findEnabledEndpointByPath`, normalizes query strings and trailing slashes, and should remain compatible.

Admin resources:

- `GET|POST /api/v1/providers`
- `PUT|DELETE /api/v1/providers/:provider_id`
- `GET|POST /api/v1/providers/:provider_id/models`
- `PUT|DELETE /api/v1/providers/:provider_id/models/:id`
- `GET|POST /api/v1/ingress-endpoints`
- `PUT|DELETE /api/v1/ingress-endpoints/:id`
- `GET|POST /api/v1/routing-rules`
- `PUT|DELETE /api/v1/routing-rules/:id`
- `GET /api/v1/api-keys`
- `GET /api/v1/api-keys/:id/secret`
- `POST /api/v1/api-keys`
- `DELETE /api/v1/api-keys/:id`
- `GET /api/v1/traffic?limit=&page=&page_size=`
- `DELETE /api/v1/traffic`

Current extra path:

- `GET /api/v1/runtime/route-plan` exists in the current bridge and is useful, but it is additive relative to the old router.

## Request And Response Formats

Admin response envelope:

- Success response shape is `{ "data": ... }`.
- Error response shape is `{ "error": { "code": "...", "message": "..." } }`.
- Paged list shape is `{ data: { items, total, page, page_size } }` in the current bridge.
- Old controller returned Go field `PageSize` as JSON `pageSize` unless the view struct tags override it. Verify clients are not relying on `pageSize`; current smoke asserts `total` only.

Admin create/update request fields to preserve:

- Provider: `id`, `name`, `protocol`, `vendor`, `base_url`, `api_key`, `only_stream`, `user_agent`, `enabled`, `description`.
- Provider model: `id`, `provider_id`, `name`, `max_tokens`, `enabled`.
- Ingress endpoint: `id`, `path`, `downstream_protocol`, `enabled`, `protected`, `description`.
- Routing rule: `id`, `name`, `priority`, `match_protocol`, `match_model_pattern`, `upstream_protocol`, `target_provider_id`, `target_model`, `enabled`.
- API key: `id`, `name`, `secret`, `scopes`, `enabled`.

Admin response fields to preserve:

- Provider hides `api_key` and returns `api_key_set`, `api_key_preview`.
- API key hides `secret` in list/create and returns `secret_preview`, `can_reveal`, `scopes`, `enabled`, `created_at`, `updated_at`.
- `GET /api/v1/api-keys/:id/secret` returns `{ data: { secret } }`.
- Deletes return `{ data: { deleted: true } }`; traffic clear returns `{ data: { cleared: true } }`.

Proxy response formats:

- OpenAI Chat downstream must return OpenAI chat completion or chat completion chunk shape.
- Anthropic downstream must return Anthropic message or Anthropic SSE event shape.
- OpenAI Responses downstream must return OpenAI response or Responses SSE event shape.
- Same-protocol forwarding rewrites `model` to the target model.
- Cross-protocol conversion must preserve downstream shape while using target upstream endpoint/model.

Protocol naming compatibility risk:

- Old Go constants use strings such as `openai-chat` in route resolver errors and likely stored values.
- Current bridge uses `openai_chat`, `openai_responses`, and `anthropic`.
- Replacement must either confirm old persisted data already uses underscore names, or support aliases for hyphenated protocol names at API/store boundaries.

## Authentication

Admin auth:

- Old bridge allows local clients without auth when `allow_local_without_auth` is true, using loopback remote IP detection.
- Current bridge allows missing admin key whenever `allowLocalWithoutAuth` is true, without checking client IP in controller code. This is broader than the old contract if the process is reachable from non-loopback hosts.
- Admin key may be supplied by `x-api-key` or `Authorization: Bearer <secret>`.
- Required scope is `admin`; `*` scope should be accepted.

Proxy auth:

- Old bridge allows local clients without auth only for loopback clients when configured.
- Current bridge allows missing proxy key whenever `allowLocalWithoutAuth` is true, without checking client IP in service code.
- Proxy key may be supplied by `x-api-key` or `Authorization: Bearer <secret>`.
- Required scope is `proxy`; `*` scope should be accepted.

Request IDs and CORS:

- Old middleware honors inbound `X-Request-ID` when present and responds with `X-ICOO-Request-ID`.
- Current proxy generates a new UUID request id; health/admin CORS exposes `X-ICOO-Request-ID`, but inbound `X-Request-ID` preservation is not covered.
- Old CORS allowed `GET,POST,PUT,DELETE,OPTIONS` and headers `Content-Type,Authorization,x-api-key,x-request-id`.
- Current CORS allows `GET,POST,PUT,PATCH,DELETE,OPTIONS` and headers `Content-Type,Authorization,X-API-Key,anthropic-version`.
- Replacement should preserve `x-request-id` in allowed headers unless intentionally changed.

## Error Codes And Error Bodies

Admin:

- Invalid JSON returns HTTP 400 with `{ error: { code: "BAD_REQUEST", message } }`.
- Admin unauthorized returns HTTP 401 with `{ error: { code: "UNAUTHORIZED", message: "invalid admin api key" } }`.
- Old controller writes most service errors as HTTP 400 `BAD_REQUEST`; current controller returns 404 `NOT_FOUND` for missing provider/model/rule/key deletes and nested model operations. This is a behavior difference to classify as intentional or compatibility risk.

Proxy:

- Non-POST on explicit proxy paths returns 405 in old and current service path.
- Dynamic non-POST/no route returns 404 in old controller; current dynamic returns 404 JSON body.
- Missing/invalid proxy auth returns 401 downstream-shaped proxy error.
- Invalid JSON request body should return 400. Current `@std/web` JSON parser behavior should be smoke-tested explicitly.
- Route resolution failures return 400 downstream-shaped proxy error.
- Missing upstream base URL returns 502 downstream-shaped proxy error.
- Upstream request failures return 502 downstream-shaped proxy error.
- Upstream non-2xx should return downstream-shaped error with the upstream status and message extracted from upstream JSON error body. Old tests assert messages include `upstream returned status <code>` and the nested message, such as `slow down`.
- Current non-streaming upstream non-2xx sends upstream body directly. That differs from old proxy error wrapping and may leak upstream-native shape to a different downstream protocol.

Unsafe response headers:

- Old bridge drops `Connection`, `Keep-Alive`, `Proxy-*`, `TE`, `Trailer(s)`, `Transfer-Encoding`, `Upgrade`, `Content-Encoding`, `Content-Length`, and `Content-Range` after response rewrite.
- Current bridge only drops `content-length`, `transfer-encoding`, and `connection`.
- Replacement should verify `Content-Encoding` and related unsafe headers are not forwarded after body conversion.

## Streaming Behavior

Must-compatible stream directions from old tests:

- OpenAI Responses stream -> OpenAI Chat stream.
- OpenAI Chat stream -> OpenAI Responses stream.
- OpenAI Chat stream -> Anthropic stream.
- Anthropic stream -> OpenAI Chat stream.
- Responses stream -> Anthropic stream and Anthropic stream -> Responses stream are supported in current code and should remain covered if treated as replacement surface.

Stream response contract:

- Successful downstream stream response uses `Content-Type: text/event-stream`, `Cache-Control: no-cache`, no `Content-Length`, and flushes chunks.
- OpenAI Chat streams emit `chat.completion.chunk` chunks and terminate with `data: [DONE]`.
- Anthropic streams emit `message_start`, `content_block_*`, `message_delta`, and `message_stop`.
- Responses streams emit `response.created`, `response.output_text.delta`, function-call events when applicable, and `response.completed`.
- For OpenAI Chat downstream with `stream: true`, if upstream returns non-stream JSON chat completion, old bridge falls back to SSE chunks and includes a usage chunk when `stream_options.include_usage` is true.
- Current bridge now converts successful non-SSE upstream bodies into downstream SSE when the client requested streaming; smoke covers Responses downstream via OpenAI Chat upstream.

Stream error contract:

- Upstream non-2xx stream response must not be converted as success.
- Empty stream should return 502 JSON proxy error.
- Initial stream error event should return 502 JSON proxy error before success chunks.
- Current bridge preflights converted streams before writing downstream SSE, so empty streams and first `event: error` payloads are recorded as 502 instead of successful streams.
- Streaming traffic records token usage when stream converter can extract it.

Tool-call stream contract:

- Anthropic `tool_use` stream maps to OpenAI Chat `tool_calls` deltas and finish reason `tool_calls`.
- OpenAI Chat tool-call stream maps to Anthropic `tool_use` and `input_json_delta`.
- OpenAI Chat tool-call stream maps to Responses `response.output_item.added`, `response.function_call_arguments.delta`, and done events.

## Traffic Fields

Old traffic record fields:

- `id`
- `request_id`
- `endpoint`
- `method`
- `client_ip`
- `user_agent`
- `content_type`
- `upstream_protocol`
- `downstream_protocol`
- `route_name`
- `route_source`
- `matched_rule_id`
- `matched_rule_name`
- `request_model` / API field equivalent `requested_model`
- `model`
- `request_body`
- `request_body_bytes`
- `request_body_truncated`
- `status_code`
- `duration_ms`
- `input_tokens`
- `output_tokens`
- `total_tokens`
- `error`
- `created_at`

Current traffic gaps to verify/fix:

- `matched_rule_id` and `matched_rule_name` are not written by current `record`.
- `client_ip` is always empty in current `record`.
- Current `endpoint` uses `req.url`; old record used path only. Query strings may now be included.
- Current `request_body` is stored as a JSON string preview when body logging is enabled; previous smoke only checks token fields.
- Current stream traffic is recorded before conversion, likely before usage extraction.
- Current same-request duplicate records may occur if stream conversion errors after an early success record; old bridge records after conversion.

## Current Smoke Coverage

Covered by `smoke-management.gs`:

- health and runtime state
- provider/model/routing-rule/API-key CRUD basics
- API key secret reveal
- proxy failure traffic creation
- traffic list and clear

Covered by current `smoke-proxy.gs`:

- in-process mock upstream via `@std/web`
- proxy API key setup
- provider/model/rule setup for OpenAI Chat, Anthropic, and OpenAI Responses
- custom ingress endpoint dynamic routing
- OpenAI Chat same-protocol non-stream
- OpenAI Chat -> Anthropic non-stream
- OpenAI Responses downstream via OpenAI Chat upstream
- OpenAI Chat downstream via OpenAI Responses upstream
- non-stream tool conversions across Chat/Anthropic/Responses paths
- several streaming conversion paths and tool streaming assertions
- mock upstream endpoint/model receipt assertions
- basic traffic token/status assertions for selected non-stream/stream paths

Current smoke gaps:

- Admin auth negative cases: missing key, wrong scope, bearer vs `x-api-key`, local-without-auth remote-IP semantics.
- Proxy auth negative cases and `*` scope acceptance.
- `X-Request-ID` inbound preservation and `X-ICOO-Request-ID` response behavior.
- CORS `OPTIONS` and allowed headers, especially `x-request-id`.
- Admin pagination metadata, including `page_size` vs `pageSize` compatibility.
- `PUT` update paths for all admin resources.
- Delete missing-resource status compatibility: old mostly 400 service errors vs current 404.
- Ingress endpoint disabled/protected behavior and trailing-slash/query normalization.
- Direct route syntax `provider/model` winning before rules.
- Route-plan response candidate ordering and sanitized credentials.
- Hyphenated protocol alias compatibility (`openai-chat`, `openai-responses`) if old persisted data uses it.
- Invalid JSON request body handling.
- Non-POST explicit proxy 405 and dynamic non-POST 404.
- Upstream non-2xx JSON and stream error wrapping. Stream non-2xx and invalid SSE JSON are now covered; upstream SSE `event: error` preflight is still open.
- Unsafe response header stripping after conversion.
- Stream preflight behavior for empty streams and error events is covered for converted streams.
- Successful JSON response fallback to downstream stream is covered for Responses downstream via OpenAI Chat upstream.
- Traffic fields beyond tokens/status: `endpoint` path-only, body preview bytes/truncation, and broader field assertions. `client_ip`, `content_type`, `user_agent`, `route_source`, `matched_rule_id`, `matched_rule_name`, and stream error text have baseline coverage.
- Stream traffic usage extraction, invalid SSE error recording, empty stream handling, and upstream `event: error` handling are covered for converted streams.
- `only_stream` providers are covered for non-stream Chat downstream callers by aggregating upstream SSE into downstream JSON.

## Priority Checklist

- [ ] Decide protocol string alias policy and add smoke for old hyphenated names if compatibility is required.
- [ ] Add smoke for auth negative cases and local-without-auth remote semantics.
- [ ] Add smoke for route resolution direct route, default `*` route, disabled provider/model rejection, and route-plan ordering.
- [ ] Add smoke for JSON error-body shape compatibility and upstream non-2xx body wrapping across protocol boundaries.
- [ ] Add smoke for traffic body preview bytes/truncation and endpoint path normalization.
- [ ] Add smoke for request id/CORS behavior.
- [ ] Add smoke for unsafe header stripping after converted responses.
- [ ] Add smoke for Chat and Anthropic downstream JSON fallback to downstream SSE when downstream requested stream.
