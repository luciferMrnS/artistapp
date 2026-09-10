import { NextResponse } from "next/server";
import { getConversations } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

/**
 * GET /api/dm/conversations
 * List the current user's direct-message conversations
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const conversations = await getConversations(user.userId);
    return NextResponse.json({ success: true, conversations }, { status: 200 });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}