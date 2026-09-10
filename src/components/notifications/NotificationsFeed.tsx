"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  UserPlus,
  Megaphone,
  Loader2,
} from "lucide-react";
import type { NotificationWithActor } from "@/lib/db";

function timeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

const typeConfig = {
  like: { icon: Heart, color: "text-pink-500" },
  comment: { icon: MessageCircle, color: "text-sky-400" },
  follow: { icon: UserPlus, color: "text-emerald-400" },
  post: { icon: Megaphone, color: "text-primary" },
} as const;

export function NotificationsFeed() {
  const [notifications, setNotifications] = useState<NotificationWithActor[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const markedReadRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      })
      .catch(() => {
        if (!cancelled) setNotifications([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading || markedReadRef.current || notifications.length === 0) return;

    if (unreadCount > 0) {
      markedReadRef.current = true;
      fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
        .then((res) => (res.ok ? setUnreadCount(0) : undefined))
        .catch(() => undefined);
    }
  }, [loading, unreadCount, notifications.length]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-secondary">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="mt-3 text-sm">Loading notifications...</p>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-zinc-900/40 p-12 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
          <MessageCircle className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">No notifications yet</h2>
        <p className="mt-2 max-w-sm text-sm text-secondary">
          When fans like your posts, comment, follow, or when you share
          something new, it will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {notifications.map((notification, index) => {
        const config = typeConfig[notification.type];
        const Icon = config.icon;
        return (
          <div
            key={notification.id}
            className={`flex items-start gap-3 border-b border-border px-4 py-4 ${
              index % 2 === 0 ? "bg-transparent" : "bg-zinc-900/30"
            }`}
          >
            <div
              className={`mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 ${config.color}`}
            >
              <Icon className="h-4.5 w-4.5" />
            </div>

            <div className="min-w-0 flex-1">
              <Link
                href={notification.post_id ? `/post/${notification.post_id}` : "#"}
                className="block"
              >
                <div className="flex items-center gap-2 text-sm text-white">
                  {notification.actor && (
                    <img
                      src={notification.actor.avatar || "/default-avatar.png"}
                      alt={notification.actor.username}
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  )}
                  <span className="truncate font-semibold">
                    {notification.actor?.username ?? "Someone"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-secondary">
                  {notification.type === "like" && "liked your post"}
                  {notification.type === "comment" && "commented on your post"}
                  {notification.type === "follow" && "started following you"}
                  {notification.type === "post" && "posted something new"}
                </p>
              </Link>
            </div>

            <span className="shrink-0 text-xs text-secondary/70">
              {timeAgo(notification.created_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}