import { NextRequest, NextResponse } from "next/server";
import { slugifyFeedId } from "@/lib/landing-feed";
import {
  createLandingItem,
  getLandingFeed,
  isLandingFeedReady,
  removeLandingPoster,
} from "@/lib/db";
import { isGuardError, parseItemBody, requireArtist } from "./_guard";

/**
 * GET /api/landing-feed
 * Artist-only. The editable feed, plus whether the database table exists so
 * the editor can say "run the migration" instead of showing an empty list.
 */
export async function GET() {
  try {
    const guard = await requireArtist();
    if (isGuardError(guard)) return guard;

    const [items, ready] = await Promise.all([
      getLandingFeed(),
      isLandingFeedReady(),
    ]);

    return NextResponse.json(
      { success: true, items, ready, source: ready ? "database" : "fallback" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching landing feed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Pick an id derived from the title that no row is already using, so two
 * videos called "Unholy" both stay addressable.
 */
function uniqueId(base: string, taken: Set<string>): string {
  const root = base.slice(0, 50);
  if (!taken.has(root)) return root;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${root}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${root}-${Date.now()}`;
}

/**
 * POST /api/landing-feed
 * Artist-only. Append an item. Upload the poster first via
 * /api/landing-feed/upload, then send the URL it returns.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireArtist();
    if (isGuardError(guard)) return guard;

    const parsed = parseItemBody(await req.json().catch(() => null), {
      requireId: false,
    });
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const existing = await getLandingFeed();
    const taken = new Set(existing.map((item) => item.id));
    const id = uniqueId(
      parsed.item.id && /^[a-z0-9][a-z0-9-]*$/.test(parsed.item.id)
        ? parsed.item.id
        : slugifyFeedId(parsed.item.title),
      taken
    );

    const result = await createLandingItem({ ...parsed.item, id });
    if ("error" in result) {
      // The poster is already in storage at this point; drop it so a rejected
      // item doesn't leave an orphan behind.
      if (parsed.item.posterPath) await removeLandingPoster(parsed.item.posterPath);
      return NextResponse.json(
        { error: result.error },
        { status: result.error.includes("not set up") ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, item: result }, { status: 201 });
  } catch (error) {
    console.error("Error creating landing feed item:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
