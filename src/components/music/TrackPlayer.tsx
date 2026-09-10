"use client";

import React, { useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

function formatRemaining(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `-${minutes}:${String(secs).padStart(2, "0")}`;
}

/** Minimum playback time before a stream counts as played. */
const QUALIFY_SECONDS = 30;

interface TrackPlayerProps {
  trackId: string;
  audioUrl: string;
  /** Parent registry so starting one track pauses every other */
  registerRef: (id: string, el: HTMLAudioElement | null) => void;
  /** Called whenever this track starts (or resumes) — pauses every other */
  onPlay: (trackId: string) => void;
  /**
   * Called once the track qualifies as "played": at least 30s of playback,
   * or a full play-through when the track is shorter than 30s.
   */
  onQualified: (trackId: string) => void;
  /** Notifies the parent so the row can highlight while this track is active */
  onActiveChange?: (trackId: string, active: boolean) => void;
}

/**
 * Minimal track player: no native controls/gauge.
 * A play/pause button, a digital time countdown, and a thin
 * progress/seek bar that only appears once the track length is known.
 */
export function TrackPlayer({
  trackId,
  audioUrl,
  registerRef,
  onPlay,
  onQualified,
  onActiveChange,
}: TrackPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const qualifiedRef = useRef(false);

  const fireQualified = () => {
    if (qualifiedRef.current) return;
    qualifiedRef.current = true;
    onQualified(trackId);
  };

  const handleRef = (el: HTMLAudioElement | null) => {
    audioRef.current = el;
    registerRef(trackId, el);
  };

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const willPlay = audio.paused;
    if (willPlay) {
      onPlay(trackId);
      onActiveChange?.(trackId, true);
      audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
      onActiveChange?.(trackId, false);
    }
  };

  const duration = remaining !== null ? remaining + currentTime : 0;

  return (
    <div className="mt-1">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause track" : "Play track"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:opacity-90"
        >
          {playing ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          )}
        </button>

        {/* Digital countdown — visible only while playing */}
        <span
          className={cn(
            "text-sm tabular-nums text-secondary transition-opacity",
            playing && remaining !== null ? "opacity-100" : "opacity-0"
          )}
          aria-hidden={!(playing && remaining !== null)}
        >
          {playing && remaining !== null ? formatRemaining(remaining) : "\u00A0"}
        </span>

        {/* Progress / seek bar — appears once the duration is known */}
        <input
          type="range"
          min={0}
          max={duration > 0 ? duration : 1}
          step={0.1}
          value={currentTime}
          disabled={duration <= 0}
          aria-label="Seek"
          onChange={(e) => {
            const next = Number(e.target.value);
            setCurrentTime(next);
            const audio = audioRef.current;
            if (audio) audio.currentTime = next;
          }}
          className={cn(
            "min-w-0 flex-1 accent-primary disabled:opacity-30",
            "h-1.5 cursor-pointer appearance-none rounded-full bg-white/10"
          )}
        />
      </div>

      {/* Hidden audio element — no native controls */}
      <audio
        ref={handleRef}
        src={audioUrl}
        preload="metadata"
        className="hidden"
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          onActiveChange?.(trackId, false);
        }}
        onEnded={() => {
          setPlaying(false);
          onActiveChange?.(trackId, false);
          fireQualified();
        }}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          setRemaining(Number.isFinite(d) ? d : null);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          const d = el.duration;
          setCurrentTime(el.currentTime);
          setRemaining(
            Number.isFinite(d) ? Math.max(0, d - el.currentTime) : null
          );
          // A played minimum of 30s makes this stream count.
          if (!qualifiedRef.current && el.currentTime >= QUALIFY_SECONDS) {
            fireQualified();
          }
        }}
      />
    </div>
  );
}