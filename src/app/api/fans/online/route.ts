import { NextResponse } from "next/server";
import { countFansOnline } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/fans/online
 * Live count of fans whose presence heartbeat is still fresh.
 * Returns 0 (rather than erroring) while migration_fans_online.sql
 * hasn't been applied yet.
 */
export async function GET() {
  const count = await countFansOnline();
  return NextResponse.json({ count });
}