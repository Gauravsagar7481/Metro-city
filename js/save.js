// save.js — localStorage-based save system

const SAVE_KEY = 'metrocity_save_v1';

export function hasSave() {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function saveGame(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error('Save failed:', err);
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Load failed:', err);
    return null;
  }
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}

// Builds the save payload from the live game objects.
export function buildSaveState({ player, money, settings, unlockedAreas }) {
  return {
    version: 1,
    savedAt: Date.now(),
    player: {
      position: player ? [player.position.x, player.position.y, player.position.z] : [0, 0, 0],
      heading: player ? player.heading : 0,
    },
    money: money ?? 500,
    settings: settings ? settings.toJSON() : undefined,
    unlockedAreas: unlockedAreas || ['downtown_block_1'],
  };
}
