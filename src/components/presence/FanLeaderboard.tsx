"use client";

import { useEffect, useState } from "react";
import { Trophy, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveAvatarUrl } from "@/lib/avatar-url";
import { UserDmLink } from "@/components/dm/UserDmLink";

const COUNT_POLL_MS = 10_000;
const TOP_POLL_MS = 60_000;

type OnlineFan = { id: string; username: string; avatar: string | null };
type TopFan = OnlineFan & {
  email_verified: boolean;
  likes: number;
  comments: number;
  chats: number;
  onlineMinutes: number;
  score: number;
};

type Tab = "online" | "top";

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const RANK_STYLES: Record<number, string> = {
  1: "bg-amber-400/15 text-amber-300 ring-amber-400/40",
  2: "bg-zinc-400/15 text-zinc-300 ring-zinc-400/40",
  3: "bg-orange-500/15 text-orange-300 ring-orange-500/40",
};

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1",
        RANK_STYLES[rank] ?? "bg-white/5 text-secondary ring-white/10"
      )}
    >
      {rank}
    </span>
  );
}

function Avatar({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      src={failed ? "/default-avatar.png" : src}
      alt={name}
      className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/10"
      onError={() => setFailed(true)}
    />
  );
}

/**
 * "Fan club" card with two tabs — Online and Top fans.
 * - Online: live "right now" count (polls every 10s); tapping the number
 *   fetches and reveals the actual fans whose heartbeat is still fresh.
 * - Top fans: leaderboard ranked by activity volume — likes, comments,
 *   creed (chat) interactions and accumulated online time.
 */
export function FanLeaderboard() {
  const [tab, setTab] = useState<Tab>("online");
  const [count, setCount] = useState<number | null>(null);
  const [onlineFans, setOnlineFans] = useState<OnlineFan[] | null>(null);
  const [open, setOpen] = useState(false);
  const [topFans, setTopFans] = useState<TopFan[] | null>(null);

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
        /* keep the last known count */
      }
    };
    void refresh();
    const timer = setInterval(refresh, COUNT_POLL_MS);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      try {
        const res = await fetch("/api/fans/top?limit=3", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as { top?: TopFan[] };
        if (!disposed && Array.isArray(data.top)) {
          setTopFans(data.top);
        }
      } catch {
        /* keep the last known list */
      }
    };
    void refresh();
    const timer = setInterval(refresh, TOP_POLL_MS);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, []);

  const toggleOnline = async () => {
    if (!open && onlineFans === null) {
      try {
        const res = await fetch("/api/fans/online?list=1", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as { fans?: OnlineFan[] };
        if (Array.isArray(data.fans)) {
          setOnlineFans(data.fans);
        }
      } catch {
        /* ignore — collapse is still allowed */
      }
    }
    setOpen((value) => !value);
  };

  return (
    <div className="rounded-2xl border border-border bg-zinc-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Fan club</h3>
        <span className="relative flex h-2.5 w-2.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-black/40 p-1 text-sm">
        <button
          onClick={() => setTab("online")}
          className={cn(
            "rounded-lg px-3 py-1.5 transition",
            tab === "online"
              ? "bg-zinc-800 font-semibold text-white"
              : "text-secondary hover:text-white"
          )}
        >
          Online
        </button>
        <button
          onClick={() => setTab("top")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 transition",
            tab === "top"
              ? "bg-zinc-800 font-semibold text-white"
              : "text-secondary hover:text-white"
          )}
        >
          <Trophy className="h-4 w-4" />
          Top fans
        </button>
      </div>

      {tab === "online" ? (
        <>
          <div className="rounded-xl bg-black/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-secondary">Right now</span>
              <button
                onClick={toggleOnline}
                title={open ? "Hide online fans" : "Show which fans are online"}
                className={cn(
                  "flex items-center gap-2 font-bold tabular-nums transition",
                  open ? "text-emerald-300" : "text-emerald-400 hover:text-emerald-300"
                )}
              >
                <UsersRound className="h-4 w-4" />
                {count === null ? "\u2026" : formatCount(count)}
              </button>
            </div>

            {open && (
              <div className="mt-3 border-t border-white/5 pt-3">
                {onlineFans === null ? (
                  <p className="text-xs text-secondary">Loading\u2026</p>
                ) : onlineFans.length === 0 ? (
                  <p className="text-xs text-secondary">Nobody online right now.</p>
                ) : (
                  <ul className="max-h-48 space-y-1.5 overflow-y-auto">
                    {onlineFans.map((fan) => (
                      <li key={fan.id} className="flex items-center gap-2">
                        <span className="relative shrink-0">
                          <Avatar src={resolveAvatarUrl(fan.avatar)} name={fan.username} />
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-zinc-900" />
                        </span>
                        <UserDmLink
                          userId={fan.id}
                          username={fan.username}
                          className="truncate text-sm text-white"
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <p className="mt-2 text-xs text-secondary">
            {count === null
              ? "Connecting\u2026"
              : count === 1
                ? "1 fan is here right now"
                : `${formatCount(count)} fans are here right now`}
            {" — tap the number to see them."}
          </p>
        </>
      ) : (
        <>
          {topFans === null ? (
            <p className="rounded-xl bg-black/40 p-3 text-xs text-secondary">Loading\u2026</p>
          ) : topFans.length === 0 ? (
            <p className="rounded-xl bg-black/40 p-3 text-xs text-secondary">
              Not enough activity yet — fans earn points for likes, comments, creed
              chats and time online.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {topFans.map((fan, index) => {
                const rank = index + 1;
                return (
                  <li key={fan.id} className="flex items-center gap-3">
                    <RankBadge rank={rank} />
                    <Avatar src={resolveAvatarUrl(fan.avatar)} name={fan.username} />
                    <div className="min-w-0 flex-1">
                      <UserDmLink
                        userId={fan.id}
                        username={fan.username}
                        className="block truncate text-sm font-medium text-white"
                      />
                      <span className="block truncate text-[11px] text-secondary">
                        {fan.likes} like{fan.likes === 1 ? "" : "s"} ·{" "}
                        {fan.comments} comment{fan.comments === 1 ? "" : "s"} ·{" "}
                        {fan.chats} chat{fan.chats === 1 ? "" : "s"} ·{" "}
                        {formatDuration(fan.onlineMinutes)} online
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
                      {Math.round(fan.score * 10) / 10}
                      <span className="ml-0.5 text-[10px] font-medium text-secondary">pts</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}