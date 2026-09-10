"use client";

import React, { useRef, useState } from "react";
import { Disc3, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { TrackUploader } from "./TrackUploader";
import { TrackPlayer } from "./TrackPlayer";
import { KebabMenu } from "@/components/ui/KebabMenu";

export interface TrackListItem {
  id: string;
  title: string;
  plays_count: number;
  created_at: string;
  /** Short-lived signed URL — only the URL is passed to the client, never the storage path */
  audio_url: string | null;
  /** Short-lived signed URL for the album cover, if one exists */
  cover_url: string | null;
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Streaming section: artist posts music, fans stream it.
 * Audio is served through expiring signed URLs from a private
 * bucket — there is no permanent link to download, the player
 * hides the download control and right-click is disabled.
 */
export function MusicSection({ tracks }: { tracks: TrackListItem[] }) {
  const { user } = useAuth();
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  // Record each stream once per page session per track,
  // and only once the track has actually been played for 30s+.
  const recordedRef = useRef<Set<string>>(new Set());

  const handlePlay = (_trackId: string) => {
    // Pause every other track so only one plays at a time
    Object.entries(audioRefs.current).forEach(([id, el]) => {
      if (id !== _trackId) el?.pause();
    });
  };

  // Fired by TrackPlayer after 30s of playback (or a full play of a
  // shorter track). Powers plays_count and monthly listeners.
  const handleQualified = (trackId: string) => {
    if (recordedRef.current.has(trackId)) return;
    recordedRef.current.add(trackId);

    // Fire-and-forget: powers plays_count and monthly listeners
    fetch(`/api/tracks/${trackId}/stream`, {
      method: "POST",
      credentials: "include",
    }).catch((err) => console.error("Failed to record stream:", err));
  };

  return (
    <div className="rounded-2xl border border-border bg-zinc-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Music</h3>
        <Disc3 className="h-4 w-4 animate-[spin_6s_linear_infinite] text-primary" />
      </div>

      <TrackUploader />

      {tracks.length === 0 ? (
        <p className="rounded-xl bg-black/40 p-4 text-center text-sm text-secondary">
          {user?.role === "artist"
            ? "No tracks yet — upload your first one above."
            : "No tracks yet. Check back soon!"}
        </p>
      ) : (
        <ul className="space-y-3">
          {tracks.map((track) => (
            <li
              key={track.id}
              className={cn(
                "rounded-xl bg-black/40 p-3 transition",
                activeTrackId === track.id &&
                  "border border-primary/40 bg-primary/5 ring-1 ring-primary/20"
              )}
              onContextMenu={(e) => e.preventDefault()}
            >
              <div className="flex items-center gap-3">
                {track.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={track.cover_url}
                    alt={`${track.title} cover`}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-secondary">
                    <Music2 className="h-5 w-5" />
                  </span>
                )}
                <p className="min-w-0 flex-1 truncate font-medium">
                  {track.title}
                </p>
                <span className="shrink-0 text-xs text-secondary">
                  {formatCompactNumber(track.plays_count)} plays
                </span>
                {user?.role === "artist" && (
                  <KebabMenu
                    deleteLabel="Delete track"
                    onDelete={async () => {
                      try {
                        const res = await fetch(`/api/tracks/${track.id}`, {
                          method: "DELETE",
                          credentials: "include",
                        });
                        if (!res.ok) return false;
                        window.location.reload();
                        return true;
                      } catch (err) {
                        console.error("Failed to delete track:", err);
                        return false;
                      }
                    }}
                  />
                )}
              </div>

              {track.audio_url ? (
                <TrackPlayer
                  trackId={track.id}
                  audioUrl={track.audio_url}
                  registerRef={(id, el) => {
                    if (el) audioRefs.current[id] = el;
                    else delete audioRefs.current[id];
                  }}
                  onPlay={handlePlay}
                  onQualified={handleQualified}
                  onActiveChange={(id, active) =>
                    setActiveTrackId(active ? id : null)
                  }
                />
              ) : (
                <p className="mt-1 text-xs text-red-400">
                  This track is temporarily unavailable.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}