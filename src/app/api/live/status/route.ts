import { NextResponse } from "next/server";
import { getLiveStatus } from "@/lib/live";

export const dynamic = "force-dynamic";

/**
 * GET /api/live/status
 * Public live-status probe for the Live Now page.
 */
export async function GET() {
  const status = await getLiveStatus();
  return NextResponse.json(status);
}