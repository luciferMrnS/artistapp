"use client";

import { useEffect, useState } from "react";
import { UsersRound } from "lucide-react";

const POLL_MS = 10_000;

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Live "fans online" card. Polls /api/fans/online every 10s so the number
 * tracks real-time presence heartbeats (users drop off ~60s after closing
 * their tab). Shows the last known count on transient failures.
 */
export function FansOnlineWidget() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let disposed = false;

    const refresh = async () => {
      try {
        const res = await fetch("/api/fans/online", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as { count?: number };
        if (!disposed && typeof data.count === "number") {
          setCount(data.count);
        }
      } catch {
        /* keep showing the last known count */
      }
    };

    void refresh();
    const timer = setInterval(refresh, POLL_MS);

    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-zinc-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Fans online</h3>
        <span className="relative flex h-2.5 w-2.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-black/40 p-3">
        <span className="text-secondary">Right now</span>
        <span className="flex items-center gap-2 font-bold tabular-nums text-emerald-400">
          <UsersRound className="h-4 w-4" />
          {count === null ? "\u2026" : formatCount(count)}
        </span>
      </div>

      <p className="mt-2 text-xs text-secondary">
        {count === null
          ? "Connecting\u2026"
          : count === 1
            ? "1 fan is here right now"
            : `${formatCount(count)} fans are here right now`}
      </p>
    </div>
  );
}