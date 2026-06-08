export const SESSION_EVENT_UPDATE = 'session/update'
export const SESSION_EVENT_COMPLETED = 'session/completed'
export const SESSION_EVENT_ERROR = 'session/error'
export const SESSION_EVENT_ACCEPTED = 'session/accepted'

export const SESSION_UPDATE_AGENT_MESSAGE = 'agent_message_chunk'
export const SESSION_UPDATE_TOOL_CALL = 'tool_call'
export const SESSION_UPDATE_TOOL_CALL_UPDATE = 'tool_call_update'
export const SESSION_UPDATE_USAGE = 'usage_update'

export function normalizeSessionFrame(raw = {}) {
  return {
    type: raw.type || '',
    conversationId: raw.conversation_id || raw.conversationId || '',
    sessionId: raw.session_id || raw.sessionId || '',
    requestId: raw.request_id || raw.requestId || '',
    update: normalizeSessionUpdate(raw.update),
    stopReason: raw.stop_reason || raw.stopReason || '',
    code: raw.code || '',
    error: raw.error || '',
    metadata: raw.metadata || {},
  }
}

export function normalizeSessionUpdate(update = null) {
  if (!update) {
    return null
  }
  return {
    sessionUpdate: update.sessionUpdate || update.session_update || '',
    content: normalizeContentBlock(update.content),
    messageId: update.messageId || update.message_id || '',
    toolCallId: update.toolCallId || update.tool_call_id || '',
    title: update.title || '',
    kind: update.kind || '',
    status: update.status || '',
    locations: Array.isArray(update.locations) ? update.locations : [],
    rawInput: update.rawInput ?? update.raw_input ?? null,
    rawOutput: update.rawOutput ?? update.raw_output ?? null,
    usage: normalizeUsage(update.usage),
  }
}

export function dispatchSessionFrame(frame, handlers = {}) {
  switch (frame?.type) {
    case SESSION_EVENT_ACCEPTED:
      handlers.onAccepted?.(frame)
      break
    case SESSION_EVENT_UPDATE:
      handlers.onUpdate?.(frame)
      break
    case SESSION_EVENT_COMPLETED:
      handlers.onCompleted?.(frame)
      break
    case SESSION_EVENT_ERROR:
      handlers.onError?.(frame)
      break
    default:
      handlers.onUnhandled?.(frame)
      break
  }
}

export function isDisplayableSessionUpdate(update = null) {
  return [
    SESSION_UPDATE_AGENT_MESSAGE,
    SESSION_UPDATE_TOOL_CALL,
    SESSION_UPDATE_TOOL_CALL_UPDATE,
    SESSION_UPDATE_USAGE,
  ].includes(update?.sessionUpdate)
}

function normalizeContentBlock(content = null) {
  if (!content) {
    return null
  }
  return {
    type: content.type || '',
    text: content.text || '',
    uri: content.uri || content.URI || '',
    mimeType: content.mimeType || content.mime_type || content.mime || '',
    data: content.data ?? null,
  }
}

function normalizeUsage(usage = null) {
  if (!usage) {
    return null
  }
  return {
    inputTokens: Number(usage.inputTokens ?? usage.input_tokens ?? 0),
    outputTokens: Number(usage.outputTokens ?? usage.output_tokens ?? 0),
    totalTokens: Number(usage.totalTokens ?? usage.total_tokens ?? 0),
  }
}
