"use client";

import { useEffect } from "react";

const HEARTBEAT_MS = 20_000;

/**
 * Sends a presence heartbeat to /api/presence every ~20s while the tab is
 * visible, so the "Fans online" widget can count live users. Pauses while
 * the tab is backgrounded — a hidden tab stops counting as "online" once the
 * server's online window expires upstream.
 */
export function PresenceHeartbeat() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    const ping = () => {
      fetch("/api/presence", { method: "POST", credentials: "include" }).catch(
        () => {
          /* heartbeat is best-effort; ignore failures */
        }
      );
    };

    const stop = () => {
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    };

    const start = () => {
      stop();
      ping();
      timer = setInterval(ping, HEARTBEAT_MS);
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onVisibility);
      stop();
    };
  }, []);

  return null;
}