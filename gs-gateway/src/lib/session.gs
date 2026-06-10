// lib/session.gs - 会话上下文管理

export function createSessionContext(conversationId, sessionId, requestId) {
  let ctx = {
    conversationId: String(conversationId || ""),
    sessionId: String(sessionId || ""),
    requestId: String(requestId || ""),
  };

  ctx.frame = function(type, payload) {
    let p = payload || {};
    return {
      type: type,
      conversation_id: ctx.conversationId,
      session_id: ctx.sessionId,
      request_id: ctx.requestId,
      at: (new Date()).toISOString(),
      update: p.update || null,
      stop_reason: String(p.stopReason || ""),
      code: String(p.code || ""),
      error: String(p.error || ""),
      metadata: p.metadata || {},
    };
  };

  return ctx;
}
