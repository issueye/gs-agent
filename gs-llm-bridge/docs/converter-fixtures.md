# Converter Fixtures

`smoke-converters.gs` is a direct fixture smoke for the exported non-streaming converter API:

- `convertRequest(downstream, upstream, body, model, defaultMaxTokens)`
- `convertResponse(downstream, upstream, body, model)`
- `convertStream(downstream, upstream, upstreamResponse, res, model)`

Run from `E:\codes\gts_codes\gs-llm-bridge`:

```powershell
..\gts\gs.exe --timeout 30s smoke-converters.gs
```

Expected output:

```text
converter smoke ok
```

## Covered Fixtures

The smoke covers these current non-streaming shapes:

- OpenAI Chat request -> Anthropic request
  - basic system/user text
  - function tool schema
- OpenAI Responses request -> Anthropic request
  - `instructions` to Anthropic `system`
  - `input_text` to user message text
- OpenAI Chat request -> OpenAI Responses request
  - assistant `tool_calls`
  - multiple tool calls
  - `tool` role result to `function_call_output`
- Anthropic request -> OpenAI Responses request
  - assistant `tool_use` to `function_call`
- Anthropic response -> OpenAI Chat response
  - text plus multiple `tool_use` blocks
  - `tool_use` stop reason to `tool_calls`
- OpenAI Chat response -> Anthropic response
  - text plus multiple `tool_calls`
  - usage mapping
- OpenAI Responses response -> OpenAI Chat response
  - output text plus multiple `function_call` items
- Anthropic response -> OpenAI Responses response
  - basic output text
  - usage total calculation

The smoke also covers these direct streaming converter fixtures:

- OpenAI Chat stream -> Anthropic stream
  - text delta conversion
  - usage mapping from streamed Chat `usage`
  - `[DONE]` stops conversion before later data
- OpenAI Chat stream -> OpenAI Responses stream
  - streamed tool-call start and argument deltas
  - argument completion event
  - usage total calculation when only prompt/completion tokens are supplied
  - `[DONE]` stops conversion before later data
- Anthropic stream -> OpenAI Chat stream
  - streamed `tool_use` to Chat `tool_calls`
  - `tool_use` stop reason to `tool_calls`
  - invalid SSE JSON is reported while later valid events still convert
  - usage total calculation from message start and delta events
  - terminal `[DONE]` output
- OpenAI Responses stream -> OpenAI Chat stream
  - streamed `function_call` to Chat `tool_calls`
  - streamed argument deltas
  - completed response usage mapping
  - terminal `[DONE]` output

## Known Fixture Gaps

These are not forced into the smoke because the current converter surface either drops detail or has ambiguous cross-protocol semantics:

- Anthropic `tool_result` request blocks do not yet map to OpenAI Chat `tool` role messages.
- OpenAI Chat `tool` role messages convert to Responses `function_call_output`, but the converter also emits a generic message item for that role. The smoke asserts the required function result item and leaves the extra item as current behavior.
- Responses request `function_call_output` items are not yet converted back to Chat `tool` role messages or Anthropic `tool_result` blocks.
- Multimodal image fixtures are not covered here; this smoke is scoped to text and tools.
- Streaming Responses -> Anthropic and Anthropic -> Responses fixtures currently cover text through proxy smoke, but direct converter fixtures for streamed tool-use in those two directions are still pending.
- Invalid SSE handling is asserted for Anthropic -> Chat direct conversion; broader invalid-SSE coverage remains in proxy smoke.

## Suggested Next Fixture Additions

When converter behavior is expanded, add fixtures for:

- Anthropic `tool_result` -> OpenAI Chat `tool` role.
- Responses `function_call_output` -> OpenAI Chat `tool` role.
- Responses `function_call_output` -> Anthropic `tool_result`.
- Round-trip request fixtures for tool calls and tool results across all three protocols.
- Image content mapping across Chat, Anthropic, and Responses.
- Direct converter fixtures for Responses -> Anthropic streamed tool calls.
- Direct converter fixtures for Anthropic -> Responses streamed tool calls.
