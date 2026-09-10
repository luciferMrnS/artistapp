import { NextRequest, NextResponse } from "next/server";
import { countFansOnline, listFansOnline } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/fans/online
 * Live count of fans whose presence heartbeat is still fresh.
 * GET /api/fans/online?list=1  → also returns the actual online fans.
 * Returns 0 / [] (rather than erroring) while migration_fans_online.sql
 * hasn't been applied yet.
 */
export async function GET(request: NextRequest) {
  const showList = new URL(request.url).searchParams.get("list") === "1";

  if (showList) {
    const fans = await listFansOnline();
    return NextResponse.json({ count: fans.length, fans });
  }

  const count = await countFansOnline();
  return NextResponse.json({ count });
}