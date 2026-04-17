(() => {
  const STORAGE_KEY = 'edible-inedible.v1';

  function loadStats() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { bestScore: 0, bestLevel: 1, played: 0 };
      const parsed = JSON.parse(raw);
      return {
        bestScore: Number(parsed.bestScore) || 0,
        bestLevel: Number(parsed.bestLevel) || 1,
        played: Number(parsed.played) || 0,
      };
    } catch {
      return { bestScore: 0, bestLevel: 1, played: 0 };
    }
  }

  const stats = loadStats();

  const bestScoreEl = document.getElementById('bestScore');
  const bestLevelEl = document.getElementById('bestLevel');
  const playedEl = document.getElementById('played');

  if (bestScoreEl) bestScoreEl.textContent = String(stats.bestScore);
  if (bestLevelEl) bestLevelEl.textContent = String(stats.bestLevel);
  if (playedEl) playedEl.textContent = String(stats.played);
})();

