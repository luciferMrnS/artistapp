import { NextRequest, NextResponse } from "next/server";
import { getDirectMessages, sendDirectMessage, isUserRestricted } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";
import { sendUnreadPush } from "@/lib/push";

/**
 * GET /api/dm/messages?conversation_id=...
 * Fetch messages in a conversation the user is part of
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const conversationId = req.nextUrl.searchParams.get("conversation_id");
    if (!conversationId) {
      return NextResponse.json(
        { error: "conversation_id is required" },
        { status: 400 }
      );
    }

    const messages = await getDirectMessages(conversationId, user.userId);
    return NextResponse.json({ success: true, messages }, { status: 200 });
  } catch (error) {
    console.error("Error fetching DMs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dm/messages
 * Body: { recipientId, content, mediaUrl? }
 * Sends a DM (creates the conversation implicitly)
 */
export async function POST(req: NextRequest) {
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

    let body: { recipientId?: unknown; content?: unknown; mediaUrl?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const recipientId = body.recipientId;
    if (typeof recipientId !== "string" || !recipientId) {
      return NextResponse.json(
        { error: "recipientId is required" },
        { status: 400 }
      );
    }
    const content = typeof body.content === "string" ? body.content : "";
    const mediaUrl = typeof body.mediaUrl === "string" ? body.mediaUrl : null;

    const result = await sendDirectMessage(
      user.userId,
      recipientId,
      content,
      mediaUrl
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === "Direct messages are not set up yet" ? 503 : 400 }
      );
    }

    // DM unread push to the recipient — asynchronous, never blocks the sender.
    Promise.resolve()
      .then(() =>
        sendUnreadPush({
          trigger: "dm",
          url: "/messages",
          userId: recipientId,
        })
      )
      .catch((err) => console.error("DM push failed:", err));

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        conversationId: result.conversationId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error sending DM:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}