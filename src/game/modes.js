export const GAME_MODES = {
  speedrun: {
    key: "speedrun",
    label: "Speedrun",
    durationSec: 75,
    targetAnswers: null,
    lives: null,
    wrongPenalty: 36,
    skipPenalty: 22,
    timeBonusOnCorrect: 1.25,
    suddenDeath: false,
    description: "Maximale Treffer in begrenzter Zeit.",
  },
  sudden_death: {
    key: "sudden_death",
    label: "Sudden Death",
    durationSec: 90,
    targetAnswers: null,
    lives: 1,
    wrongPenalty: 0,
    skipPenalty: 0,
    timeBonusOnCorrect: 0,
    suddenDeath: true,
    description: "Ein Fehler und die Runde ist vorbei.",
  },
  precision: {
    key: "precision",
    label: "Precision",
    durationSec: 120,
    targetAnswers: 12,
    lives: 3,
    wrongPenalty: 18,
    skipPenalty: 14,
    timeBonusOnCorrect: 0,
    suddenDeath: false,
    description: "Qualitaet vor Quantitaet mit limitierten Versuchen.",
  },
};

export function getMode(modeKey) {
  return GAME_MODES[modeKey] || GAME_MODES.speedrun;
}
