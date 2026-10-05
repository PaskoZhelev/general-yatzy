const STATS_KEY = 'general-yatzy-stats';

const EMPTY_STATS = { played: 0, wins: 0, losses: 0, ties: 0, bestScore: 0, recordedGameIds: [] };
// Only recent ids are needed to stop a finished game from being counted twice.
const MAX_TRACKED_IDS = 20;

const isCount = (n) => Number.isInteger(n) && n >= 0;

export const loadStats = () => {
  try {
    const s = JSON.parse(localStorage.getItem(STATS_KEY));
    if (s && isCount(s.played) && isCount(s.wins) && isCount(s.losses) && isCount(s.ties) &&
        Array.isArray(s.recordedGameIds)) {
      // Older saves predate bestScore
      return { ...s, bestScore: isCount(s.bestScore) ? s.bestScore : 0 };
    }
  } catch {
    // Corrupt or inaccessible stats - start fresh
  }
  return EMPTY_STATS;
};

export const recordResult = (gameId, outcome, playerScore) => {
  const stats = loadStats();
  if (stats.recordedGameIds.includes(gameId)) return;
  const key = { win: 'wins', loss: 'losses', tie: 'ties' }[outcome];
  const updated = {
    ...stats,
    played: stats.played + 1,
    [key]: stats[key] + 1,
    bestScore: Math.max(stats.bestScore, playerScore),
    recordedGameIds: [...stats.recordedGameIds, gameId].slice(-MAX_TRACKED_IDS),
  };
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(updated));
  } catch {
    // Storage full or disabled - stats just won't persist
  }
};

export const resetStats = () => {
  try {
    localStorage.removeItem(STATS_KEY);
  } catch {
    // Nothing to clear
  }
};
