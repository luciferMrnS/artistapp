"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Rocket, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComingSoonContextValue {
  openComingSoon: (label: string) => void;
}

const ComingSoonContext = createContext<ComingSoonContextValue>({
  openComingSoon: () => {},
});

export function useComingSoon() {
  return useContext(ComingSoonContext);
}

/**
 * Renders the shared animated "Coming soon" overlay. Wrap a subtree with
 * <ComingSoonProvider> and trigger it from anywhere via useComingSoon()
 * (or the <ComingSoonTrigger> helper button).
 */
export function ComingSoonProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [label, setLabel] = useState<string | null>(null);

  const openComingSoon = useCallback((l: string) => setLabel(l), []);
  const close = useCallback(() => setLabel(null), []);

  return (
    <ComingSoonContext.Provider value={{ openComingSoon }}>
      {children}

      <AnimatePresence>
        {label !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={close}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 10 }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 20,
              }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-3xl border border-primary/30 bg-zinc-900 p-8 text-center shadow-[0_0_80px_rgba(29,155,240,0.25)]"
            >
              <button
                type="button"
                onClick={close}
                aria-label="Close coming soon popup"
                className="absolute right-4 top-4 rounded-full p-1.5 text-secondary transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
                <motion.span
                  aria-hidden
                  animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0.15, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-full bg-primary/40 blur-xl"
                />
                <motion.div
                  animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-500"
                >
                  <Rocket className="h-8 w-8 text-white" />
                </motion.div>
              </div>

              <p className="mt-5 text-xs font-bold uppercase tracking-[0.3em] text-primary">
                Exclusive
              </p>
              <h3 className="mt-1 bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-3xl font-black text-transparent">
                Coming soon
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-secondary">
                <span className="font-semibold text-white">{label}</span> is on
                its way — stay tuned, you&apos;ll be first in line.
              </p>

              <button
                type="button"
                onClick={close}
                className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-primary py-2.5 text-sm font-bold text-white transition hover:opacity-90"
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ComingSoonContext.Provider>
  );
}

/** Helper button that opens the Coming soon popup with the given label. */
export function ComingSoonTrigger({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { openComingSoon } = useComingSoon();
  return (
    <button type="button" onClick={() => openComingSoon(label)} className={cn(className)}>
      {children}
    </button>
  );
}