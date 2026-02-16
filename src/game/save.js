export const SAVE_KEY = 'life-sim-save-v1';

export function saveGameState(state) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function loadGameState() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}
