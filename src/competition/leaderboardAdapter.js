const STORAGE_KEY = "aq3d.localLeaderboard";

export function createLeaderboardAdapter() {
  let leaderboard = loadLeaderboard();

  function submitEntry(entry) {
    const normalized = {
      id: `${Date.now()}-${Math.round(Math.random() * 999999)}`,
      modeKey: entry.modeKey,
      score: Number(entry.score) || 0,
      accuracy: Number(entry.accuracy) || 0,
      rank: entry.rank || "C",
      timestamp: Date.now(),
    };

    leaderboard.push(normalized);
    leaderboard = leaderboard.sort((a, b) => b.score - a.score).slice(0, 20);
    persistLeaderboard(leaderboard);

    return normalized;
  }

  function top(modeKey, limit = 5) {
    const filtered = modeKey ? leaderboard.filter((item) => item.modeKey === modeKey) : leaderboard;
    return filtered.slice(0, limit);
  }

  return {
    submitEntry,
    top,
  };
}

function loadLeaderboard() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

function persistLeaderboard(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // optional persistence
  }
}
