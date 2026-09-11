import { NextRequest, NextResponse } from "next/server";
import {
  createMessage,
  getMessageById,
  getRecentMessages,
  findUserById,
  isUserRestricted,
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
