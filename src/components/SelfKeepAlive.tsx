"use client";

import { useEffect } from "react";

const PING_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Background keep-alive that pings /api/health every 10 minutes regardless
 * of tab visibility. Uses `keepalive` so the fetch completes even when the
 * tab is hidden (browsers normally throttle or kill timers in background tabs).
 *
 * This is a safety net: the GitHub Actions cron is the primary keep-alive,
 * but cron workflows get silently disabled after 60 days of repo inactivity.
 */
export function SelfKeepAlive() {
  useEffect(() => {
    const ping = () => {
      fetch("/api/health", { keepalive: true }).catch(() => {
        /* best-effort */
      });
    };

    ping();
    const id = setInterval(ping, PING_MS);
    return () => clearInterval(id);
  }, []);

  return null;
}
