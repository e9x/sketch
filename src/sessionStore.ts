/**
 * Thin wrapper around sessionStorage for temporary data that persists across
 * reloads within the same tab but is discarded when the tab is closed.
 */

const PREFIX = "_nn_";

export const sessionStore = {
  get<T>(key: string): T | null {
    try {
      const raw = sessionStorage.getItem(PREFIX + key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown): void {
    try {
      sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {}
  },
  remove(key: string): void {
    try {
      sessionStorage.removeItem(PREFIX + key);
    } catch {}
  },
};
