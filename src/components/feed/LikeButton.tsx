"use client";

import React, { useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

interface LikeButtonProps {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
  onLikeChange: (liked: boolean, count: number) => void;
}

export function LikeButton({
  postId,
  initialLiked,
  initialCount,
  onLikeChange,
}: LikeButtonProps) {
  const { user } = useAuth();
  const router = useRouter();
  const viewOnly = Boolean(user?.restricted_at);
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [isAnimating, setIsAnimating] = useState(false);

  const toggleLike = async () => {
    if (isAnimating) return;

    if (!user) {
      router.push("/auth/login");
      return;
    }

    if (viewOnly) {
      window.alert("You have limited access, try again later");
      return;
    }

    setIsAnimating(true);

    try {
      if (liked) {
        // Unlike
        const res = await fetch(`/api/posts/${postId}/likes`, {
          method: "DELETE",
          credentials: "include",
        });
        if (res.ok) {
          setLiked(false);
          setCount(count - 1);
          onLikeChange(false, count - 1);
        }
      } else {
        // Like
        const res = await fetch(`/api/posts/${postId}/likes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          credentials: "include",
        });
        if (res.ok) {
          setLiked(true);
          setCount(count + 1);
          onLikeChange(true, count + 1);
        }
      }
    } catch (error) {
      console.error("Like action failed:", error);
    } finally {
      setIsAnimating(false);
    }
  };

  return (
    <button
      onClick={toggleLike}
      disabled={isAnimating}
      className={cn(
        "group flex items-center gap-2 text-secondary transition-colors",
        liked ? "text-pink-500" : "hover:text-pink-500"
      )}
    >
      <div
        className={cn(
          "p-2 rounded-full transition-all",
          liked ? "bg-pink-500/20" : "group-hover:bg-pink-500/10"
        )}
      >
        <Heart
          className={cn(
            "h-6 w-6 transition-all",
            liked
              ? "fill-pink-500 text-pink-500"
              : "group-hover:scale-110"
          )}
        />
      </div>
      <span className="text-sm">{count}</span>
    </button>
  );
}
