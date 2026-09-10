"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface FeedAuthor {
  id: string;
  username: string;
  avatar: string;
  role: "artist" | "fan";
}

/** Raw post row returned by the create endpoint (no author yet) */
export interface FeedPostData {
  id: string;
  content: string;
  image: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

export interface FeedPost extends FeedPostData {
  author: FeedAuthor;
  userLiked: boolean;
}

interface FeedContextValue {
  posts: FeedPost[];
  prependPost: (post: FeedPostData) => void;
}

const FeedContext = createContext<FeedContextValue | null>(null);

/**
 * Holds the feed in client state so creating a post prepends it without
 * forcing a full page reload. The artist (who is the only one who can
 * create posts) is filled in as the author of new posts.
 */
export function FeedProvider({
  initialPosts,
  artist,
  children,
}: {
  initialPosts: FeedPost[];
  artist: FeedAuthor;
  children: ReactNode;
}) {
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts);

  const prependPost = useCallback(
    (post: FeedPostData) => {
      setPosts((prev) => [
        { ...post, author: artist, userLiked: false },
        ...prev.filter((p) => p.id !== post.id),
      ]);
    },
    [artist]
  );

  const value = useMemo(() => ({ posts, prependPost }), [posts, prependPost]);

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

/** Returns the feed state, or null when no provider is mounted. */
export function useFeed(): FeedContextValue | null {
  return useContext(FeedContext);
}