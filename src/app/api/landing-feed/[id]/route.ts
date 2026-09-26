import { NextRequest, NextResponse } from "next/server";
import { deleteLandingItem, updateLandingItem, type LandingItemPatch } from "@/lib/db";
import { isGuardError, isValidFeedId, parseItemBody, requireArtist } from "../_guard";

/**
 * PATCH /api/landing-feed/:id
 * Artist-only. Edit one item in place. The id is fixed — renaming a title does
 * not move a row, so posters already uploaded for it stay attached.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireArtist();
    if (isGuardError(guard)) return guard;

    const { id } = await params;
    if (!isValidFeedId(id)) {
      return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
    }

    const parsed = parseItemBody(await req.json().catch(() => null), {
      requireId: true,
    });
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    // Ids are immutable, and the patch is exactly one item's editable fields.
    const patch: LandingItemPatch = { ...parsed.item };
    delete (patch as { id?: string }).id;

    const result = await updateLandingItem(id, patch);
    if ("error" in result) {
      const status = result.error === "Item not found"
        ? 404
        : result.error.includes("not set up")
          ? 503
          : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ success: true, item: result }, { status: 200 });
  } catch (error) {
    console.error("Error updating landing feed item:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/landing-feed/:id
 * Artist-only. Remove an item. Its uploaded poster goes with it; seeded items
 * point at files in /public and leave those alone.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireArtist();
    if (isGuardError(guard)) return guard;

    const { id } = await params;
    if (!isValidFeedId(id)) {
      return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
    }

    const result = await deleteLandingItem(id);
    if (!result.success) {
      const status = result.error === "Item not found"
        ? 404
        : result.error?.includes("not set up")
          ? 503
          : 500;
      return NextResponse.json(
        { error: result.error ?? "Failed to delete the item" },
        { status }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting landing feed item:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
