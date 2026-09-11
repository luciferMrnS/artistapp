"use client";

import { Bangers } from "next/font/google";
import { Megaphone, X } from "lucide-react";
import { cn } from "@/lib/utils";

const bangers = Bangers({
  weight: "400",
  subsets: ["latin"],
  preload: false,
});

export interface AnnouncementData {
  id: string;
  content: string;
  created_at: string;
  expires_at: string | null;
}

interface AnnouncementBannerProps {
  announcement: AnnouncementData | null;
  onDismiss?: () => void;
}

/**
 * Sliding "breaking news" style banner pinned at the top of the Creed page.
 * The text rides in from the right edge, sweeps across, and fades into the
 * left — looping so nobody can miss it.
 */
export function AnnouncementBanner({
  announcement,
  onDismiss,
}: AnnouncementBannerProps) {
  if (!announcement) return null;

  const duration = Math.max(6, Math.min(14, announcement.content.length / 14 + 5));

  return (
    <div className="relative z-30 overflow-hidden border-b border-primary/40 bg-gradient-to-r from-primary/25 via-primary/10 to-transparent">
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-black uppercase tracking-[0.2em] text-primary">
          <Megaphone className="h-4 w-4 animate-pulse" strokeWidth={2.6} />
          Announcement
        </span>

        <div className="relative h-9 min-w-0 flex-1 overflow-hidden">
          <div className="absolute top-1/2 left-0 -translate-y-1/2">
            <div
              className="announcement-slide whitespace-nowrap"
              style={{ animationDuration: `${duration}s` }}
            >
              <span
                className={cn(
                  bangers.className,
                  "bg-gradient-to-r from-yellow-300 via-red-400 to-primary bg-clip-text text-2xl uppercase tracking-wide text-transparent drop-shadow-[0_0_14px_rgba(29,155,240,0.95)]"
                )}
              >
                {announcement.content}
              </span>
            </div>
          </div>
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="shrink-0 rounded-full p-1.5 text-secondary transition hover:bg-white/10 hover:text-white"
            aria-label="Dismiss announcement"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}