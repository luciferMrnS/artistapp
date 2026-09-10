"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** iOS Safari (and iPadOS 13+, which reports itself as a Mac). */
function isIOSDevice(): boolean {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  return /macintosh|mac os x/i.test(ua) && navigator.maxTouchPoints > 1;
}

/**
 * Registers the PWA service worker and shows an "Install app" button.
 * - Android / Windows / Chrome: prompts via `beforeinstallprompt`.
 * - iOS has no install prompt — it installs through "Add to Home Screen",
 *   so here the button opens step-by-step instructions instead.
 * The button hides once the app is already running standalone.
 */
export function PwaSetup() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("Service worker registration failed:", err);
      });
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);
    const onDisplayModeChange = () => {
      if (window.matchMedia("(display-mode: standalone)").matches) {
        setInstallPrompt(null);
      }
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // iOS-only, true when already running from the home screen
    setIsIos(isIOSDevice());
    setIsStandalone(
      ("standalone" in navigator &&
        (navigator as Navigator & { standalone?: boolean }).standalone === true) ||
        window.matchMedia("(display-mode: standalone)").matches
    );

    const media = window.matchMedia("(display-mode: standalone)");
    media.addEventListener?.("change", onDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      media.removeEventListener?.("change", onDisplayModeChange);
    };
  }, []);

  const showButton = (installPrompt !== null || isIos) && !isStandalone;

  if (!showButton) return null;

  const handleInstall = async () => {
    if (installPrompt) {
      // Android / Windows / desktop browsers: native install dialog.
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstallPrompt(null);
    } else {
      // iOS: no native prompt — walk the user through Add to Home Screen.
      setShowIosHelp(true);
    }
  };

  return (
    <>
      <button
        onClick={handleInstall}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/30 transition hover:opacity-90"
      >
        <Download className="h-4 w-4" /> Install app
      </button>

      {showIosHelp && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowIosHelp(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-zinc-900 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-white">
                <Download className="h-4 w-4 text-primary" /> Add to Home Screen
              </h3>
              <button
                type="button"
                onClick={() => setShowIosHelp(false)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-secondary transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ol className="space-y-3 text-sm text-secondary">
              <li className="flex items-start gap-3">
                <Share className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  Tap the <span className="font-semibold text-white">Share</span> button
                  (square with an up arrow) in Safari&apos;s toolbar.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                  2
                </span>
                <span>
                  Scroll down and choose <span className="font-semibold text-white">Add to Home Screen</span>.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                  3
                </span>
                <span>
                  Tap <span className="font-semibold text-white">Add</span> in the top-right corner —
                  Kendrick David will appear on your Home Screen.
                </span>
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}