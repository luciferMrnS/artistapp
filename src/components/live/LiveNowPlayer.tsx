"use client";

import { useEffect, useState } from "react";
import { Radio, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SubscribeButton } from "@/components/feed/SubscribeButton";
import type { LiveStatus } from "@/lib/live";

interface LiveNowPlayerProps {
  artistId: string | null;
}

function embedSrc(status: LiveStatus): string | null {
  const embed = status.embed;
  if (!embed) return null;
  if (embed.type === "twitch" && embed.channel) {
    const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
    return `https://player.twitch.tv/?channel=${encodeURIComponent(embed.channel)}&parent=${host}&autoplay=true`;
  }
  if (embed.type === "youtube" && embed.videoId) {
    return `https://www.youtube.com/embed/${encodeURIComponent(embed.videoId)}?autoplay=1`;
  }
  return null;
}

/**
 * Live Now player for the "live-now" story page.
 * Polls /api/live/status (Twitch Helix or YouTube Data API) every 30s and:
 *  - shows the live embed with a pulsing LIVE badge while the artist is on air
 *  - shows an "off the air" panel otherwise
 */
export function LiveNowPlayer({ artistId }: LiveNowPlayerProps) {
  const [status, setStatus] = useState<LiveStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const bump = async () => {
      try {
        const res = await fetch("/api/live/status");
        if (res.ok && !cancelled) {
          const data = (await res.json()) as LiveStatus;
          setStatus(data);
        }
      } catch {
        // keep last known status
      }
    };
    bump();
    const id = setInterval(() => {
      bump();
    }, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const live = !!status?.live;
  const src = status ? embedSrc(status) : null;

  return (
    <div className="mx-4 mt-6 overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-rose-500/15 via-transparent to-orange-500/15">
      {/* Live status bar */}
      <div className="flex items-center justify-between gap-3 border-b border-border/60 p-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span
              className={cn(
                "absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75",
                live && "animate-ping"
              )}
            />
            <span
              className={cn(
                "relative inline-flex h-3 w-3 rounded-full",
                live ? "bg-red-500" : "bg-zinc-600"
              )}
            />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-400">
              {status === null ? "Checking live status…" : live ? "LIVE · On air now" : "Off the air"}
            </p>
            {live && status?.title && (
              <p className="mt-0.5 text-sm font-semibold text-white">{status.title}</p>
            )}
          </div>
        </div>
        {live && status?.viewerCount != null && (
          <span className="shrink-0 rounded-full border border-white/20 bg-black/40 px-2.5 py-1 text-xs font-bold text-white">
            {status.viewerCount.toLocaleString()} watching
          </span>
        )}
      </div>

      {/* Player / offline body */}
      <div className="p-4">
        {status === null ? (
          <div className="flex h-56 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-secondary" />
          </div>
        ) : live && src ? (
          <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
            <iframe
              src={src}
              title={status.title ?? "Live stream"}
              className="h-full w-full"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black/30">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-2xl bg-red-500/20" />
                <Radio className="relative h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {live ? "Stream is starting…" : "The room is quiet for now"}
                </h2>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-secondary">
                  {live
                    ? "The artist is setting up. Hang tight — the broadcast is coming."
                    : "Kendrick goes live straight from the studio. Subscribe so you never miss a session."}
                </p>
              </div>
            </div>
            {!live && artistId && (
              <div className="hidden shrink-0 sm:block">
                <SubscribeButton artistId={artistId} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}