// Thin, isolated persistence wrapper. The ONLY place that touches localStorage,
// so it can be swapped for Capacitor Preferences / a file store later without
// changing game code. All methods fail soft if storage is unavailable.

const PREFIX = 'phg_holdspin_';

function available() {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export const storage = {
  get(key, fallback = null) {
    if (!available()) return fallback;
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    if (!available()) return;
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  },
  remove(key) {
    if (!available()) return;
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  },
};
