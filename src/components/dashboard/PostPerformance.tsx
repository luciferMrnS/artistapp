"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageSquare, ChevronDown, Loader2, ThumbsUp, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveAvatarUrl } from "@/lib/avatar-url";

interface PostRow {
  id: string;
  content: string;
  image: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

interface LikeRow {
  id: string;
  created_at: string;
  user: { id: string; username: string; avatar: string | null };
}

interface CommentRow {
  id: string;
  content: string;
  created_at: string;
  author: { id: string; username: string; avatar: string | null };
}

interface PostDetails {
  likes: LikeRow[];
  comments: CommentRow[];
}

function formatTimeDifference(date: string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

/**
 * Post performance list — one card per post with aggregate metrics and an
 * expandable panel showing exactly which fans liked and commented on it.
 * Likes/comments are fetched lazily only when a post is expanded.
 */
export function PostPerformance({ posts }: { posts: PostRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"likes" | "comments">("likes");
  const [details, setDetails] = useState<Record<string, PostDetails | "loading">>(
    {}
  );

  const maxEngagement = posts.reduce(
    (max, post) => Math.max(max, post.likes_count + post.comments_count),
    0
  );

  const toggleExpand = async (postId: string) => {
    if (expandedId === postId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(postId);
    setActiveTab("likes");

    if (details[postId]) return;
    setDetails((prev) => ({ ...prev, [postId]: "loading" }));

    try {
      const [likesRes, commentsRes] = await Promise.all([
        fetch(`/api/posts/${postId}/likes`, { credentials: "include" }),
        fetch(`/api/posts/${postId}/comments`, { credentials: "include" }),
      ]);
      if (!likesRes.ok || !commentsRes.ok) throw new Error("fetch failed");

      const [likesData, commentsData] = await Promise.all([
        likesRes.json(),
        commentsRes.json(),
      ]);

      setDetails((prev) => ({
        ...prev,
        [postId]: {
          likes: (likesData.likes ?? []) as LikeRow[],
          comments: (commentsData.comments ?? []) as CommentRow[],
        },
      }));
    } catch (error) {
      console.error("Failed to load post details:", error);
      setDetails((prev) => ({ ...prev, [postId]: { likes: [], comments: [] } }));
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-zinc-900 p-5">
      <h2 className="mb-4 text-lg font-semibold">Post performance</h2>

      {posts.length === 0 ? (
        <p className="text-sm text-secondary">
          No posts yet — create your first post to see stats here.
        </p>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => {
            const engagement = post.likes_count + post.comments_count;
            const width = maxEngagement ? (engagement / maxEngagement) * 100 : 0;
            const isExpanded = expandedId === post.id;
            const detail = details[post.id];

            return (
              <li
                key={post.id}
                className="rounded-xl bg-black/40 px-3 py-3"
              >
                {/* Post summary row (clickable to expand) */}
                <button
                  type="button"
                  onClick={() => toggleExpand(post.id)}
                  className="w-full text-left outline-none"
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="line-clamp-1 flex-1 text-sm">
                      {post.image ? (
                        <img
                          src={post.image}
                          alt=""
                          className="mr-2 inline h-8 w-8 rounded-lg object-cover align-middle"
                        />
                      ) : null}
                      {post.content || "(no text)"}
                    </p>
                    <span className="shrink-0 text-xs text-secondary">
                      {formatTimeDifference(post.created_at)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-secondary">
                    <span className="inline-flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5 text-pink-500" />
                      {post.likes_count}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5 text-sky-400" />
                      {post.comments_count}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-pink-500"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-secondary transition-transform",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </div>
                </button>

                {/* Expandable per-post details */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 border-t border-border pt-3">
                        {/* Tabs */}
                        <div className="mb-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveTab("likes")}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition",
                              activeTab === "likes"
                                ? "bg-pink-500/15 text-pink-400 ring-1 ring-pink-500/40"
                                : "text-secondary hover:bg-white/10"
                            )}
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                            Likes ({post.likes_count})
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab("comments")}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition",
                              activeTab === "comments"
                                ? "bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/40"
                                : "text-secondary hover:bg-white/10"
                            )}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            Comments ({post.comments_count})
                          </button>
                        </div>

                        {detail === "loading" || detail === undefined ? (
                          <div className="flex items-center justify-center gap-2 py-6 text-secondary">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-xs">Loading…</span>
                          </div>
                        ) : activeTab === "likes" ? (
                          detail.likes.length === 0 ? (
                            <p className="py-4 text-center text-xs text-secondary">
                              No likes yet
                            </p>
                          ) : (
                            <ul className="space-y-1">
                              {detail.likes.map((like) => (
                                <li
                                  key={like.id}
                                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5"
                                >
                                  <img
                                    src={resolveAvatarUrl(like.user.avatar)}
                                    alt={like.user.username}
                                    className="h-7 w-7 rounded-full object-cover"
                                  />
                                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                    {like.user.username}
                                  </span>
                                  <span className="shrink-0 text-[11px] text-secondary">
                                    {formatTimeDifference(like.created_at)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )
                        ) : detail.comments.length === 0 ? (
                          <p className="py-4 text-center text-xs text-secondary">
                            No comments yet
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {detail.comments.map((comment) => (
                              <li
                                key={comment.id}
                                className="rounded-lg bg-white/5 px-3 py-2"
                              >
                                <div className="flex items-center gap-2">
                                  <img
                                    src={resolveAvatarUrl(comment.author.avatar)}
                                    alt={comment.author.username}
                                    className="h-6 w-6 rounded-full object-cover"
                                  />
                                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                                    {comment.author.username}
                                  </span>
                                  <span className="shrink-0 text-[11px] text-secondary">
                                    {formatTimeDifference(comment.created_at)}
                                  </span>
                                </div>
                                <p className="mt-1.5 break-words pl-8 text-xs leading-relaxed text-secondary">
                                  {comment.content}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}