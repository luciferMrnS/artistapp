import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Post } from "@/components/feed/Post";
import { Sidebar } from "@/components/layout/Sidebar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { CreatePostForm } from "@/components/feed/CreatePostForm";
import { SubscribeButton } from "@/components/feed/SubscribeButton";
import { MusicSection, type TrackListItem } from "@/components/music/MusicSection";
import { Logo } from "@/components/brand/Logo";
import { getLiveStatus, type LiveStatus } from "@/lib/live";
import { verifyToken } from "@/lib/server-auth";
import { STORIES } from "@/lib/stories";
import { FanLeaderboard } from "@/components/presence/FanLeaderboard";
import Link from "next/link";
import {
  getAllPosts,
  getArtistUser,
  getFollowCounts,
  getMonthlyListeners,
  getTracksWithSignedUrls,
  getUserLikedPostIds,
  type PostWithAuthor,
} from "@/lib/db";

// Global (non user-specific) lookups are cached so fan traffic doesn't hit
// Supabase on every render. User-specific data (auth token, liked state)
// stays uncached. `unstable_cache` persists across requests on serverless
// hosts (Vercel Data Cache) and in memory/disk when self-hosted.
const cachedGetAllPosts = unstable_cache(getAllPosts, ["feed-posts"], {
  revalidate: 60,
});
const cachedGetArtistUser = unstable_cache(getArtistUser, ["artist-user"], {
  revalidate: 300,
});
const cachedLiveStatus = unstable_cache(getLiveStatus, ["live-status"], {
  revalidate: 30,
});
const cachedTracks = unstable_cache(getTracksWithSignedUrls, ["tracks"], {
  revalidate: 60,
});
const cachedFollowCounts = unstable_cache(getFollowCounts, ["follow-counts"], {
  revalidate: 300,
});
const cachedMonthlyListeners = unstable_cache(getMonthlyListeners, [
  "monthly-listeners",
], { revalidate: 300 });

/**
 * Server-side: fetch posts + per-user interaction state
 */
async function fetchFeedData() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;

  if (!token)
    return {
      posts: [] as (PostWithAuthor & { userLiked: boolean })[],
      userId: null as string | null,
    };

  const payload = verifyToken(token);
  if (!payload)
    return {
      posts: [] as (PostWithAuthor & { userLiked: boolean })[],
      userId: null as string | null,
    };

  const posts = await cachedGetAllPosts();

  // Batch the like check into a single query (instead of one per post)
  const likedIds = await getUserLikedPostIds(
    payload.userId,
    posts.map((post) => post.id)
  );
  const enriched = posts.map((post) => ({
    ...post,
    userLiked: likedIds.has(post.id),
  }));

  return { posts: enriched, userId: payload.userId };
}

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
 * Engagement rate by followers:
 * (total likes + comments across the feed) / follower count × 100
 */
