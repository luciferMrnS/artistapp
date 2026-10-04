"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { resolveAvatarUrl } from "@/lib/avatar-url";

export interface ReactedUser {
  id: string;
  username: string;
  avatar?: string | null;
}

interface WhoReactedProps {
  /** Lazily loads the user list on first hover / long-press. Result is cached. */
  loadUsers: () => Promise<ReactedUser[]>;
  /** Extra lines shown under the names (e.g. the emoji). */
  title?: string;
  children: React.ReactElement;
}

const LONG_PRESS_MS = 450;
const MAX_SHOWN = 8;

/**
 * Wraps a reaction pill / like count and reveals *who* reacted:
 * - Desktop: hover or keyboard focus shows the tooltip.
 * - Mobile: press-and-hold (long-press) shows it; a normal tap still
 *   passes through to the child's own onClick (e.g. toggle reaction),
 *   while the long-press itself never triggers that onClick.
 */
export function WhoReacted({ loadUsers, title, children }: WhoReactedProps) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<ReactedUser[] | null>(null);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);
  const loadingRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  const ensureLoaded = useCallback(async () => {
    if (loadedRef.current || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const list = await loadUsers();
      loadedRef.current = true;
      setUsers(list);
    } catch {
      setUsers([]);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [loadUsers]);

  const openTip = useCallback(() => {
    setOpen(true);
    void ensureLoaded();
  }, [ensureLoaded]);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // Dismiss a touch-opened tooltip when tapping elsewhere or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  const shown = users?.slice(0, MAX_SHOWN) ?? [];
  const extra = (users?.length ?? 0) - shown.length;

  const child = React.Children.only(children) as React.ReactElement<{
    onClick?: (e: React.MouseEvent) => void;
  }>;

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex"
      onMouseEnter={openTip}
      onMouseLeave={() => setOpen(false)}
      onFocus={openTip}
      onBlur={() => setOpen(false)}
      onPointerDown={(e) => {
        // Touch/stylus hold — or mouse hold — reveals without toggling.
        if (e.pointerType === "mouse" && e.button !== 0) return;
        clearTimer();
        timer.current = setTimeout(() => {
          suppressClick.current = true;
          openTip();
        }, LONG_PRESS_MS);
      }}
      onPointerMove={clearTimer}
      onPointerUp={clearTimer}
      onPointerCancel={clearTimer}
      onPointerLeave={clearTimer}
      onClickCapture={(e) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      {child}
      {open && (
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-[220px]",
            "-translate-x-1/2 rounded-xl border border-white/10 bg-zinc-900/95 px-3 py-2",
            "shadow-xl backdrop-blur"
          )}
        >
          {title && (
            <span className="mb-1 block text-center text-sm">{title}</span>
          )}
          {loading || users === null ? (
            <span className="block text-center text-xs text-secondary">
              Loading…
            </span>
          ) : users.length === 0 ? (
            <span className="block text-center text-xs text-secondary">
              No reactions yet
            </span>
          ) : (
            <span className="block space-y-1">
              {shown.map((u) => (
                <span key={u.id} className="flex items-center gap-2 text-xs text-white">
                  {u.avatar ? (
                    <img
                      src={resolveAvatarUrl(u.avatar)}
                      alt=""
                      className="h-4 w-4 rounded-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-500 text-[8px] font-bold">
                      {u.username.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="truncate font-medium">{u.username}</span>
                </span>
              ))}
              {extra > 0 && (
                <span className="block text-center text-[11px] text-secondary">
                  +{extra} more
                </span>
              )}
            </span>
          )}
          {/* arrow */}
          <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r border-white/10 bg-zinc-900/95" />
        </span>
      )}
    </span>
  );
}
