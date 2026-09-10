"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface UploadProgressProps {
  percent: number;
  size?: number;
  label?: string;
  className?: string;
}

/**
 * Clockwise percentage ring shown while a file uploads.
 * The ring draws clockwise from the top and the live % is centered.
 */
export function UploadProgress({
  percent,
  size = 72,
  label,
  className,
}: UploadProgressProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (circumference * clamped) / 100;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="none"
            strokeWidth="7"
            className="stroke-zinc-800"
          />
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="stroke-primary transition-[stroke-dashoffset] duration-150 ease-linear"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums">
          {clamped}%
        </span>
      </div>
      {label && <span className="text-xs text-secondary">{label}</span>}
    </div>
  );
}