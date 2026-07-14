const STORAGE_KEY = "aq3d.learningStats";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createAdaptiveSelector(quizItems = []) {
  let items = [...quizItems];
  let stats = loadStats();

  function setItems(nextItems) {
    items = [...nextItems];
  }

  function recordResult(id, isCorrect) {
    if (!id) {
      return;
    }

    const prev = stats[id] || { correct: 0, wrong: 0, seen: 0 };
    stats[id] = {
      correct: prev.correct + (isCorrect ? 1 : 0),
      wrong: prev.wrong + (isCorrect ? 0 : 1),
      seen: prev.seen + 1,
    };
    persistStats(stats);
  }

  function pickNextQuestion({ recentIds = [], rng = Math.random, itemsOverride = null } = {}) {
    const sourceItems = Array.isArray(itemsOverride) && itemsOverride.length ? itemsOverride : items;
    if (!sourceItems.length) {
      return null;
    }

    const recentSet = new Set(recentIds);
    const pool = sourceItems.filter((item) => !recentSet.has(item.id));
    const source = pool.length ? pool : sourceItems;

    const weighted = source.map((item) => {
      const s = stats[item.id] || { correct: 0, wrong: 0, seen: 0 };
      const weakness = (s.wrong + 1) / (s.correct + 1);
      const novelty = s.seen === 0 ? 1.6 : 1;
      const weight = clamp(weakness * novelty, 0.4, 5.2);
      return { item, weight };
    });

    const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    const pick = rng() * totalWeight;

    let cursor = 0;
    for (const entry of weighted) {
      cursor += entry.weight;
      if (pick <= cursor) {
        return entry.item;
      }
    }

    return weighted[weighted.length - 1].item;
  }

  function getWeakSpots(limit = 5) {
    const entries = Object.entries(stats)
      .map(([id, value]) => {
        const weakness = (value.wrong + 1) / (value.correct + 1);
        return { id, weakness, ...value };
      })
      .sort((a, b) => b.weakness - a.weakness);

    return entries.slice(0, limit);
  }

  return {
    setItems,
    recordResult,
    pickNextQuestion,
    getWeakSpots,
  };
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

function persistStats(stats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // optional persistence
  }
}
