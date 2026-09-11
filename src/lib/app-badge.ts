"use client";

/**
 * App-icon badge (the red count bubble on the Home Screen / taskbar icon).
 * Android + desktop Chrome support it via the App Badging API; iOS does not
 * support it for web apps, so there these are safe no-ops.
 */

function supportsBadging(): boolean {
  return typeof navigator !== "undefined" && "setAppBadge" in navigator;
}

/** Set the badge to a number (0 clears it). */
export function setAppBadge(count: number): void {
  if (!supportsBadging()) return;
  try {
    const value = count > 0 ? count : 0;
    if (value === 0) {
      void (navigator as Navigator & { clearAppBadge?: () => Promise<void> })
        .clearAppBadge?.();
    } else {
      void (navigator as Navigator & { setAppBadge?: (n: number) => Promise<void> })
        .setAppBadge?.(value);
    }
  } catch {
    // Badge is best-effort
  }
}