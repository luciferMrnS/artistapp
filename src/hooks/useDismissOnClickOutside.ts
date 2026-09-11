"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Closes a popover (emoji picker, etc.) whenever the user clicks/taps
 * anywhere outside the given refs, or presses Escape. `active` gates the
 * listener so it only listens while the popover is open.
 */
export function useDismissOnClickOutside(
  active: boolean,
  onClose: () => void,
  ...refs: RefObject<HTMLElement | null>[]
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;

    const isInside = (target: Node | null) =>
      refs.some((ref) => ref.current?.contains(target));

    const onPointerDown = (e: Event) => {
      if (!isInside(e.target as Node | null)) onCloseRef.current();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, refs]);
}