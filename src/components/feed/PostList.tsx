"use client";

import { Post } from "@/components/feed/Post";
import { useFeed } from "@/components/feed/FeedContext";

function formatTimeDifference(date: string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

/**
 * Client-rendered feed list. Renders from the FeedProvider's state so
 * newly created posts show up instantly without a page reload, and
 * deleted posts disappear without one.
 */
export function PostList() {
  const feed = useFeed();
  const posts = feed?.posts ?? [];

  return (
    <section className="pt-2">
      {posts.length === 0 ? (
        <div className="p-8 text-center text-secondary">
          <p className="text-sm">No posts yet. Check back later!</p>
        </div>
      ) : (
        posts.map((post) => (
          <Post
            key={post.id}
            id={post.id}
            author={post.author}
            content={post.content}
            image={post.image}
            likes={post.likes_count}
            comments={post.comments_count}
            timestamp={formatTimeDifference(post.created_at)}
            userLiked={post.userLiked}
          />
        ))
      )}
    </section>
  );
}