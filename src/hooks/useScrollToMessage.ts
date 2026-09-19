"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

const HIGHLIGHT_MS = 2200;

/**
 * Scrolls a chat container to a message by id and briefly highlights it.
 *
 * The message rows must carry a `data-message-id` attribute and the container
 * must be the element returned by `containerRef`. Scrolling is computed from
 * each element's bounding rect so only the chat scroller moves — outer pages
 * are never scrolled.
 *
 * Returns:
 * - `highlightedId` — currently highlighted message id (cleared automatically)
 * - `scrollToMessage(id)` — smooth-scrolls the id into view (centered) and
 *   highlights it for ~2s. The row must already be in the DOM.
 */
export function useScrollToMessage(
  containerRef: RefObject<HTMLDivElement | null>
) {
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToMessage = useCallback(
    (messageId: string) => {
      const el = containerRef.current;
      if (!el) return;
      const target = el.querySelector<HTMLElement>(
        `[data-message-id="${CSS.escape(messageId)}"]`
      );
      if (!target) return;

      const containerRect = el.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      // Center the target vertically within the scroller.
      const delta =
        targetRect.top -
        containerRect.top -
        (containerRect.height - targetRect.height) / 2;
      el.scrollBy({ top: delta, behavior: "smooth" });

      setHighlightedId(messageId);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(
        () => setHighlightedId(null),
        HIGHLIGHT_MS
      );
    },
    [containerRef]
  );

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  return { highlightedId, scrollToMessage };
}