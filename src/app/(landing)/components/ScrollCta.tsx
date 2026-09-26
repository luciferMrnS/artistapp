"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ARTIST, COMMUNE_ROUTE } from "../content";

/**
 * Persistent call to action. Hidden at the top of the page (the hero already
 * carries it) and slides in once the hero has scrolled away, so the join
 * button is always one click from anywhere on a long feed.
 */
export function ScrollCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 640);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-full opacity-0"
      }`}
      aria-hidden={!visible}
    >
      <div className="border-b border-black/[0.07] bg-[#f5f5f5]/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link
            href="/"
            className="lp-display text-xl sm:text-2xl"
            tabIndex={visible ? undefined : -1}
          >
            {ARTIST.name}
          </Link>

          <div className="flex items-center gap-3 sm:gap-5">
            <a
              href="#listen"
              tabIndex={visible ? undefined : -1}
              className="lp-ui hidden text-[0.6875rem] text-[#2e2e2e] transition hover:text-[#262626] sm:inline"
            >
              Listen
            </a>
            <Link
              href={COMMUNE_ROUTE}
              tabIndex={visible ? undefined : -1}
              className="lp-pill !px-6 !py-3 text-[0.5625rem] sm:!px-7 sm:text-[0.625rem]"
            >
              Join The Creed
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
