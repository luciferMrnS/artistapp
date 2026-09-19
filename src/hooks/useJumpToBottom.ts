"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const BOTTOM_TOLERANCE_PX = 64;
const SCROLL_SETTLE_MS = 800;

function isNearBottom(el: HTMLDivElement, tolerance = BOTTOM_TOLERANCE_PX): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= tolerance;
}

/**
 * Tracks whether the user can currently see the newest chat message and
 * exposes a floating "jump to latest" action.
 *
 * - `showButton` is true whenever the messages are scrolled up from the
 *   newest message — either because the user scrolled up or because a new
 *   message arrived off-screen.
 * - `jumpToBottom()` smooth-scrolls to the newest message. While the
 *   animation runs the button is suppressed so it doesn't flicker.
 * - `rememberOpenScroll()` must be paired with the one-time auto-scroll when
 *   a conversation/page opens: if that scroll failed to reach the bottom
 *   (e.g. late-loading images), the button appears automatically.
 * - `refreshPosition()` should be called whenever the message list changes.
 */
export function useJumpToBottom() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [showButton, setShowButton] = useState(false);
  const scrollSettlingRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  const scheduleSettleRecheck = useCallback(() => {
    scrollSettlingRef.current = true;
    clearSettleTimer();
    settleTimerRef.current = setTimeout(() => {
      scrollSettlingRef.current = false;
      const el = containerRef.current;
      if (el) setShowButton(!isNearBottom(el));
    }, SCROLL_SETTLE_MS);
  }, [clearSettleTimer]);

  const recheck = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (scrollSettlingRef.current) return;
    setShowButton(!isNearBottom(el));
  }, []);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (scrollSettlingRef.current) {
      if (isNearBottom(el)) {
        scrollSettlingRef.current = false;
        clearSettleTimer();
        setShowButton(false);
      }
      return;
    }
    setShowButton(!isNearBottom(el));
  }, [clearSettleTimer]);

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      const prev = containerRef.current;
      if (prev) prev.removeEventListener("scroll", handleScroll);
      containerRef.current = node;
      if (node) node.addEventListener("scroll", handleScroll);
    },
    [handleScroll]
  );

  const jumpToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    scheduleSettleRecheck();
    setShowButton(false);
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [scheduleSettleRecheck]);

  const rememberOpenScroll = useCallback(() => {
    scheduleSettleRecheck();
  }, [scheduleSettleRecheck]);

  const refreshPosition = useCallback(() => {
    const id = requestAnimationFrame(recheck);
    return () => cancelAnimationFrame(id);
  }, [recheck]);

  useEffect(() => {
    return () => clearSettleTimer();
  }, [clearSettleTimer]);

  return {
    setContainerRef,
    // Exposed so other logic (e.g. scrolling to a specific message) can act on
    // the same scroll container this hook tracks.
    containerRef,
    showButton,
    jumpToBottom,
    rememberOpenScroll,
    refreshPosition,
  };
}