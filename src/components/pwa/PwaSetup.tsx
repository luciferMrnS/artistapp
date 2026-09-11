"use client";

import { useEffect, useState } from "react";
import { Download, Share, X, BellRing } from "lucide-react";

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

/** Convert a base64url VAPID public key into the Uint8Array PushManager wants. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64url = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64url);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/**
 * Registers the PWA service worker and shows an "Install app" button.
 * - Android / Windows / Chrome: prompts via `beforeinstallprompt`.
 * - iOS has no install prompt — it installs through "Add to Home Screen",
 *   so here the button opens step-by-step instructions instead.
 * The button hides once the app is already running standalone.
 *
 * Also wires up web-push notifications: subscribed devices get Creed + DM
 * unread-count banners even when the app is closed. If the user hasn't
 * granted permission yet, a small "Enable notifications" chip is shown.
 */
export function PwaSetup() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const [pushSupported] = useState(
    () =>
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      Boolean(VAPID_PUBLIC_KEY)
  );
  const [showPushChip, setShowPushChip] = useState(false);

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

  // Push notifications: refresh an existing grant silently, and nudge the
  // user toward enabling them if they haven't decided yet. Standalone apps
  // (installed) are where web push actually works — iOS only allows it there.
  useEffect(() => {
    if (!pushSupported || !isStandalone) return;
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
      void subscribeAndSave(false);
    } else if (Notification.permission === "default") {
      // Only remind installed users; don't annoy regular browser visitors.
      setShowPushChip(true);
    }
  }, [pushSupported, isStandalone]);

  const subscribeAndSave = async (prompt: boolean) => {
    if (!pushSupported) return false;
    try {
      if (prompt) {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setShowPushChip(false);
          return false;
        }
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
        });
      }

      const body = JSON.stringify({
        endpoint: sub.endpoint,
        expirationTime: sub.expirationTime ?? null,
        keys: {
          p256dh: btoa(
            String.fromCharCode(...new Uint8Array(sub.getKey("p256dh")!))
          ),
          auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("auth")!))),
        },
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        credentials: "include",
      });

      const ok = res.ok;
      if (ok) setShowPushChip(false);
      return ok;
    } catch (err) {
      console.error("Failed to subscribe to push:", err);
      setShowPushChip(false);
      return false;
    }
  };

  const showInstallButton = (installPrompt !== null || isIos) && !isStandalone;

  return (
    <>
      {showInstallButton && (
        <button
          onClick={handleInstall}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/30 transition hover:opacity-90"
        >
          <Download className="h-4 w-4" /> Install app
        </button>
      )}

      {showPushChip && (
        <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full border border-border bg-zinc-900 px-4 py-3 text-sm text-white shadow-xl">
          <BellRing className="h-4 w-4 shrink-0 text-primary" />
          <span>Get notified when messages arrive</span>
          <button
            type="button"
            onClick={() => subscribeAndSave(true)}
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90"
          >
            Enable
          </button>
          <button
            type="button"
            onClick={() => setShowPushChip(false)}
            aria-label="Dismiss"
            className="rounded-full p-1 text-secondary transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
                  Scroll down and choose{" "}
                  <span className="font-semibold text-white">
                    Add to Home Screen
                  </span>
                  .
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                  3
                </span>
                <span>
                  Tap <span className="font-semibold text-white">Add</span> in the
                  top-right corner — Kendrick David will appear on your Home
                  Screen.
                </span>
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );

  function handleInstall() {
    if (installPrompt) {
      // Android / Windows / desktop browsers: native install dialog.
      installPrompt.prompt();
      const choice = installPrompt.userChoice;
      if (choice && typeof choice.then === "function") {
        choice.then((c) => {
          if (c.outcome === "accepted") setInstallPrompt(null);
        });
      }
    } else {
      // iOS: no native prompt — walk the user through Add to Home Screen.
      setShowIosHelp(true);
    }
  }
}