import { NextRequest, NextResponse } from "next/server";
import { createPost, findUserById } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

/**
 * POST /api/posts/create
 * Create a post — artist only
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Fetch the full user record to check role
    const fullUser = await findUserById(user.userId);
    if (!fullUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Enforce: only the artist can create posts
    if (fullUser.role !== "artist") {
      return NextResponse.json(
        { error: "Only the artist can create posts" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { content, image } = body;

    const trimmedContent = (content ?? "").toString().trim();

    if (!trimmedContent && !image) {
      return NextResponse.json(
        { error: "Post content or an image is required" },
        { status: 400 }
      );
    }

    const post = await createPost(user.userId, trimmedContent, image || null);

    if ("error" in post) {
      return NextResponse.json({ error: post.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, post }, { status: 201 });
  } catch (error) {
    console.error("Error creating post:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
