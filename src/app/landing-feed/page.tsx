import { Sidebar } from "@/components/layout/Sidebar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { FeedEditor } from "@/components/landing-admin/FeedEditor";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/server-auth";
import { findUserById, getLandingFeed, isLandingFeedReady } from "@/lib/db";
import { LANDING_PREVIEW_URL } from "@/lib/site";

function LandingFeedPageContent({
  items,
  ready,
}: {
  items: Awaited<ReturnType<typeof getLandingFeed>>;
  ready: boolean;
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex max-w-[1500px]">
        <Sidebar />

        <main className="ml-20 min-h-screen flex-1 border-x border-border xl:ml-64">
          <header className="border-b border-border bg-black/80">
            <div className="mx-auto flex max-w-[880px] items-center px-4 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-secondary">
                  Public landing page
                </p>
                <h1 className="text-xl font-bold">Landing Feed</h1>
              </div>
              {/* Every signed-in account is redirected off / to the community,
                  so this is how the artist still sees the page they edit. */}
              <a
                href={LANDING_PREVIEW_URL}
                className="ml-auto text-sm text-secondary underline underline-offset-4 hover:text-white"
              >
                View live page
              </a>
            </div>
          </header>

          <div className="mx-auto max-w-[880px] space-y-6 p-6 pb-16">
            <p className="text-sm text-secondary">
              The pictures and videos in the grid on the public landing page, in the order
              visitors see them. Changes go live as soon as you save.
            </p>

            <FeedEditor initialItems={items} ready={ready} />
          </div>
        </main>
      </div>
    </div>
  );
}

export default async function LandingFeedPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload) redirect("/auth/login");

  /* The role is read from the database rather than taken from the token, the
     same way requireArtist() reads it. A token minted while the user was still
     the artist would otherwise render this page after they had been demoted,
     leaving an editor whose every save fails with a 403. */
  const user = await findUserById(payload.userId);
  if (!user) redirect("/auth/login");
  if (user.role !== "artist") redirect("/");

  /* Read here rather than in the client so the list the artist sees on arrival
     is the real one, and so the "run the migration" notice is accurate. */
  const [items, ready] = await Promise.all([getLandingFeed(), isLandingFeedReady()]);

  return (
    <ProtectedRoute>
      <LandingFeedPageContent items={items} ready={ready} />
    </ProtectedRoute>
  );
}
