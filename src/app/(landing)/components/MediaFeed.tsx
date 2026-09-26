"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Play, X } from "lucide-react";
import { embedSrc, tileRatio, type MediaItem } from "@/lib/landing-feed";

/**
 * The picture + video feed.
 *
 * Posters are `next/image`-optimised, so the grid is complete and cheap on
 * first paint. Players are third-party iframes that are never mounted until
 * the visitor opens an item, which keeps every YouTube/Vimeo embed off the
 * critical path.
 *
 * `items` comes from the server (the artist's editable feed, or the static
 * fallback when the database has no table yet) — see src/lib/db.ts.
 */
export function MediaFeed({ items }: { items: MediaItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpenId(null), []);
  // Tracked by id, not index, so reordering the feed can never leave the modal
  // showing a different item than the one that was clicked.
  const active: MediaItem | null = items.find((item) => item.id === openId) ?? null;
  /* Resolved once: the same URL decides both whether a player renders and
     what it points at, so the two can never disagree. */
  const player = active ? embedSrc(active) : null;

  // Escape closes; the page behind the modal must not scroll.
  useEffect(() => {
    if (!active) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };

    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    closeRef.current?.focus();

    return () => {
      document.documentElement.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active, close]);

  return (
    <>
      <ul className="columns-1 gap-5 sm:columns-2 lg:columns-3">
        {items.map((item) => (
          <li key={item.id} className="mb-5 break-inside-avoid">
            <button
              type="button"
              onClick={() => setOpenId(item.id)}
              className="lp-card group block w-full text-left"
              aria-label={
                item.kind === "video"
                  ? `Play ${item.title}`
                  : `View ${item.title}`
              }
            >
              {/* Ratio comes from the poster's own dimensions, clamped by
                  tileRatio() so one tall poster can't dominate the grid. */}
              <span
                className="lp-frame block"
                style={{
                  aspectRatio: tileRatio(item.poster.width, item.poster.height),
                }}
              >
                <Image
                  src={item.poster.src}
                  alt={item.poster.alt}
                  width={item.poster.width}
                  height={item.poster.height}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="h-full w-full object-cover"
                />
                <span className="lp-play" aria-hidden="true">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-[#262626] shadow-xl transition-transform duration-300 group-hover:scale-110">
                    <Play className="ml-0.5 h-6 w-6 fill-current" />
                  </span>
                </span>
              </span>

              <span className="mt-3 flex items-baseline justify-between gap-3">
                <span className="lp-body text-[0.95rem] leading-none text-[#262626]">
                  {item.title}
                </span>
                <span className="lp-eyebrow shrink-0 text-[0.5625rem]">
                  {item.kind === "video" ? "Watch" : "Photo"}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={active.title}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-[#f5f5f5]/96 p-4 backdrop-blur-sm sm:p-8"
          onClick={close}
        >
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-[#262626] text-white transition hover:bg-[#302424] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#302424] sm:right-8 sm:top-8"
          >
            <X className="h-5 w-5" />
          </button>

          <figure
            className="flex max-h-full w-full max-w-4xl flex-col items-center"
            onClick={(event) => event.stopPropagation()}
          >
            {player ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl">
                <iframe
                  /* `key` restarts playback when moving between items. */
                  key={active.id}
                  src={player}
                  title={active.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
              </div>
            ) : (
              <Image
                src={active.poster.src}
                alt={active.poster.alt}
                width={active.poster.width}
                height={active.poster.height}
                sizes="90vw"
                className="max-h-[78vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
              />
            )}

            <figcaption className="mt-5 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 text-center">
              <span className="lp-display text-2xl">{active.title}</span>
              {active.note && <span className="lp-eyebrow text-[0.5625rem]">{active.note}</span>}
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}
