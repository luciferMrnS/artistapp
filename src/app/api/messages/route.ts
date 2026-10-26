import { NextRequest, NextResponse } from "next/server";
import {
  createMessage,
  createMentionNotifications,
  getMessageById,
  getRecentMessages,
  findUserById,
  isUserRestricted,
  supabaseAdmin,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";
import { sendCreedPushToEveryone, sendInteractionPush } from "@/lib/push";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const messages = await getRecentMessages(100, user?.userId ?? null);
    return NextResponse.json({ success: true, messages }, { status: 200 });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (await isUserRestricted(user.userId)) {
      return NextResponse.json({ error: "You have limited access, try again later" }, { status: 403 });
    }
    const body = await req.json();
    const { content, messageType, mediaUrl, replyToId } = body;
    if (!content && !mediaUrl) return NextResponse.json({ error: "Message content or media is required" }, { status: 400 });
    const dbUser = await findUserById(user.userId);
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const username = dbUser.username;
    const result = await createMessage(
      user.userId,
      username,
      dbUser.avatar,
      content || "",
      messageType || "text",
      mediaUrl || null,
      typeof replyToId === "string" ? replyToId : null
    );
    if (typeof result === "object" && "error" in result) {
      console.error("Failed to create message:", result.error);
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Fire Creed unread pushes asynchronously — never block the sender.
    Promise.resolve()
      .then(() => sendCreedPushToEveryone({ exceptUserId: user.userId }))
      .catch((err) => console.error("Creed push failed:", err));

    // If the artist posts in Creed, notify all fans in-app
    Promise.resolve()
      .then(async () => {
        if (dbUser.role !== "artist") return;
        try {
          const { data: fans } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("role", "fan");

          if (!fans || fans.length === 0) return;
          const now = new Date().toISOString();
          const notifications = fans
            .filter((f: any) => f.id !== user.userId)
            .map((f: any) => ({
              id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${f.id}`,
              user_id: f.id,
              type: "post",
              actor_id: user.userId,
              post_id: null,
              read: false,
              created_at: now,
            }));

          if (notifications.length > 0) {
            await supabaseAdmin.from("notifications").insert(notifications);
          }
        } catch (err) {
          console.error("Failed to notify fans of artist Creed post:", err);
        }
      })
      .catch((err) => console.error("Artist creed post fan notification failed:", err));

    // @mentions / @all: notify the addressed users in-app (notifications
    // feed) and with targeted pushes. Best-effort and async — a missing
    // migration never blocks the sender.
    Promise.resolve()
      .then(async () => {
        const mentionedUserIds = await createMentionNotifications(
          user.userId,
          content || ""
        );
        for (const mentionedUserId of mentionedUserIds) {
          try {
            await sendInteractionPush({
              userId: mentionedUserId,
              title: `@${username} mentioned you in Creed`,
              body: (content || "").slice(0, 120),
              url: "/fan-club",
            });
          } catch (err) {
            console.error("Mention push failed:", err);
          }
        }
      })
      .catch((err) => console.error("Mention notifications failed:", err));

    // If this is a reply, notify the author of the original message —
    // "Your message was replied to" — unless they replied to themselves.
    if (typeof replyToId === "string" && replyToId) {
      Promise.resolve()
        .then(async () => {
          const repliedTo = await getMessageById(replyToId);
          if (!repliedTo || repliedTo.user_id === user.userId) return;
          await sendInteractionPush({
            userId: repliedTo.user_id,
            title: "Your message was replied to",
            body: `@${username} replied to your message in Creed`,
          });
        })
        .catch((err) => console.error("Reply push failed:", err));
    }

    return NextResponse.json({ success: true, message: result }, { status: 201 });
  } catch (error) {
    console.error("Error creating message:", error);
    return NextResponse.json({ error: "Failed to create message" }, { status: 500 });
  }
}
