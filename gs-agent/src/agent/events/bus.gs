export function createEventBus() {
  let listeners = {};

  function eventListeners(event) {
    let key = String(event || "");
    if (!listeners[key]) {
      listeners[key] = [];
    }
    return listeners[key];
  }

  function on(event, fn) {
    if (!fn) {
      throw new TypeError("event bus listener is required");
    }
    eventListeners(event).push({
      fn: fn,
      once: false,
    });
    return function() {
      off(event, fn);
    };
  }

  function once(event, fn) {
    if (!fn) {
      throw new TypeError("event bus listener is required");
    }
    eventListeners(event).push({
      fn: fn,
      once: true,
    });
    return function() {
      off(event, fn);
    };
  }

  function off(event, fn) {
    let key = String(event || "");
    let items = listeners[key];
    if (!items) {
      return false;
    }
    let next = [];
    let removed = false;
    for (let item of items) {
      if (item.fn === fn) {
        removed = true;
      } else {
        next.push(item);
      }
    }
    if (next.length === 0) {
      delete listeners[key];
    } else {
      listeners[key] = next;
    }
    return removed;
  }

  function emit(event, payload) {
    let key = String(event || "");
    let items = listeners[key];
    if (!items || items.length === 0) {
      return 0;
    }

    let snapshot = items.slice(0);
    let called = 0;
    for (let item of snapshot) {
      item.fn(payload);
      called = called + 1;
      if (item.once) {
        off(key, item.fn);
      }
    }
    return called;
  }

  function listenerCount(event) {
    let items = listeners[String(event || "")];
    if (!items) {
      return 0;
    }
    return items.length;
  }

  return {
    on: on,
    once: once,
    off: off,
    emit: emit,
    listenerCount: listenerCount,
  };
}
