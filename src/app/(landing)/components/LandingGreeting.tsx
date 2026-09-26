"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { IntroGreeting } from "./IntroGreeting";

/**
 * Greet once per visit, not once per render.
 *
 * Whether to greet depends on two things React can't render on the server:
 * `prefers-reduced-motion` and a sessionStorage flag. Reading them through
 * `useSyncExternalStore` (rather than an effect + setState) keeps the server
 * markup untouched — no hydration mismatch, no cascading re-render — and lets
 * the overlay mount immediately after hydration.
 *
 * The greeting is pure decoration on top of a fully crawlable page, and both
 * surfaces share the same #F5F5F5 canvas, so the handover is invisible.
 */
const KEY = "kd-landing-greeted";

type Phase = "pending" | "intro" | "done";

/**
 * Set to "done" the moment the greeting is dismissed, so the store stops
 * reporting "intro" without needing a second write to sessionStorage. Module
 * scope is intentional: it resets on a hard navigation, which is exactly when
 * the visitor should be greeted again.
 */
let dismissed = false;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot(): Phase {
  if (dismissed) return "done";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return "done";
  }
  try {
    return sessionStorage.getItem(KEY) === "1" ? "done" : "intro";
  } catch {
    // Private mode / blocked storage — greet them.
    return "intro";
  }
}

/** Server has no session or media query — render the plain page. */
function getServerSnapshot(): Phase {
  return "pending";
}

export function LandingGreeting({
  portraitSrc,
  children,
}: {
  portraitSrc: string;
  children: ReactNode;
}) {
  const phase = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const finish = () => {
    dismissed = true;
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      // Non-fatal: worst case the greeting replays next navigation.
    }
    for (const onChange of listeners) onChange();
  };

  return (
    <>
      {children}
      {phase === "intro" && (
        <IntroGreeting portraitSrc={portraitSrc} onDone={finish} />
      )}
    </>
  );
}
