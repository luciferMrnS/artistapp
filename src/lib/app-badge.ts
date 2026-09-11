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
  if (!supportsBadging()) {
    // No Badging API (e.g. Android, where numbers aren't supported) — the
    // icon indicator is tied to active notifications instead. Clear those
    // when there's nothing left to read.
    if (count === 0) clearUnreadNotifications();
    return;
  }
  try {
    const value = count > 0 ? count : 0;
    if (value === 0) {
      void (navigator as Navigator & { clearAppBadge?: () => Promise<void> })
        .clearAppBadge?.();
      clearUnreadNotifications();
    } else {
      void (navigator as Navigator & { setAppBadge?: (n: number) => Promise<void> })
        .setAppBadge?.(value);
    }
  } catch {
    // Badge is best-effort
  }
}

/**
 * Tell the service worker to dismiss the "unread" notification. Whatever the
 * platform (Android dot, Windows/Mac number, iOS banner), the icon indicator
 * disappears once nothing is left to read.
 */
function clearUnreadNotifications(): void {
  try {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready.then((reg) =>
        reg.active?.postMessage({ type: "clear-unread" })
      );
    }
  } catch {
    // best-effort
  }
}