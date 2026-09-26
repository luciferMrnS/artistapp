"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GREETING } from "../content";

/** Per-character delay. The display face is sparse and needs room; the body
 *  face is dense and reads fine when it flies. */
const SPEED = { eyebrow: 34, display: 30, body: 9 } as const;

/** Must match the `lp-intro-out` animation in landing.css. */
const LEAVE_MS = 850;

type IntroProps = {
  /** Blurred backdrop for the greeting. */
  portraitSrc: string;
  onDone: () => void;
};

/**
 * The greeting: the artist's bio types itself out over a blurred still of the
 * portrait, then the whole overlay lifts away to reveal the landing page.
 *
 * Exits early on click, any key, or `prefers-reduced-motion` — a greeting
 * should never be a toll booth. The parent is responsible for only mounting
 * this once per visit (see the page's sessionStorage guard).
 */
export function IntroGreeting({ portraitSrc, onDone }: IntroProps) {
  const [line, setLine] = useState(0);
  const [count, setCount] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const skipRef = useRef<HTMLButtonElement>(null);

  const current = GREETING[line];
  const isTyping = current ? count < current.text.length : false;

  // The reveal is a single linear timeline: type a line, hold it, move on.
  useEffect(() => {
    if (leaving) {
      const t = setTimeout(onDone, LEAVE_MS);
      return () => clearTimeout(t);
    }
    if (!current) return;

    if (count < current.text.length) {
      const t = setTimeout(() => setCount((c) => c + 1), SPEED[current.kind]);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => {
      const next = line + 1;
      if (next < GREETING.length) {
        setLine(next);
        setCount(0);
      } else {
        setLeaving(true);
      }
    }, current.hold);
    return () => clearTimeout(t);
  }, [line, count, leaving, current, onDone]);

  // Freeze the page behind the overlay, and hand focus to the skip control so
  // the greeting is dismissable from the keyboard without hunting for it.
  useEffect(() => {
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    skipRef.current?.focus();
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, []);

  // Click anywhere, or press anything, to move on.
  const skip = useCallback(() => {
    setLeaving(true);
  }, []);

  useEffect(() => {
    const onKeyDown = () => skip();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [skip]);

  const progress = useMemo(() => {
    const total = GREETING.reduce((sum, item) => sum + item.text.length, 0);
    const before = GREETING.slice(0, line).reduce(
      (sum, item) => sum + item.text.length,
      0
    );
    return Math.min(100, ((before + count) / total) * 100);
  }, [line, count]);

  return (
    <div
      className="lp-intro px-6"
      data-leaving={leaving ? "true" : "false"}
      onClick={skip}
      role="dialog"
      aria-label="Welcome to Kendrick David"
    >
      <div
        className="lp-intro-halo"
        style={{ backgroundImage: `url(${portraitSrc})` }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto w-full max-w-3xl text-center">
        {GREETING.map((item, index) => {
          const started = index < line;
          const shown = started
            ? item.text
            : index === line
              ? item.text.slice(0, count)
              : "";

          return (
            <p
              key={item.kind + index}
              className={
                item.kind === "eyebrow"
                  ? "lp-eyebrow mb-2"
                  : item.kind === "display"
                    ? "lp-display text-[clamp(2.1rem,6.2vw,4.1rem)]"
                    : "lp-body mx-auto mt-8 max-w-[46ch] text-[0.95rem] sm:text-base"
              }
              /* Pending lines keep their box (opacity 0) so the block never
                 reflows as the greeting builds up. */
              style={started ? undefined : { opacity: 0 }}
            >
              <span>
                {shown}
                {index === line && isTyping && <span className="lp-caret" />}
              </span>
            </p>
          );
        })}

        {/* Progress hairline — also the visual cue that this is skippable. */}
        <div
          className="mx-auto mt-12 h-px w-40 overflow-hidden bg-black/10"
          aria-hidden="true"
        >
          <div
            className="h-full bg-[#302424] transition-[width] duration-200 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <button
        ref={skipRef}
        type="button"
        onClick={skip}
        className="lp-ui absolute bottom-8 right-6 z-10 rounded-full px-4 py-2 text-[0.6875rem] text-[#2e2e2e] transition hover:text-[#262626] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#302424]"
      >
        Skip intro
      </button>
    </div>
  );
}
