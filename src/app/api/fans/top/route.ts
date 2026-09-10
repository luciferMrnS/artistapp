import { NextResponse } from "next/server";
import { getTopFans } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/fans/top
 * Leaderboard of the top three fans ranked by activity volume (likes,
 * comments, creed chats, online hours). Fans only — the artist is never
 * ranked. Public — no auth needed, so the podium shows for everyone.
 * Returns an empty list while the involved tables haven't been migrated.
 */
export async function GET() {
  const top = await getTopFans(3);
  return NextResponse.json({ top });
}