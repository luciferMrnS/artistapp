import { NextRequest, NextResponse } from "next/server";
import {
  likePost,
  unlikePost,
  hasUserLikedPost,
  getLikesForPost,
  getPostById,
  isUserRestricted,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

/**
 * GET  /api/posts/[id]/likes  — Get all likes for a post
 * POST /api/posts/[id]/likes  — Like a post (fans only)
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: postId } = await params;

    // Verify the post exists
    const post = await getPostById(postId);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const likes = await getLikesForPost(postId);
    const userLiked = await hasUserLikedPost(postId, user.userId);

    return NextResponse.json(
      { success: true, likes, userLiked },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching likes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (await isUserRestricted(user.userId)) {
      return NextResponse.json(
        { error: "Your account is view-only" },
        { status: 403 }
      );
    }

    const { id: postId } = await params;

    // Verify the post exists
    const post = await getPostById(postId);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Fans can only like - artist can also like others' posts (but there's only the artist)
    // We allow any authenticated user to like
    const result = await likePost(postId, user.userId);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Get the updated like status and count
    const userLiked = await hasUserLikedPost(postId, user.userId);
    return NextResponse.json(
      { success: true, liked: true, userLiked },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error liking post:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/posts/[id]/likes  — Unlike a post
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: postId } = await params;

    const result = await unlikePost(postId, user.userId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const userLiked = await hasUserLikedPost(postId, user.userId);
    return NextResponse.json(
      { success: true, liked: false, userLiked },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error unliking post:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
