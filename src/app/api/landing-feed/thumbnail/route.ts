import { NextRequest, NextResponse } from "next/server";
import { ensureLandingMediaBucket, readImageSize, uploadLandingPoster } from "@/lib/db";
import { isGuardError, requireArtist } from "../_guard";

/** In preference order — a video may only have a low-res thumbnail. */
const YOUTUBE_SIZES = ["maxresdefault", "sddefault", "hqdefault"] as const;

const YOUTUBE_ID = /^[A-Za-z0-9_-]{4,32}$/;

/**
 * POST /api/landing-feed/thumbnail
 * Artist-only. `{ provider, providerId }` → the poster for that video, stored
 * in the landing bucket like a manual upload.
 *
 * The fetch happens here rather than in the browser so the feed points at
 * this project's own storage rather than a third-party image host, and so the
 * artist is not told to save and re-upload a screenshot.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireArtist();
    if (isGuardError(guard)) return guard;

    const body = (await req.json().catch(() => null)) as {
      provider?: string;
      providerId?: string;
      id?: string;
    } | null;

    const providerId = body?.providerId?.trim() ?? "";

    if (body?.provider === "vimeo") {
      return NextResponse.json(
        {
          error:
            "Vimeo has no public thumbnail endpoint — upload a poster image for this one",
        },
        { status: 400 }
      );
    }
    if (body?.provider !== "youtube" || !YOUTUBE_ID.test(providerId)) {
      return NextResponse.json(
        { error: "That does not look like a YouTube video id" },
        { status: 400 }
      );
    }

    let picked:
      | { bytes: ArrayBuffer; contentType: string; width: number; height: number }
      | null = null;
    for (const size of YOUTUBE_SIZES) {
      const response = await fetch(
        `https://i.ytimg.com/vi/${providerId}/${size}.jpg`,
        { cache: "no-store" }
      ).catch(() => null);

      if (!response?.ok) continue;

      const bytes = await response.arrayBuffer();
      const dimensions = readImageSize(bytes);
      if (!dimensions) continue;
      // maxresdefault answers 404 for older videos, and hqdefault can be the
      // 120x90 grey placeholder — too small to be a poster.
      if (dimensions.width < 480 || dimensions.height < 270) continue;

      picked = {
        bytes,
        contentType: response.headers.get("content-type") ?? "image/jpeg",
        width: dimensions.width,
        height: dimensions.height,
      };
      break;
    }

    if (!picked) {
      return NextResponse.json(
        {
          error:
            "No usable thumbnail for that video — upload a poster image instead",
        },
        { status: 404 }
      );
    }

    await ensureLandingMediaBucket();

    const { publicUrl, storagePath, error } = await uploadLandingPoster(
      `${body?.id?.trim() || providerId}_yt_${Date.now()}.jpg`,
      picked.bytes,
      picked.contentType
    );

    if (error || !publicUrl || !storagePath) {
      return NextResponse.json(
        { error: error || "Failed to store the thumbnail" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        publicUrl,
        storagePath,
        width: picked.width,
        height: picked.height,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching landing thumbnail:", error);
    return NextResponse.json(
      { error: "Failed to fetch the thumbnail" },
      { status: 500 }
    );
  }
}
