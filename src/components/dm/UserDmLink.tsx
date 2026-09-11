"use client";

import { useRouter } from "next/navigation";
import React from "react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

interface UserDmLinkProps {
  userId: string;
  username: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Clickable username that opens a DM with that user
 * (`/messages?user=<id>`). Rendered as a plain span for the current user
 * themselves — you can't DM yourself.
 */
export function UserDmLink({ userId, username, className, children }: UserDmLinkProps) {
  const { user } = useAuth();
  const router = useRouter();

  const canOpen = user && userId !== user.id;
  if (!canOpen) {
    return <span className={className}>{children ?? username}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => router.push(`/messages?user=${encodeURIComponent(userId)}`)}
      title={`Message ${children ?? username}`}
      aria-label={`Message ${children ?? username}`}
      className={cn(
        "cursor-pointer transition-colors hover:text-primary hover:underline focus:outline-none",
        className
      )}
    >
      {children ?? username}
    </button>
  );
}