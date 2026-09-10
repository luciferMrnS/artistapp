import { NextRequest, NextResponse } from "next/server";
import { createMessage, getRecentMessages, findUserById } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

export async function GET() {
  try {
    const messages = await getRecentMessages(100);
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
    const body = await req.json();
    const { content, messageType, mediaUrl } = body;
    if (!content && !mediaUrl) return NextResponse.json({ error: "Message content or media is required" }, { status: 400 });
    const dbUser = await findUserById(user.userId);
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const username = dbUser.username;
    const result = await createMessage(user.userId, username, dbUser.avatar, content || "", messageType || "text", mediaUrl || null);
    if (typeof result === "object" && "error" in result) {
      console.error("Failed to create message:", result.error);
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: result }, { status: 201 });
  } catch (error) {
    console.error("Error creating message:", error);
    return NextResponse.json({ error: "Failed to create message" }, { status: 500 });
  }
}
