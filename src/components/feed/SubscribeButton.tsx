"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

interface SubscribeButtonProps {
  /** The artist to subscribe to (hidden if missing or if it's the current user) */
  artistId: string | null;
}

/**
 * Animated subscribe button for the feed title bar.
 * Reuses the /api/follow endpoints (subscribe === follow under the hood):
 *   GET    /api/follow?targetUserId=...  → { following, counts }
 *   POST   /api/follow                   → subscribe
 *   DELETE /api/follow                   → unsubscribe
 */
export function SubscribeButton({ artistId }: SubscribeButtonProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [subscribed, setSubscribed] = useState(false);
  const [subscribers, setSubscribers] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Artist viewing their own feed (or missing artist) → no button
  const showButton = Boolean(artistId) && user?.id !== artistId;

  useEffect(() => {
    if (!showButton || !artistId) return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/follow?targetUserId=${artistId}`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setSubscribed(Boolean(data.following));
          setSubscribers(data.counts?.followers ?? null);
        }
      } catch (error) {
        console.error("Failed to check subscribe status:", error);
      }
    };

    checkStatus();
  }, [artistId, showButton]);

  if (!showButton) return null;

  // View-only accounts can't subscribe
  if (user?.restricted_at) return null;

  const toggleSubscription = async () => {
    if (!artistId || isLoading) return;

    if (!user) {
      router.push("/auth/login");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/follow", {
        method: subscribed ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: artistId }),
        credentials: "include",
      });

      const data = await res.json();
      if (res.ok) {
        setSubscribed(Boolean(data.following));
        setSubscribers(data.counts?.followers ?? subscribers);
      }
    } catch (error) {
      console.error("Subscribe action failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.button
      onClick={toggleSubscription}
      disabled={isLoading}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={cn(
        "relative flex shrink-0 items-center gap-1.5 overflow-hidden rounded-full px-4 py-1.5 text-xs font-bold text-white shadow-lg",
        subscribed
          ? "border border-primary/60 bg-white/5"
          : "bg-gradient-to-r from-primary to-pink-500 shadow-primary/30"
      )}
      style={
        subscribed
          ? undefined
          : { backgroundSize: "180% 100%", backgroundPosition: "0% 50%" }
      }
      animate={
        subscribed
          ? {}
          : {
              backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              transition: { duration: 4, repeat: Infinity, ease: "easeInOut" },
            }
      }
      aria-pressed={subscribed}
    >
      {/* Sweeping shine (unsubscribed only) */}
      {!subscribed && (
        <motion.span
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          animate={{ x: ["-120%", "120%"] }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            repeatDelay: 2.2,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Pulsing ring (subscribed only) */}
      {subscribed && (
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-primary"
          animate={{ scale: [1, 1.18], opacity: [0.6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
        />
      )}

      {/* Label with vertical roll animation on state change */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={subscribed ? "subscribed" : "subscribe"}
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -14, opacity: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="relative flex items-center gap-1.5"
        >
          {subscribed ? (
            <>
              <motion.span
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 15 }}
                className="inline-flex"
              >
                <Check className="h-3.5 w-3.5" />
              </motion.span>
              Subscribed
            </>
          ) : (
            <>
              <motion.span
                animate={{ rotate: [0, -18, 14, -8, 0] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  repeatDelay: 2.8,
                }}
                className="inline-flex"
              >
                <Bell className="h-3.5 w-3.5" />
              </motion.span>
              Subscribe
            </>
          )}
        </motion.span>
      </AnimatePresence>

      {subscribers !== null && (
        <span className="relative ml-0.5 rounded-full bg-black/25 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
          {subscribers.toLocaleString()}
        </span>
      )}
    </motion.button>
  );
}
