import { Sidebar } from "@/components/layout/Sidebar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { CreatePostForm } from "@/components/feed/CreatePostForm";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/server-auth";
import {
  getAllPosts,
  hasUserLikedPost,
  type PostWithAuthor,
} from "@/lib/db";
import { Post } from "@/components/feed/Post";

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

  const posts = await getAllPosts();

  const enriched = await Promise.all(
    posts.map(async (post: PostWithAuthor) => {
      const userLiked = await hasUserLikedPost(post.id, payload.userId);
      return {
        ...post,
        userLiked,
      };
    })
  );

  return { posts: enriched, userId: payload.userId };
}

function CreatePageContent({
  posts,
}: {
  posts: Awaited<ReturnType<typeof fetchFeedData>>["posts"];
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex max-w-[1500px]">
        <Sidebar />

        <main className="ml-20 min-h-screen flex-1 border-x border-border xl:ml-64">
          <header className="border-b border-border bg-black/80">
            <div className="mx-auto flex max-w-[680px] items-center justify-between px-4 py-4">
              <h1 className="text-xl font-bold">Create Post</h1>
              <span className="text-sm text-secondary">
                Only the artist can create posts. Fans can like & comment.
              </span>
            </div>
          </header>

          <div className="mx-auto max-w-[680px] pb-10">
            {/* Post creation form — artist only */}
            <CreatePostForm />

            {/* Show existing posts below */}
            <section className="pt-2">
              {posts.length === 0 ? (
                <div className="p-8 text-center text-secondary">
                  <p className="text-sm">
                    No posts yet. Be the first to create one!
                  </p>
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
      </div>
    </div>
  );
}

export default async function CreatePage() {
  const { posts } = await fetchFeedData();

  return (
    <ProtectedRoute>
      <CreatePageContent posts={posts} />
    </ProtectedRoute>
  );
}
