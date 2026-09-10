import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Post } from "@/components/feed/Post";
import { Sidebar } from "@/components/layout/Sidebar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { verifyToken } from "@/lib/server-auth";
import { getPostById, hasUserLikedPost } from "@/lib/db";

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

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload) redirect("/auth/login");

  const post = await getPostById(id);
  if (!post) notFound();

  const userLiked = await hasUserLikedPost(post.id, payload.userId);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto flex max-w-[1500px]">
          <Sidebar />

          <main className="ml-20 min-h-screen flex-1 border-x border-border xl:ml-64">
            <header className="sticky top-0 z-20 border-b border-border bg-black/80 backdrop-blur-md">
              <div className="mx-auto flex max-w-[680px] items-center gap-3 px-4 py-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-secondary">
                    Post detail
                  </p>
                  <h1 className="text-xl font-bold">Post</h1>
                </div>
              </div>
            </header>

            <div className="mx-auto max-w-[680px] pb-10">
              <Post
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
                userLiked={userLiked}
              />
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}