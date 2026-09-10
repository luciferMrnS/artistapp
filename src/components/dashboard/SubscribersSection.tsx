"use client";

import { useState } from "react";
import {
  Users,
  BadgeCheck,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
  UserPlus,
  UserRoundX,
} from "lucide-react";
import { resolveAvatarUrl } from "@/lib/avatar-url";
import type { RegisteredFanRow } from "@/lib/db";

const PAGE_SIZE = 10;

type Action = "restrict" | "unrestrict" | "delete";

/**
 * Dashboard fan-accounts list — shows 10 at a time with a "View all" toggle,
 * plus artist controls to set any fan (subscribed or not) to view-only or
 * delete their account.
 */
export function SubscribersSection({ fans }: { fans: RegisteredFanRow[] }) {
  const [items, setItems] = useState<RegisteredFanRow[]>(fans);
  const [showAll, setShowAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const visible = showAll ? items : items.slice(0, PAGE_SIZE);

  const runAction = async (sub: RegisteredFanRow, action: Action) => {
    setActionError("");

    if (action === "delete") {
      const ok = window.confirm(
        `Delete the account of ${sub.username}? This permanently removes their posts, comments, likes and chats.`
      );
      if (!ok) return;
    }

    setBusyId(sub.id);
    try {
      const res = await fetch(`/api/admin/users/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error || "Action failed");
        return;
      }

      if (action === "delete") {
        setItems((prev) => prev.filter((s) => s.id !== sub.id));
      } else {
        setItems((prev) =>
          prev.map((s) =>
            s.id === sub.id
              ? { ...s, restricted_at: action === "restrict" ? new Date().toISOString() : null }
              : s
          )
        );
      }
    } catch {
      setActionError("Something went wrong");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-zinc-900 p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Users className="h-5 w-5 text-sky-400" /> Fan accounts
        <span className="ml-auto rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-secondary">
          {items.length}
        </span>
      </h2>

      {actionError && (
        <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {actionError}
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-secondary">
          No fan accounts yet — people who register will appear here.
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((sub) => {
            const restricted = Boolean(sub.restricted_at);
            return (
              <li
                key={sub.id}
                className="flex items-center gap-3 rounded-xl bg-black/40 px-3 py-2.5"
              >
                <img
                  src={resolveAvatarUrl(sub.avatar)}
                  alt={sub.username}
                  className="h-9 w-9 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                    {sub.username}
                    {sub.email_verified && (
                      <span title="Verified email">
                        <BadgeCheck className="h-4 w-4 shrink-0 text-sky-400" />
                      </span>
                    )}
                    {restricted && (
                      <span
                        title="View-only account"
                        className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400"
                      >
                        <EyeOff className="h-3 w-3" /> View-only
                      </span>
                    )}
                    {!restricted && (
                      <span
                        title={sub.subscribed ? "Subscribed to the artist" : "Not subscribed"}
                        className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-secondary"
                      >
                        {sub.subscribed ? (
                          <>
                            <UserPlus className="h-3 w-3 text-emerald-400" /> Subscribed
                          </>
                        ) : (
                          <>
                            <UserRoundX className="h-3 w-3" /> Not subscribed
                          </>
                        )}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-secondary">{sub.email}</p>
                </div>
                <span className="hidden shrink-0 text-[11px] text-secondary sm:block">
                  {new Date(sub.subscribed_at ?? sub.created_at).toLocaleDateString()}
                </span>

                {/* Artist controls */}
                <div className="flex shrink-0 items-center gap-1">
                  {busyId === sub.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-secondary" />
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => runAction(sub, restricted ? "unrestrict" : "restrict")}
                        title={restricted ? "Restore full access" : "Set to view-only"}
                        className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
                          restricted
                            ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                            : "bg-white/5 text-secondary hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {restricted ? (
                          <Eye className="h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => runAction(sub, "delete")}
                        title="Delete account"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-secondary transition hover:bg-red-500/20 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {items.length > PAGE_SIZE && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 w-full rounded-lg border border-border bg-zinc-900 py-2 text-sm font-medium text-secondary transition hover:border-primary/40 hover:text-white"
        >
          {showAll ? "Show less" : `View all ${items.length} fans`}
        </button>
      )}
    </section>
  );
}