const STORAGE_KEY = "aq3d.progression";

function initialState() {
  return {
    xp: 0,
    level: 1,
    badges: [],
    roundsPlayed: 0,
  };
}

function levelForXp(xp) {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 120)) + 1);
}

export function createProgressionEngine() {
  let state = loadState();

  function addRoundResult({ score = 0, accuracy = 0, rank = "C", modeKey = "speedrun" }) {
    const scoreXp = Math.round(score * 0.08);
    const accuracyXp = Math.round(accuracy * 3.2);
    const rankBonus = rank === "S" ? 260 : rank === "A" ? 170 : rank === "B" ? 90 : 35;
    const modeBonus = modeKey === "precision" ? 40 : modeKey === "sudden_death" ? 60 : 25;

    const gainedXp = Math.max(15, scoreXp + accuracyXp + rankBonus + modeBonus);
    const prevLevel = state.level;

    state = {
      ...state,
      xp: state.xp + gainedXp,
      roundsPlayed: state.roundsPlayed + 1,
    };

    state.level = levelForXp(state.xp);

    const newBadges = [];
    if (state.roundsPlayed === 1) {
      newBadges.push("rookie");
    }
    if (accuracy >= 90) {
      newBadges.push("precision_shot");
    }
    if (rank === "S") {
      newBadges.push("showstopper");
    }

    for (const badge of newBadges) {
      if (!state.badges.includes(badge)) {
        state.badges.push(badge);
      }
    }

    storeState(state);

    return {
      gainedXp,
      levelUp: state.level > prevLevel,
      prevLevel,
      currentLevel: state.level,
      badgesUnlocked: newBadges.filter((badge) => state.badges.includes(badge)),
      state: { ...state },
    };
  }

  function getState() {
    return { ...state, badges: [...state.badges] };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return initialState();
      }
      const parsed = JSON.parse(raw);
      return {
        xp: Number(parsed.xp) || 0,
        level: Number(parsed.level) || 1,
        badges: Array.isArray(parsed.badges) ? parsed.badges.filter(Boolean) : [],
        roundsPlayed: Number(parsed.roundsPlayed) || 0,
      };
    } catch {
      return initialState();
    }
  }

  function storeState(nextState) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch {
      // optional persistence
    }
  }

  return {
    addRoundResult,
    getState,
  };
}
