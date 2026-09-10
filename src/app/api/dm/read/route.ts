import { NextRequest, NextResponse } from "next/server";
import { markConversationRead } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

/**
 * POST /api/dm/read
 * Body: { conversationId }
 * Marks the user's messages in the conversation as read
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let body: { conversationId?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    if (typeof body.conversationId !== "string" || !body.conversationId) {
      return NextResponse.json(
        { error: "conversationId is required" },
        { status: 400 }
      );
    }

    const { success } = await markConversationRead(user.userId, body.conversationId);
    if (!success) {
      return NextResponse.json(
        { error: "Failed to update conversation" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error marking conversation read:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}