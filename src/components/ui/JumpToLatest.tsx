"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown } from "lucide-react";

/**
 * Floating "jump to latest message" pill, rendered over the bottom-center of
 * a chat scroll area. Parent must be a positioned container.
 */
export function JumpToLatest({
  show,
  onClick,
}: {
  show: boolean;
  onClick: () => void;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          onClick={onClick}
          initial={{ opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.9 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="absolute bottom-4 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-zinc-800/95 px-3.5 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur transition hover:bg-zinc-700"
          aria-label="Jump to latest message"
        >
          <ArrowDown className="h-4 w-4" />
          Latest
        </motion.button>
      )}
    </AnimatePresence>
  );
}