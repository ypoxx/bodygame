export function createBossRoundManager(options = {}) {
  const interval = Math.max(3, Number(options.interval) || 6);
  const durationMs = Math.max(6000, Number(options.durationMs) || 12000);

  let bossState = {
    active: false,
    startedAt: 0,
    completedCount: 0,
    bonusMultiplier: 1,
  };

  function maybeActivate(answeredCount, now = performance.now()) {
    if (bossState.active) {
      return false;
    }

    if (answeredCount > 0 && answeredCount % interval === 0) {
      bossState = {
        ...bossState,
        active: true,
        startedAt: now,
        bonusMultiplier: 1.6,
      };
      return true;
    }

    return false;
  }

  function update(now = performance.now()) {
    if (!bossState.active) {
      return bossState;
    }

    if (now - bossState.startedAt >= durationMs) {
      bossState = {
        ...bossState,
        active: false,
        completedCount: bossState.completedCount + 1,
        bonusMultiplier: 1,
      };
    }

    return bossState;
  }

  function consumeHitBonus() {
    return bossState.active ? bossState.bonusMultiplier : 1;
  }

  function reset() {
    bossState = {
      active: false,
      startedAt: 0,
      completedCount: 0,
      bonusMultiplier: 1,
    };
  }

  function getState() {
    return { ...bossState };
  }

  return {
    maybeActivate,
    update,
    consumeHitBonus,
    reset,
    getState,
    interval,
  };
}
