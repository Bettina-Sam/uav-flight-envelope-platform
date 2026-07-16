import type { UAVInput } from '../types';

const STORAGE_KEY = 'uav-envelope-saved-configs';

export interface SavedConfig {
  id: string;
  name: string;
  savedAt: string;
  input: UAVInput;
}

/**
 * Saved Configurations, stored in the browser's localStorage. Kept
 * client-side (no backend/database) since this is single-user, per-browser
 * data — the simplest, most robust option that needs no server changes,
 * works offline, and needs no account system. If you later want configs
 * shared across devices or users, this is the place to swap in a backend
 * table keyed by a user id.
 */
export function listSavedConfigs(): SavedConfig[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveConfig(name: string, input: UAVInput): SavedConfig {
  const configs = listSavedConfigs();
  const entry: SavedConfig = {
    id: `cfg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || `Config ${configs.length + 1}`,
    savedAt: new Date().toISOString(),
    input,
  };
  const next = [entry, ...configs].slice(0, 50); // cap to keep localStorage tidy
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return entry;
}

export function deleteConfig(id: string): void {
  const next = listSavedConfigs().filter((c) => c.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function renameConfig(id: string, name: string): void {
  const next = listSavedConfigs().map((c) => (c.id === id ? { ...c, name } : c));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
