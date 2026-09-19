import { NextRequest, NextResponse } from "next/server";
import {
  getMessageById,
  getMessageReactionsFor,
  resolveCommunityMediaUrl,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

/**
 * GET /api/messages/[id]
 * Fetch a single Creed (community chat) message. Used to jump back to a
 * message that was replied to but is outside the loaded recent window.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id } = await params;

    const message = await getMessageById(id);
    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const reactions = await getMessageReactionsFor([id], user?.userId ?? null);

    return NextResponse.json(
      {
        success: true,
        message: {
          ...message,
          media_url: resolveCommunityMediaUrl(message.media_url),
          reactions: reactions[id] ?? [],
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching message:", error);
    return NextResponse.json(
      { error: "Failed to fetch message" },
      { status: 500 }
    );
  }
}