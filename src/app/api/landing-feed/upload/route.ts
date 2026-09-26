import { NextRequest, NextResponse } from "next/server";
import {
  ensureLandingMediaBucket,
  readImageSize,
  uploadLandingPoster,
} from "@/lib/db";
import { isGuardError, isValidFeedId, requireArtist } from "../_guard";

const MAX_BYTES = 8 * 1024 * 1024;

/** Only formats the size reader understands exactly, so cards always get a
 *  real aspect ratio. Also keeps SVG (which can carry script) off the page. */
const ACCEPTED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};

/**
 * POST /api/landing-feed/upload
 * Artist-only. FormData with `file` and an optional `id` (the feed item the
 * poster belongs to, so the object name is traceable back to a row).
 *
 * Returns the public URL, the storage path to save on the row, and the image's
 * real dimensions — the caller does not get to choose them.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireArtist();
    if (isGuardError(guard)) return guard;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const rawId = (formData.get("id") as string | null)?.trim() ?? "";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (rawId && !isValidFeedId(rawId)) {
      return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
    }

    const extension = ACCEPTED[file.type];
    if (!extension) {
      return NextResponse.json(
        { error: "Poster must be a JPEG or PNG image" },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Poster must be under 8MB" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const size = readImageSize(bytes);
    if (!size) {
      return NextResponse.json(
        { error: "That file could not be read as a JPEG or PNG" },
        { status: 400 }
      );
    }

    await ensureLandingMediaBucket();

    // The timestamp means replacing a poster writes a fresh object rather than
    // overwriting a URL another row may still be pointing at.
    const objectName = `${rawId || "new"}_${Date.now()}.${extension}`;

    const { publicUrl, storagePath, error } = await uploadLandingPoster(
      objectName,
      bytes,
      file.type
    );

    if (error || !publicUrl || !storagePath) {
      return NextResponse.json(
        { error: error || "Upload failed" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, publicUrl, storagePath, width: size.width, height: size.height },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error uploading landing poster:", error);
    return NextResponse.json(
      { error: "Failed to upload the image" },
      { status: 500 }
    );
  }
}
