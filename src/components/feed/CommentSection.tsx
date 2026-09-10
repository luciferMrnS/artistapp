"use client";

import React, { useState } from "react";
import { Send, Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

interface CommentSectionProps {
  postId: string;
  initialComments: number;
  onCommentCountChange: (count: number) => void;
}

interface CommentData {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author: {
    id: string;
    username: string;
    avatar: string;
    role: "artist" | "fan";
  };
}

export function CommentSection({
  postId,
  initialComments,
  onCommentCountChange,
}: CommentSectionProps) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [commentCount, setCommentCount] = useState(initialComments);
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);

  const toggleExpanded = async () => {
    if (!expanded) {
      setExpanded(true);
      if (comments.length === 0) {
        setIsLoadingComments(true);
        try {
          const res = await fetch(`/api/posts/${postId}/comments`, {
            credentials: "include",
          });
          const data = await res.json();
          if (res.ok) {
            setComments(data.comments || []);
          }
        } catch (error) {
          console.error("Failed to load comments:", error);
        } finally {
          setIsLoadingComments(false);
        }
      }
    } else {
      setExpanded(false);
    }
  };

  const submitComment = async () => {
    if (!inputValue.trim() || !user) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: inputValue.trim() }),
        credentials: "include",
      });

      const data = await res.json();
      if (res.ok && data.comment) {
        setComments((prev) => [...prev, data.comment]);
        const newCount = commentCount + 1;
        setCommentCount(newCount);
        onCommentCountChange(newCount);
        setInputValue("");
      }
    } catch (error) {
      console.error("Failed to submit comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <button
        onClick={toggleExpanded}
        className={cn(
          "group flex items-center gap-2 text-secondary transition-colors",
          "hover:text-primary"
        )}
      >
        <div className="p-2 rounded-full group-hover:bg-primary/10">
          <Send className="h-6 w-6" />
        </div>
        <span className="text-sm">{commentCount}</span>
      </button>

      {expanded && (
        <div className="mt-3 ml-10 space-y-3">
          {isLoadingComments ? (
            <div className="text-sm text-secondary">Loading comments…</div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-2">
                <div className="h-6 w-6 shrink-0 rounded-full overflow-hidden">
                  <img
                    src={comment.author.avatar}
                    alt={comment.author.username}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex-1 rounded-2xl bg-zinc-900 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">
                      {comment.author.username}
                    </span>
                    <span className="text-xs text-secondary">
                      {new Date(comment.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{comment.content}</p>
                </div>
              </div>
            ))
          )}

          {user && (
            <div className="flex items-center gap-2 pt-2">
              <img
                src={user.avatar}
                alt={user.username}
                className="h-8 w-8 rounded-full"
              />
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Comment as a fan…"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isSubmitting) {
                      submitComment();
                    }
                  }}
                  disabled={isSubmitting}
                  className="w-full rounded-full bg-zinc-900 border border-border px-4 py-2 text-sm text-white placeholder-secondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <button
                onClick={submitComment}
                disabled={isSubmitting || !inputValue.trim()}
                className={cn(
                  "rounded-full p-2 text-primary transition-colors",
                  isSubmitting || !inputValue.trim()
                    ? "opacity-40"
                    : "hover:bg-primary/10"
                )}
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
