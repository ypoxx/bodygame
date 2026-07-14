const MUTATOR_POOL = {
  no_zoom: {
    key: "no_zoom",
    label: "Zoom gesperrt",
    description: "Zoom ist während der Runde deaktiviert.",
    apply(context) {
      context.cameraController?.setZoomLocked(true);
    },
    unapply(context) {
      context.cameraController?.setZoomLocked(false);
    },
  },
  mirror_controls: {
    key: "mirror_controls",
    label: "Gespiegelt",
    description: "Rotation ist gespiegelt.",
    apply(context) {
      context.cameraController?.setMirrored(true);
    },
    unapply(context) {
      context.cameraController?.setMirrored(false);
    },
  },
  double_combo: {
    key: "double_combo",
    label: "Combo ×2",
    description: "Combo-Multiplikator steigt doppelt so schnell.",
    apply(context) {
      context.flags.comboScale = 2;
    },
    unapply(context) {
      context.flags.comboScale = 1;
    },
  },
  time_drain: {
    key: "time_drain",
    label: "Zeitsog",
    description: "Die Zeit läuft stetig schneller ab.",
    apply(context) {
      context.flags.timeDrainPerSec = 0.3;
    },
    unapply(context) {
      context.flags.timeDrainPerSec = 0;
    },
  },
};

function shuffle(items, rng) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function createMutatorEngine(rng = Math.random) {
  let activeMutators = [];

  function pickForMode(modeKey, rngOverride = null) {
    const random = typeof rngOverride === "function" ? rngOverride : rng;
    const keys = Object.keys(MUTATOR_POOL);
    const shuffled = shuffle(keys, random);

    const count = modeKey === "precision" ? 1 : 2;
    return shuffled.slice(0, count).map((key) => MUTATOR_POOL[key]);
  }

  function apply(mutators, context) {
    clear(context);
    activeMutators = mutators || [];
    for (const mutator of activeMutators) {
      mutator.apply(context);
    }
  }

  function clear(context) {
    for (const mutator of activeMutators) {
      mutator.unapply(context);
    }
    activeMutators = [];
  }

  function has(mutatorKey) {
    return activeMutators.some((mutator) => mutator.key === mutatorKey);
  }

  function list() {
    return [...activeMutators];
  }

  return {
    pickForMode,
    apply,
    clear,
    has,
    list,
  };
}
