import { NextResponse } from "next/server";
import { markAllMessagesRead } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

/**
 * POST /api/dm/read-all
 * Marks every incoming DM as read for the current user. Fired when the
 * user opens their inbox so the sidebar badge clears.
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { success } = await markAllMessagesRead(user.userId);
    if (!success) {
      return NextResponse.json(
        { error: "Failed to update conversations" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error marking all DMs read:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}