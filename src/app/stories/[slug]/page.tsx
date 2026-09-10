import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, HeartHandshake } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { SubscribeButton } from "@/components/feed/SubscribeButton";
import { ThemeMediaSection } from "@/components/media/ThemeMediaSection";
import { LiveNowPlayer } from "@/components/live/LiveNowPlayer";
import { ComingSoonBanner } from "@/components/live/ComingSoonBanner";
import { ComingSoonProvider, ComingSoonTrigger } from "@/components/ui/ComingSoonProvider";
import { MerchStore } from "@/components/store/MerchStore";
import type { ThemeSlug } from "@/lib/db";
import { getArtistUser, getFollowCounts } from "@/lib/db";
import { getStory, STORIES } from "@/lib/stories";

export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const story = getStory(slug);
  if (!story) notFound();

  const artist = await getArtistUser();
  const Icon = story.icon;
  const fanClubCounts = artist ? await getFollowCounts(artist.id) : null;

  return (
    <ProtectedRoute>
      <ComingSoonProvider>
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto flex max-w-[1500px]">
          <Sidebar />

          <main className="ml-20 min-h-screen flex-1 border-x border-border xl:ml-64">
            {/* ── Themed hero ── */}
            <div
              className={`relative h-64 overflow-hidden bg-gradient-to-br ${story.tone}`}
            >
              <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
              <div className="absolute -bottom-16 left-1/3 h-56 w-56 rounded-full bg-black/10" />
              <div className="absolute inset-0 flex flex-col justify-end p-6">
                <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-black/30 backdrop-blur-sm">
                  <Icon className="h-7 w-7 text-white" />
                </div>
                <h1 className="text-4xl font-black tracking-tight">
                  {story.name}
                </h1>
                <p className="mt-1 text-sm font-medium uppercase tracking-[0.22em] text-white/80">
                  {story.tagline}
                </p>
              </div>
            </div>

            <div className="mx-auto max-w-[680px] pb-10">
              <Link
                href="/"
                className="mt-5 inline-flex items-center gap-2 px-4 text-sm text-secondary transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" /> Back to feed
              </Link>

              <p className="mt-4 px-4 text-[15px] leading-normal text-secondary">
                {story.description}
              </p>

              {/* ── Live Now player ── */}
              {story.slug === "live-now" && (
                <>
                  <ComingSoonBanner />
                  <LiveNowPlayer artistId={artist?.id ?? null} />
                </>
              )}

              {story.slug === "fan-club" && (
                <div className="mx-4 mt-6 rounded-2xl border border-border bg-gradient-to-r from-emerald-500/15 via-transparent to-teal-500/15 p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-secondary">
                    Community size
                  </p>
                  <p className="mt-1 text-4xl font-black text-emerald-400">
                    {(fanClubCounts?.followers ?? 0).toLocaleString()}{" "}
                    <span className="text-lg font-semibold text-white">
                      subscribed fans
                    </span>
                  </p>
                  <ul className="mt-4 space-y-2">
                    {[
                      "Early access to every new drop",
                      "Members-only behind the scenes posts",
                      "Direct line to the studio — comment priority",
                    ].map((perk) => (
                      <li
                        key={perk}
                        className="flex items-center gap-2 text-sm text-white"
                      >
                        <Check className="h-4 w-4 text-emerald-400" /> {perk}
                      </li>
                    ))}
                  </ul>
                  {artist && (
                    <div className="mt-5">
                      <SubscribeButton artistId={artist.id} />
                    </div>
                  )}

                  <ComingSoonTrigger
                    label="Donations"
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-5 py-2 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/25 hover:shadow-[0_0_20px_rgba(16,185,129,0.35)]"
                  >
                    <HeartHandshake className="h-5 w-5" /> Donate to the music
                  </ComingSoonTrigger>
                </div>
              )}

              {story.slug === "fan-club" && (
                <MerchStore />
              )}

              {/* ── Themed media (New drop / Behind the scenes / Studio) ── */}
              {(["new-drop", "behind-the-scenes", "studio"] as ThemeSlug[]).includes(
                story.slug as ThemeSlug
              ) && (
                <div className="mt-4">
                  <ThemeMediaSection theme={story.slug as ThemeSlug} />
                </div>
              )}

              {/* ── Explore the other stories ── */}
              <section className="mt-8 border-t border-border p-4">
                <h3 className="mb-3 text-sm uppercase tracking-[0.22em] text-secondary">
                  Explore more
                </h3>
                <div className="flex flex-wrap gap-2">
                  {STORIES.filter((s) => s.slug !== story.slug).map((s) => (
                    <Link
                      key={s.slug}
                      href={`/stories/${s.slug}`}
                      className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${s.tone} px-3 py-1.5 text-xs font-bold text-white opacity-80 transition hover:opacity-100`}
                    >
                      <s.icon className="h-3.5 w-3.5" /> {s.name}
                    </Link>
                  ))}
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
      </ComingSoonProvider>
    </ProtectedRoute>
  );
}
