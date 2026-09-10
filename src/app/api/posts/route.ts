import { NextRequest, NextResponse } from "next/server";
import { getAllPosts } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

/**
 * GET /api/posts
 * Fetch all posts (public — any authenticated user can read)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const posts = await getAllPosts();
    return NextResponse.json({ success: true, posts }, { status: 200 });
  } catch (error) {
    console.error("Error fetching posts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
