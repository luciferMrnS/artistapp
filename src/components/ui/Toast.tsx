"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToastState {
  id: number;
  message: string;
}

const ToastContext = createContext<{
  showToast: (message: string) => void;
}>({
  showToast: () => {},
});

/**
 * Access a small auto-dismissing toast anywhere below <ToastProvider>.
 */
export function useToast() {
  return useContext(ToastContext);
}

const TOAST_DURATION_MS = 2400;

/**
 * Minimal toast/snackbar system. Renders a single floating pill at the bottom
 * of the screen; calling showToast replaces it and restarts the timer.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback((message: string) => {
    const id = ++idRef.current;
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ id, message });
    timerRef.current = setTimeout(
      () =>
        setToast((current) => (current && current.id === id ? null : current)),
      TOAST_DURATION_MS
    );
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex justify-center px-4"
      >
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ y: 24, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 12, opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
              className={cn(
                "pointer-events-auto flex items-center gap-2 rounded-full border border-primary/40 bg-zinc-900/95 px-4 py-2.5 text-sm font-semibold text-white shadow-xl shadow-black/50 backdrop-blur"
              )}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              </span>
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}