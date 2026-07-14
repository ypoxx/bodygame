export function createEventBus() {
  const listeners = new Map();

  function on(eventName, handler) {
    if (!listeners.has(eventName)) {
      listeners.set(eventName, new Set());
    }
    listeners.get(eventName).add(handler);
    return () => off(eventName, handler);
  }

  function once(eventName, handler) {
    const unsubscribe = on(eventName, (payload) => {
      unsubscribe();
      handler(payload);
    });
    return unsubscribe;
  }

  function off(eventName, handler) {
    const set = listeners.get(eventName);
    if (!set) {
      return;
    }
    set.delete(handler);
    if (set.size === 0) {
      listeners.delete(eventName);
    }
  }

  function emit(eventName, payload) {
    const set = listeners.get(eventName);
    if (!set) {
      return;
    }
    for (const handler of set) {
      try {
        handler(payload);
      } catch (error) {
        console.error("Event bus handler failed", eventName, error);
      }
    }
  }

  function clear() {
    listeners.clear();
  }

  return {
    on,
    once,
    off,
    emit,
    clear,
  };
}
