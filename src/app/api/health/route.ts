import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 * Lightweight health-check endpoint used by Render's healthCheckPath
 * and the GitHub Actions keep-alive cron. Returns instantly with no
 * database calls so the server stays awake with minimal overhead.
 */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
