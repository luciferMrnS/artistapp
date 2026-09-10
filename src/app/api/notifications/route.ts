import { NextResponse } from "next/server";
import { getNotifications } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

/**
 * GET /api/notifications
 * Fetch the current user's notifications (newest first)
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { notifications, unreadCount } = await getNotifications(user.userId);
    return NextResponse.json(
      { success: true, notifications, unreadCount },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}