import { NextResponse } from "next/server";
import { touchPresence } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/presence
 * Presence heartbeat. Fired by the browser every ~20s while the tab is
 * visible. Keeps this user inside the "fans online" window.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const recorded = await touchPresence(user.userId);
  // Fire even when the migration hasn't been applied yet — the client
  // treats the request as a heartbeat either way, and the count stays 0.
  return NextResponse.json({ success: true, recorded });
}