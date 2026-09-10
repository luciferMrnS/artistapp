import { NextRequest, NextResponse } from "next/server";
import { recordStream } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

/**
 * POST /api/tracks/[id]/stream
 * Record that the authenticated user started streaming a track.
 * Streams power the "Monthly listeners" stat (distinct users in
 * the last 30 days).
 */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await ctx.params;

    const result = await recordStream(id, user.userId);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Failed to record stream" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error recording stream:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}