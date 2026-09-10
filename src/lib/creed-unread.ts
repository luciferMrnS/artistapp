const KEY = "creed_last_read_at";

/**
 * Record "now" as the moment the user last opened the creed.
 * Safe to call on every visit — it just resets the badge baseline.
 */
export function markCreedRead(): void {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* storage unavailable — ignore */
  }
}

/** Millisecond timestamp the user last opened the creed (0 = never). */
export function getCreedLastRead(): number {
  try {
    const raw = localStorage.getItem(KEY);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}