function computeEngagementRate(
  posts: Awaited<ReturnType<typeof fetchFeedData>>["posts"],
  followerCount: number
): string {
  if (followerCount <= 0) return "—";

  const totalInteractions = posts.reduce(
    (sum, post) => sum + post.likes_count + post.comments_count,
    0
  );

  return `${((totalInteractions / followerCount) * 100).toFixed(1)}%`;
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function HomeContent({
  posts,
  artistId,
  followerCount,
  monthlyListeners,
  tracks,
  liveStatus,
}: {
  posts: Awaited<ReturnType<typeof fetchFeedData>>["posts"];
  artistId: string | null;
  followerCount: number;
  monthlyListeners: number;
  tracks: TrackListItem[];
  liveStatus: LiveStatus;
}) {
  const engagementRate = computeEngagementRate(posts, followerCount);
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex max-w-[1500px]">
        <Sidebar />

        <main className="ml-20 min-h-screen flex-1 border-x border-border xl:ml-64">
          <header className="sticky top-0 z-20 border-b border-border bg-black/80 backdrop-blur-md">
            <div className="mx-auto flex max-w-[680px] items-center justify-between px-4 py-4">
              <div className="flex items-center gap-3">
                <Link href="/" title="Kendrick David">
                  <Logo className="h-10 w-10" />
                </Link>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-secondary">
                    Artist feed
                  </p>
                  <h1 className="text-xl font-bold">Kendrick David</h1>
                </div>
                <SubscribeButton artistId={artistId} />
              </div>

              <Link
                href="/stories/live-now"
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition",
                  liveStatus.live
                    ? "bg-primary/15 text-primary ring-1 ring-primary/30 hover:bg-primary/20"
                    : liveStatus.configured
                      ? "bg-zinc-900 text-secondary ring-1 ring-border hover:bg-white/5"
                      : "bg-zinc-900/60 text-secondary/80 ring-1 ring-border/60 hover:bg-white/5"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-2.5 w-2.5 rounded-full",
                    liveStatus.live ? "animate-pulse bg-red-500" : "bg-zinc-600"
                  )}
                />
                {liveStatus.live
                  ? "Live now"
                  : liveStatus.configured
                    ? "Offline"
                    : "Live soon"}
              </Link>
            </div>
          </header>

          <div className="mx-auto max-w-[680px] pb-10">
            {/* Create Post Form — Artist only (conditionally rendered) */}
            <CreatePostForm />

            <section className="border-b border-border p-4">
              <div className="mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-secondary">
                    Highlights
                  </p>
                  <h2 className="text-lg font-semibold">Latest from the artist</h2>
                </div>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2">
                {STORIES.map((story) => (
                  <Link
                    key={story.slug}
                    href={`/stories/${story.slug}`}
                    className="group min-w-[110px] rounded-2xl border border-border bg-zinc-900 p-2 text-left transition-transform hover:-translate-y-1 hover:border-primary/40"
                  >
                    <div
                      className={`mb-3 flex h-16 items-center justify-center rounded-xl bg-gradient-to-br ${story.tone} opacity-90 transition-opacity group-hover:opacity-100`}
                    >
                      <story.icon className="h-6 w-6 text-white" />
                    </div>
                    <p className="text-sm font-medium text-white group-hover:text-primary">
                      {story.name}
                    </p>
                  </Link>
                ))}
              </div>
            </section>

            <section className="border-b border-border p-4">
              <MusicSection tracks={tracks} />
            </section>

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
                    author={{
                      id: post.author.id,
                      username: post.author.username,
                      avatar: post.author.avatar,
                      role: post.author.role,
                    }}
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
          </div>
        </main>

        <aside className="hidden w-[330px] shrink-0 p-4 xl:block">
          <div className="sticky top-6 space-y-5">
            <div className="rounded-2xl border border-border bg-zinc-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Artist pulse</h3>
                <Sparkles className="h-4 w-4 text-primary" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-black/40 p-3">
                  <span className="text-secondary">Followers</span>
                  <span className="font-bold">
                    {formatCompactNumber(followerCount)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-black/40 p-3">
                  <span className="text-secondary">Monthly listeners</span>
                  <span className="font-bold">
                    {formatCompactNumber(monthlyListeners)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-black/40 p-3">
                  <span className="text-secondary">Engagement</span>
                  <span className="font-bold">{engagementRate}</span>
                </div>
              </div>
            </div>

            <FanLeaderboard />
          </div>
        </aside>
      </div>
    </div>
  );
}

export default async function Home() {
  // Independent lookups run concurrently to cut latency on every render
  const [{ posts }, artist, liveStatus, rawTracks] = await Promise.all([
    fetchFeedData(),
    cachedGetArtistUser(),
    cachedLiveStatus(),
    cachedTracks(),
  ]);
  const [followerCount, monthlyListeners] = artist
    ? await Promise.all([
        cachedFollowCounts(artist.id).then((counts) => counts.followers),
        cachedMonthlyListeners(artist.id),
      ])
    : [0, 0];

  // Strip storage_path — only the signed streaming URL leaves the server
  const tracks: TrackListItem[] = rawTracks.map((track) => ({
    id: track.id,
    title: track.title,
    plays_count: track.plays_count,
    created_at: track.created_at,
    audio_url: track.audio_url,
    cover_url: track.cover_url,
  }));

  return (
    <ProtectedRoute>
      <HomeContent
        posts={posts}
        artistId={artist?.id ?? null}
        followerCount={followerCount}
        monthlyListeners={monthlyListeners}
        tracks={tracks}
        liveStatus={liveStatus}
      />
    </ProtectedRoute>
  );
}
