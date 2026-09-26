"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  /** Stagger in ms — pass an index for a cascading entrance. */
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "figure";
};

/**
 * Fades content up the first time it scrolls into view. Observes once and then
 * disconnects, so scrolling back up never re-animates.
 * `landing.css` neutralises this entirely under prefers-reduced-motion.
 */
export function Reveal({ children, delay = 0, className, as = "div" }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Environments without IntersectionObserver still need to reach the
    // visible state, otherwise the content stays stuck at opacity 0. Defer to
    // the next frame so the decision comes from the subscription/timer path
    // (after layout) rather than synchronously inside the effect body.
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const Tag = as;

  return (
    <Tag
      ref={ref as never}
      data-shown={shown ? "true" : "false"}
      style={delay ? ({ "--lp-delay": `${delay}ms` } as React.CSSProperties) : undefined}
      className={`lp-reveal ${className ?? ""}`}
    >
      {children}
    </Tag>
  );
}
