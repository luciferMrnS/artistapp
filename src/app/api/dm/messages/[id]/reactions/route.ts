import { NextRequest, NextResponse } from "next/server";
import {
  addDirectMessageReaction,
  removeDirectMessageReaction,
  getDirectMessageReactionsFor,
  getDirectMessageById,
  findUserById,
  type MessageReaction,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";
import { sendInteractionPush } from "@/lib/push";

/**
 * POST /api/dm/messages/[id]/reactions
 * Toggle the current user's emoji reaction on a DM they can see.
 * Body: { emoji: string }
 * Returns the updated reaction summary for the message.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: messageId } = await params;

    const body = await req.json();
    const emoji = typeof body?.emoji === "string" ? body.emoji.trim() : "";
    if (!emoji || [...emoji].length > 8) {
      return NextResponse.json({ error: "A valid emoji is required" }, { status: 400 });
    }

    // Only participants of the conversation may react.
    const target = await getDirectMessageById(messageId);
    if (!target) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    if (target.sender_id !== user.userId && target.recipient_id !== user.userId) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const summary = await getDirectMessageReactionsFor([messageId], user.userId);
    const alreadyReacted = summary[messageId]?.some(
      (r) => r.emoji === emoji && r.me
    );

    const adding = !alreadyReacted;

    const updated: MessageReaction[] | { error: string } = alreadyReacted
      ? await removeDirectMessageReaction(messageId, user.userId, emoji)
      : await addDirectMessageReaction(messageId, user.userId, emoji);

    if ("error" in updated) {
      return NextResponse.json({ error: updated.error }, { status: 400 });
    }

    // Notify the message author — "Your message got a reaction {emoji}" —
    // only when a reaction is added (not removed) and not on their own message.
    if (adding && target.sender_id !== user.userId) {
      Promise.resolve()
        .then(async () => {
          const actor = await findUserById(user.userId);
          await sendInteractionPush({
            userId: target.sender_id,
            title: `Your message got a reaction ${emoji}`,
            body: `@${actor?.username ?? "Someone"} reacted to your message in DMs`,
            url: "/messages",
          });
        })
        .catch((err) => console.error("DM reaction push failed:", err));
    }

    return NextResponse.json({ success: true, reactions: updated }, { status: 200 });
  } catch (error) {
    console.error("DM reaction toggle error:", error);
    return NextResponse.json({ error: "Failed to update reaction" }, { status: 500 });
  }
}