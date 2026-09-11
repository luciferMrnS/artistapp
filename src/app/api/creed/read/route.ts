import { NextResponse } from "next/server";
import { markCreedReadServer } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

/**
 * POST /api/creed/read
 * Fired when the user opens the Creed chat — resets the server-side
 * "unread creed" baseline so push totals are accurate.
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    await markCreedReadServer(user.userId);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error marking creed read:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}