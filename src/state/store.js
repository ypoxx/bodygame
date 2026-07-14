export function createStore(initialState = {}) {
  let state = { ...initialState };
  const subscribers = new Set();

  function getState() {
    return state;
  }

  function setState(patch, meta = "setState") {
    const nextState = typeof patch === "function" ? patch(state) : { ...state, ...patch };
    if (!nextState || nextState === state) {
      return state;
    }
    const prevState = state;
    state = nextState;

    for (const subscriber of subscribers) {
      try {
        subscriber(state, prevState, meta);
      } catch (error) {
        console.error("Store subscriber failed", error);
      }
    }

    return state;
  }

  function subscribe(handler) {
    subscribers.add(handler);
    return () => {
      subscribers.delete(handler);
    };
  }

  return {
    getState,
    setState,
    subscribe,
  };
}
