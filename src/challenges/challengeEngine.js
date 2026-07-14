function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function buildSeededRandom(seedValue) {
  let seed = seedValue >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function getWeekNumber(date) {
  const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const current = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = Math.floor((current - first) / 86400000);
  return Math.floor((day + first.getUTCDay()) / 7) + 1;
}

export function createChallengeEngine() {
  function getDailyChallenge(date = new Date()) {
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
    const seed = hashString(`daily-${key}`);

    const rng = buildSeededRandom(seed);
    const types = ["speed", "accuracy", "combo", "perfect"];
    const type = types[Math.floor(rng() * types.length)];

    const target =
      type === "speed"
        ? 1200 + Math.floor(rng() * 600)
        : type === "accuracy"
          ? 82 + Math.floor(rng() * 13)
          : type === "combo"
            ? 8 + Math.floor(rng() * 8)
            : 10 + Math.floor(rng() * 6);

    return {
      key,
      seed,
      type,
      target,
      label:
        type === "speed"
          ? `Erreiche ${target} Punkte im Speedrun`
          : type === "accuracy"
            ? `Halte ${target}% Genauigkeit`
            : type === "combo"
              ? `Erreiche Combo x${target}`
              : `Treffe ${target} Strukturen ohne Fehler`,
    };
  }

  function getWeeklyChallenge(date = new Date()) {
    const week = getWeekNumber(date);
    const key = `${date.getUTCFullYear()}-W${week}`;
    const seed = hashString(`weekly-${key}`);
    const rng = buildSeededRandom(seed);

    const requirements = {
      rounds: 4 + Math.floor(rng() * 4),
      score: 3200 + Math.floor(rng() * 1600),
      accuracy: 75 + Math.floor(rng() * 16),
    };

    return {
      key,
      seed,
      requirements,
      label: `Spiele ${requirements.rounds} Runden, erreiche ${requirements.score} Gesamtpunkte und ${requirements.accuracy}% Genauigkeit`,
    };
  }

  function evaluateDaily(challenge, stats) {
    if (!challenge) {
      return false;
    }

    if (challenge.type === "speed") {
      return stats.score >= challenge.target;
    }
    if (challenge.type === "accuracy") {
      return stats.accuracy >= challenge.target;
    }
    if (challenge.type === "combo") {
      return stats.maxCombo >= challenge.target;
    }
    return stats.perfectHits >= challenge.target;
  }

  return {
    getDailyChallenge,
    getWeeklyChallenge,
    evaluateDaily,
    buildSeededRandom,
  };
}
