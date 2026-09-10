import { NextResponse } from "next/server";
import { getUsersForDirectMessage } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

/**
 * GET /api/dm/users
 * Users available to start a new conversation (excludes current user)
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const users = await getUsersForDirectMessage(user.userId);
    return NextResponse.json({ success: true, users }, { status: 200 });
  } catch (error) {
    console.error("Error fetching DM users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}