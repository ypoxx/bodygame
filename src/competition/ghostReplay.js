const STORAGE_PREFIX = "aq3d.ghost";

export function createGhostReplay() {
  let currentRun = null;

  function startRun({ modeKey, seed }) {
    currentRun = {
      modeKey,
      seed,
      startedAt: performance.now(),
      events: [],
    };
  }

  function recordEvent(event) {
    if (!currentRun) {
      return;
    }

    currentRun.events.push({
      ...event,
      at: performance.now() - currentRun.startedAt,
    });
  }

  function finishRun(summary) {
    if (!currentRun) {
      return null;
    }

    const run = {
      ...currentRun,
      summary,
    };

    currentRun = null;

    const key = getStorageKey(run.modeKey, run.seed);
    const previous = loadGhost(run.modeKey, run.seed);
    if (!previous || Number(summary.score) > Number(previous.summary?.score || 0)) {
      storeGhost(key, run);
      return run;
    }

    return previous;
  }

  function loadGhost(modeKey, seed) {
    const key = getStorageKey(modeKey, seed);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  return {
    startRun,
    recordEvent,
    finishRun,
    loadGhost,
  };
}

function getStorageKey(modeKey, seed) {
  return `${STORAGE_PREFIX}.${modeKey}.${seed ?? "default"}`;
}

function storeGhost(key, run) {
  try {
    localStorage.setItem(key, JSON.stringify(run));
  } catch {
    // optional persistence
  }
}
