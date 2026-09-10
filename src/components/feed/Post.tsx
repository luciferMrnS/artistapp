"use client";

import React, { useState } from "react";
import { Bookmark, MoreHorizontal } from "lucide-react";
import { LikeButton } from "@/components/feed/LikeButton";
import { CommentSection } from "@/components/feed/CommentSection";
import { KebabMenu } from "@/components/ui/KebabMenu";
import { useAuth } from "@/context/AuthContext";
import { resolveAvatarUrl } from "@/lib/avatar-url";

export interface PostAuthor {
  id: string;
  username: string;
  avatar: string;
  role: "artist" | "fan";
}

export interface PostProps {
  id: string;
  author: PostAuthor;
  content: string;
  image?: string | null;
  likes: number;
  comments: number;
  timestamp: string;
  userLiked?: boolean;
}

export function Post({
  id,
  author,
  content,
  image,
  likes: initialLikes,
  comments: initialComments,
  timestamp,
  userLiked = false,
}: PostProps) {
  const { user } = useAuth();
  const [likes, setLikes] = useState(initialLikes);
  const [comments, setComments] = useState(initialComments);
  const [liked, setLiked] = useState(userLiked);

  const handleLikeChange = (newLiked: boolean, newCount: number) => {
    setLiked(newLiked);
    setLikes(newCount);
  };

  const handleCommentCountChange = (newCount: number) => {
    setComments(newCount);
  };

  const deletePost = async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) return false;
      window.location.reload();
      return true;
    } catch (err) {
      console.error("Failed to delete post:", err);
      return false;
    }
  };

  return (
    <article className="border-b border-border py-4 w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden">
            <img src={resolveAvatarUrl(author.avatar)} alt={author.username} className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="font-bold hover:underline cursor-pointer">{author.username}</span>
              {author.role === "artist" && (
                <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
                  Artist
                </span>
              )}
              <span className="text-secondary text-sm">· {timestamp}</span>
            </div>
          </div>
        </div>
        {user?.role === "artist" ? (
          <KebabMenu deleteLabel="Delete post" onDelete={deletePost} />
        ) : (
          <button className="text-secondary hover:text-primary p-2 rounded-full hover:bg-primary/10 transition-colors">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Content text */}
      <div className="px-4 mb-3">
        <p className="text-[15px] leading-normal">{content}</p>
      </div>

      {/* Media */}
      {image && (
        <div className="mb-3 px-0 sm:px-4">
          <div className="rounded-xl overflow-hidden border border-border aspect-square bg-zinc-900 flex items-center justify-center">
            <img
              src={image}
              alt="Post content"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://placehold.co/600x600/18181b/ffffff?text=Image+Placeholder`;
              }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-4">
        <div className="flex items-center justify-between -ml-2 mb-2">
          <div className="flex items-center gap-4">
            <LikeButton
              postId={id}
              initialLiked={liked}
              initialCount={likes}
              onLikeChange={handleLikeChange}
            />
            <CommentSection
              postId={id}
              initialComments={comments}
              onCommentCountChange={handleCommentCountChange}
            />
          </div>
          <button className="text-secondary hover:text-primary p-2 rounded-full hover:bg-primary/10 transition-colors">
            <Bookmark className="w-6 h-6" />
          </button>
        </div>
      </div>
    </article>
  );
}
