// lib/timeout.gs - 超时控制

export function createTimeoutController(timeoutMs) {
  let timerId = null;
  let cancelled = false;

  return {
    start: function(callback) {
      if (cancelled) return;
      timerId = setTimeout(callback, timeoutMs);
    },

    cancel: function() {
      cancelled = true;
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
    },

    isCancelled: function() {
      return cancelled;
    },
  };
}
