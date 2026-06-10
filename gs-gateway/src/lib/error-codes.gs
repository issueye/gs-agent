// lib/error-codes.gs - 统一错误码

export const ErrorCodes = {
  // 网关错误
  INVALID_REQUEST: "INVALID_REQUEST",
  MISSING_FIELD: "MISSING_FIELD",

  // Agent 错误
  AGENT_NOT_FOUND: "AGENT_NOT_FOUND",
  AGENT_TIMEOUT: "AGENT_TIMEOUT",
  AGENT_TASK_FAILED: "AGENT_TASK_FAILED",

  // 系统错误
  NETWORK_ERROR: "NETWORK_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
};

export function createErrorResponse(code, message, metadata) {
  return {
    ok: false,
    error: {
      code: code,
      message: String(message || ""),
      metadata: metadata || {},
      timestamp: (new Date()).toISOString(),
    },
  };
}
