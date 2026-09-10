import { NextRequest, NextResponse } from "next/server";
import { markNotificationsRead } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

/**
 * POST /api/notifications/read
 * Mark a single notification ({ id }) or all notifications as read
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let id: string | undefined;
    try {
      const body = await req.json();
      if (typeof body?.id === "string") id = body.id;
    } catch {
      // No body — mark all as read
    }

    const { success } = await markNotificationsRead(user.userId, id);
    if (!success) {
      return NextResponse.json(
        { error: "Failed to update notifications" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error marking notifications read:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}