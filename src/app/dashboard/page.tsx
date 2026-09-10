import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  Users,
  Headphones,
  FileText,
  Heart,
  MessageSquare,
  Activity,
  Music4,
  TrendingUp,
  Crown,
  BadgeCheck,
  Mail,
} from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { NewsletterForm } from "@/components/dashboard/NewsletterForm";
import { verifyToken } from "@/lib/server-auth";
import { getArtistStats, getArtistFollowers, type ArtistStats, type SubscriberRow } from "@/lib/db";

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
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

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-zinc-900 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-secondary">{label}</span>
        <div className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function DashboardContent({
  stats,
  subscribers,
}: {
  stats: ArtistStats;
  subscribers: SubscriberRow[];
}) {
  const maxEngagement = stats.topFans[0]?.total ?? 0;
  const maxPostEngagement = stats.posts.reduce(
    (max, post) => Math.max(max, post.likes_count + post.comments_count),
    0
  );
  const medalColors = [
    "bg-amber-400/15 text-amber-300",
    "bg-zinc-400/15 text-zinc-300",
    "bg-orange-400/15 text-orange-300",
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex max-w-[1500px]">
        <Sidebar />

        <main className="ml-20 min-h-screen flex-1 border-x border-border xl:ml-64">
          <header className="sticky top-0 z-20 border-b border-border bg-black/80 backdrop-blur-md">
            <div className="mx-auto flex max-w-[680px] items-center gap-3 px-4 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-secondary">
                  Artist analytics
                </p>
                <h1 className="text-xl font-bold">Dashboard</h1>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[680px] space-y-6 p-6 pb-16">
            {/* Overview cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard
                icon={Users}
                label="Followers"
                value={formatCompactNumber(stats.followerCount)}
                accent="bg-sky-400/15 text-sky-400"
              />
              <StatCard
                icon={Headphones}
                label="Monthly listeners"
                value={formatCompactNumber(stats.monthlyListeners)}
                accent="bg-emerald-400/15 text-emerald-400"
              />
              <StatCard
                icon={FileText}
                label="Posts"
                value={formatCompactNumber(stats.totalPosts)}
                accent="bg-primary/15 text-primary"
              />
              <StatCard
                icon={Activity}
                label="Engagement"
                value={`${stats.engagementRate.toFixed(1)}%`}
                accent="bg-violet-400/15 text-violet-400"
              />
              <StatCard
                icon={Heart}
                label="Total likes"
                value={formatCompactNumber(stats.totalLikes)}
                accent="bg-pink-400/15 text-pink-400"
              />
              <StatCard
                icon={MessageSquare}
                label="Total comments"
                value={formatCompactNumber(stats.totalComments)}
                accent="bg-sky-500/15 text-sky-500"
              />
              <StatCard
                icon={Music4}
                label="Track plays"
                value={formatCompactNumber(stats.totalTrackPlays)}
                accent="bg-amber-400/15 text-amber-400"
              />
            </div>

            {/* Top fans leaderboard */}
            <section className="rounded-2xl border border-border bg-zinc-900 p-5">
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Biggest fans</h2>
              </div>

              {stats.topFans.length === 0 ? (
                <p className="text-sm text-secondary">
                  No fan engagement yet — likes and comments will appear here.
                </p>
              ) : (
                <ol className="space-y-2">
                  {stats.topFans.map((fan, index) => (
                    <li
                      key={fan.user_id}
                      className="flex items-center gap-3 rounded-xl bg-black/40 px-3 py-2.5"
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          medalColors[index] ?? "bg-white/5 text-secondary"
                        }`}
                      >
                        {index === 0 ? <Crown className="h-4 w-4" /> : index + 1}
                      </span>
                      <img
                        src={fan.avatar}
                        alt={fan.username}
                        className="h-9 w-9 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{fan.username}</p>
                        <p className="text-xs text-secondary">
                          {fan.likes} likes · {fan.comments} comments
                        </p>
                      </div>
                      <div className="w-24">
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-pink-500"
                            style={{
                              width: `${maxEngagement ? (fan.total / maxEngagement) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <p className="mt-1 text-right text-[11px] text-secondary">
                          {fan.total} pts
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* Post performance */}
            <section className="rounded-2xl border border-border bg-zinc-900 p-5">
              <h2 className="mb-4 text-lg font-semibold">Post performance</h2>

              {stats.posts.length === 0 ? (
                <p className="text-sm text-secondary">
                  No posts yet — create your first post to see stats here.
                </p>
              ) : (
                <ul className="space-y-3">
                  {stats.posts.map((post) => {
                    const engagement = post.likes_count + post.comments_count;
                    const width = maxPostEngagement
                      ? (engagement / maxPostEngagement) * 100
                      : 0;
                    return (
                      <li
                        key={post.id}
                        className="rounded-xl bg-black/40 px-3 py-3"
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
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Subscribers list */}
            <section className="rounded-2xl border border-border bg-zinc-900 p-5">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Users className="h-5 w-5 text-sky-400" /> Subscribers
                <span className="ml-auto rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-secondary">
                  {subscribers.length}
                </span>
              </h2>

              {subscribers.length === 0 ? (
                <p className="text-sm text-secondary">
                  No subscribers yet — fans who hit "Subscribe" will appear here.
                </p>
              ) : (
                <ul className="space-y-2">
                  {subscribers.map((sub) => (
                    <li
                      key={sub.id}
                      className="flex items-center gap-3 rounded-xl bg-black/40 px-3 py-2.5"
                    >
                      <img
                        src={sub.avatar || `https://i.pravatar.cc/150?u=${sub.id}`}
                        alt={sub.username}
                        className="h-9 w-9 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                          {sub.username}
                          {sub.email_verified && (
                            <span title="Verified email">
                              <BadgeCheck className="h-4 w-4 shrink-0 text-sky-400" />
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-secondary">{sub.email}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-secondary">
                        {new Date(sub.subscribed_at).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Newsletter */}
            <NewsletterForm />
          </div>
        </main>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload) redirect("/auth/login");
  if (payload.role !== "artist") redirect("/");

  const [stats, subscribers] = await Promise.all([
    getArtistStats(),
    getArtistFollowers(),
  ]);
  if (!stats) redirect("/");

  return (
    <ProtectedRoute>
      <DashboardContent stats={stats} subscribers={subscribers} />
    </ProtectedRoute>
  );
}