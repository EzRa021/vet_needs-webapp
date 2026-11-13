// Small per-browser conveniences (visible columns, dismissed banners).
// localStorage can be unavailable (private mode, blocked storage); these are
// conveniences, so failing quietly to the defaults is the right behaviour.

export function readStored(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

export function writeStored(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* not persisted; still applies for this visit */
  }
}
