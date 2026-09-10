import { NextRequest, NextResponse } from "next/server";
import {
  getCommentsForPost,
  createComment,
  deleteComment,
  getPostById,
  isUserRestricted,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

/**
 * GET  /api/posts/[id]/comments  — Get all comments for a post
 * POST /api/posts/[id]/comments  — Add a comment to a post
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

    const post = await getPostById(postId);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const comments = await getCommentsForPost(postId);
    return NextResponse.json(
      { success: true, comments },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching comments:", error);
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
        { error: "You have limited access, try again later" },
        { status: 403 }
      );
    }

    const { id: postId } = await params;

    const post = await getPostById(postId);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const body = await req.json();
    const { content } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Comment content is required" },
        { status: 400 }
      );
    }

    const comment = await createComment(
      postId,
      user.userId,
      content.trim()
    );

    if ("error" in comment) {
      return NextResponse.json({ error: comment.error }, { status: 400 });
    }

    return NextResponse.json(
      { success: true, comment },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/posts/[id]/comments/[commentId]
 * Delete a comment — only the comment author
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { commentId } = body;

    if (!commentId) {
      return NextResponse.json(
        { error: "commentId is required" },
        { status: 400 }
      );
    }

    const result = await deleteComment(commentId, user.userId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      { success: true },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting comment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
