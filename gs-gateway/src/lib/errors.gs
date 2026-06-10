// lib/errors.gs - 统一错误处理

export function wrapHandler(fn) {
  return function(...args) {
    try {
      return fn(...args);
    } catch (error) {
      return {
        ok: false,
        error: {
          code: error.code || "INTERNAL_ERROR",
          message: String(error.message || error),
        },
      };
    }
  };
}

export function createError(code, message) {
  let err = new Error(message);
  err.code = code;
  return err;
}
