import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { findUserById } from "@/lib/db";
import { sendHardAlertToEveryone, MAX_ALERT_LENGTH } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * POST /api/alerts/send
 * Artist-only: blast a hard alert to every installed device. The message is
 * delivered in full inside the notification body — fans don't need to open
 * the app to read it.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const fullUser = await findUserById(user.userId);
  if (!fullUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (fullUser.role !== "artist") {
    return NextResponse.json(
      { error: "Only the artist can send hard alerts" },
      { status: 403 }
    );
  }

  let title: unknown;
  let message: unknown;
  let url: unknown;
  try {
    const body = await request.json();
    title = body?.title;
    message = body?.message;
    url = body?.url;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof title !== "string" || title.trim() === "") {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (typeof message !== "string" || message.trim() === "") {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  if (title.trim().length > 120) {
    return NextResponse.json(
      { error: "Title must be 120 characters or fewer" },
      { status: 400 }
    );
  }
  if (message.trim().length > MAX_ALERT_LENGTH) {
    return NextResponse.json(
      { error: `Message must be ${MAX_ALERT_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }

  const safeUrl = typeof url === "string" && url.startsWith("/") ? url : "/";

  const { devices, sent, failed } = await sendHardAlertToEveryone({
    title: title.trim(),
    message: message.trim(),
    url: safeUrl,
    exceptUserId: user.userId,
  });

  return NextResponse.json({ success: true, devices, sent, failed });
}