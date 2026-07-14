function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function computeAnswerScore({
  isCorrect,
  reactionSeconds,
  combo,
  modeConfig,
  bossMultiplier = 1,
  mutatorKeys = [],
}) {
  if (!isCorrect) {
    return {
      pointsDelta: -(modeConfig?.wrongPenalty || 0),
      comboNext: 0,
      streakNext: 0,
      multiplierNext: 1,
      speedBonus: 0,
      basePoints: 0,
      totalPoints: 0,
    };
  }

  const basePoints = 100;
  const speedBonus = Math.max(0, Math.round((8 - reactionSeconds) * 14));

  const comboScale = mutatorKeys.includes("double_combo") ? 2 : 1;
  const comboNext = combo + 1;
  const multiplierTier = Math.floor((comboNext * comboScale) / 2) * 0.2;
  const multiplierNext = 1 + clamp(multiplierTier, 0, 2.5);

  const totalRaw = (basePoints + speedBonus) * multiplierNext * bossMultiplier;
  const totalPoints = Math.round(totalRaw);

  return {
    pointsDelta: totalPoints,
    comboNext,
    streakNext: comboNext,
    multiplierNext,
    speedBonus,
    basePoints,
    totalPoints,
  };
}

export function computeAccuracy(correct, answered) {
  if (!answered) {
    return 0;
  }
  return Math.round((correct / answered) * 100);
}

export function computeRank({ score, accuracy, bossHits = 0 }) {
  const scoreWithBoss = score + bossHits * 120;
  if (scoreWithBoss >= 2200 && accuracy >= 88) {
    return "S";
  }
  if (scoreWithBoss >= 1500 && accuracy >= 80) {
    return "A";
  }
  if (scoreWithBoss >= 950 && accuracy >= 70) {
    return "B";
  }
  return "C";
}
