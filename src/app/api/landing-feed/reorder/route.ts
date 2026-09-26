import { NextRequest, NextResponse } from "next/server";
import { reorderLandingFeed } from "@/lib/db";
import { isGuardError, requireArtist } from "../_guard";

/**
 * POST /api/landing-feed/reorder
 * Artist-only. `{ ids: [...] }` — the complete feed order, top to bottom.
 *
 * Ids missing from the list keep their relative order at the end rather than
 * being dropped, so a stale tab can't quietly delete items by reordering.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireArtist();
    if (isGuardError(guard)) return guard;

    const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
    if (!Array.isArray(body?.ids)) {
      return NextResponse.json({ error: "ids must be an array" }, { status: 400 });
    }

    const ids = body.ids.filter((id): id is string => typeof id === "string");
    if (ids.length > 500) {
      return NextResponse.json({ error: "Feed is too long" }, { status: 400 });
    }

    const result = await reorderLandingFeed(ids);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Failed to reorder the feed" },
        { status: result.error?.includes("not set up") ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error reordering landing feed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
