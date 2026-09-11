"use client";

import React, { useEffect, useState } from "react";
import { Home, Bell, Mail, User, PlusSquare, LogOut, Edit3, MessageCircle, BarChart3 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { getCreedLastRead } from "@/lib/creed-unread";

const navItems = [
  { icon: Home, label: "Home", href: "/", artistOnly: false },
  { icon: MessageCircle, label: "Creed", href: "/fan-club", artistOnly: false },
  { icon: Bell, label: "Notifications", href: "/notifications", artistOnly: false },
  { icon: Mail, label: "Messages", href: "/messages", artistOnly: false },
  { icon: User, label: "Profile", href: "/profile", artistOnly: false },
  { icon: BarChart3, label: "Dashboard", href: "/dashboard", artistOnly: true },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [dmUnreadCount, setDmUnreadCount] = useState(0);
  const [creedUnreadCount, setCreedUnreadCount] = useState(0);

  // Poll for unread notification + message counts while logged in
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const refreshUnread = async () => {
      if (!cancelled) {
        setUnreadCount(0);
        setDmUnreadCount(0);
        setCreedUnreadCount(0);
      }
      try {
        const [notifRes, dmRes, creedRes] = await Promise.all([
          fetch("/api/notifications"),
          fetch("/api/dm/conversations"),
          fetch("/api/messages"),
        ]);
        if (!cancelled) {
          if (notifRes.ok) {
            const notifData = await notifRes.json();
            setUnreadCount(notifData.unreadCount ?? 0);
          }
          if (dmRes.ok) {
            const dmData = await dmRes.json();
            const dmTotal = (dmData.conversations ?? []).reduce(
              (sum: number, c: { unread_count?: number }) =>
                sum + (c.unread_count ?? 0),
              0
            );
            setDmUnreadCount(dmTotal);
          }
          if (creedRes.ok) {
            const creedData = await creedRes.json();
            const lastRead = getCreedLastRead();
            const mineId = user.id;
            const unread = (creedData.messages ?? []).filter(
              (m: { user_id?: string; created_at?: string }) =>
                m.user_id !== mineId &&
                m.created_at &&
                new Date(m.created_at).getTime() > lastRead
            ).length;
            setCreedUnreadCount(unread);
          }
        }
      } catch {
        // Polling is best-effort; keep last known value
      }
    };

    refreshUnread();
    const interval = setInterval(refreshUnread, 15_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-20 flex-col border-r border-border bg-black p-4 xl:w-64">
      <Link href="/" className="mb-8 block px-3" title="Kendrick David">
        <Logo className="h-12 w-12" />
      </Link>

      <nav className="flex-1 space-y-2">
        {navItems
          .filter((item) => !item.artistOnly || user?.role === "artist")
          .map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "group relative flex items-center gap-4 rounded-full p-3 transition-colors hover:bg-white/10",
              "xl:px-4"
            )}
          >
            <item.icon className="h-7 w-7" />
            <span className="hidden text-xl xl:inline">{item.label}</span>
            {item.label === "Notifications" && unreadCount > 0 && (
              <span className="absolute left-7 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white ring-2 ring-black xl:static xl:ml-1">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
            {item.label === "Messages" && dmUnreadCount > 0 && (
              <span className="absolute left-7 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500 px-1.5 text-[10px] font-bold text-white ring-2 ring-black xl:static xl:ml-1">
                {dmUnreadCount > 99 ? "99+" : dmUnreadCount}
              </span>
            )}
            {item.label === "Creed" && creedUnreadCount > 0 && (
              <span
                title="New creed messages"
                className="absolute left-7 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white ring-2 ring-black xl:static xl:ml-1 animate-pulse"
              >
                {creedUnreadCount > 99 ? "99+" : creedUnreadCount}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* Create Post — Artist only */}
      {user?.role === "artist" && (
        <Link
          href="/create"
          className="mt-4 flex items-center justify-center rounded-full bg-primary p-3 text-white xl:hidden"
        >
          <PlusSquare className="h-6 w-6" />
        </Link>
      )}

      {/* User Section */}
      {user && (
        <div className="border-t border-border pt-4 space-y-3">
          <Link
            href="/profile"
            className="hidden xl:block px-4 group"
            title="Edit profile"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-secondary mb-1">Logged in as</p>
              <Edit3 className="h-3.5 w-3.5 text-secondary opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
              {user.username}
            </p>
            <p className="text-xs text-secondary truncate">{user.email}</p>
            {user.role === "artist" && (
              <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
                Artist
              </span>
            )}
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-4 rounded-full p-3 text-red-500 hover:bg-red-500/10 transition-colors xl:px-4"
          >
            <LogOut className="h-7 w-7" />
            <span className="hidden text-xl xl:inline">Sign out</span>
          </button>
        </div>
      )}

      {/* Post Button — Artist only */}
      {user?.role === "artist" && (
        <Link
          href="/create"
          className="mt-4 hidden rounded-full bg-primary px-8 py-3 text-base font-bold text-white transition-opacity hover:opacity-90 xl:block"
        >
          Post
        </Link>
      )}
    </aside>
  );
}
