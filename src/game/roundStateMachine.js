const TRANSITIONS = {
  idle: new Set(["countdown"]),
  countdown: new Set(["active", "ended"]),
  active: new Set(["ended"]),
  ended: new Set(["idle", "countdown"]),
};

export function createRoundStateMachine(initialState = "idle") {
  let currentState = initialState;

  function canTransition(nextState) {
    return TRANSITIONS[currentState]?.has(nextState) || false;
  }

  function transition(nextState, force = false) {
    if (!force && !canTransition(nextState)) {
      return false;
    }
    currentState = nextState;
    return true;
  }

  function reset() {
    currentState = "idle";
  }

  function getState() {
    return currentState;
  }

  return {
    canTransition,
    transition,
    reset,
    getState,
  };
}
