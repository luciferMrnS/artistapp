import { NextRequest, NextResponse } from "next/server";
import {
  ensureThemeMediaBucket,
  findUserById,
  getVideos,
  createVideoFromUpload,
  createVideoFromLink,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match ? match[1] : null;
}

interface ResolvedEmbed {
  embedUrl: string;
  thumbnail: string;
}

function resolveEmbed(linkUrl: string, thumbnailUrl: string): ResolvedEmbed | null {
  const youTubeId = extractYouTubeId(linkUrl);
  if (youTubeId) {
    return {
      embedUrl: `https://www.youtube.com/embed/${youTubeId}?autoplay=1`,
      thumbnail: thumbnailUrl || `https://i.ytimg.com/vi/${youTubeId}/hqdefault.jpg`,
    };
  }

  const vimeoId = extractVimeoId(linkUrl);
  if (vimeoId) {
    return {
      embedUrl: `https://player.vimeo.com/video/${vimeoId}?autoplay=1`,
      thumbnail: thumbnailUrl,
    };
  }

  return null;
}

/**
 * GET /api/videos
 * List all videos (authenticated read).
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const items = await getVideos();
    return NextResponse.json({ success: true, items }, { status: 200 });
  } catch (error) {
    console.error("Error fetching videos:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/videos
 * Artist-only. Two modes via FormData:
 *  - source=upload: file (video) + optional thumbnail (image)
 *  - source=link:   link (YouTube/Vimeo) + optional thumbnailUrl
 * Both require title + caption.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const fullUser = await findUserById(user.userId);
    if (!fullUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (fullUser.role !== "artist") {
      return NextResponse.json(
        { error: "Only the artist can upload videos" },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const source = formData.get("source") as string | null;
    const title = ((formData.get("title") as string) ?? "").trim();
    const caption = ((formData.get("caption") as string) ?? "").trim();

    if (source !== "upload" && source !== "link") {
      return NextResponse.json({ error: "Invalid source" }, { status: 400 });
    }
    if (title.length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (source === "upload") {
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No video file provided" }, { status: 400 });
      }
      if (!file.type.startsWith("video/")) {
        return NextResponse.json(
          { error: "File must be a video" },
          { status: 400 }
        );
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: "Video must be under 100MB" },
          { status: 400 }
        );
      }

      await ensureThemeMediaBucket();

      const thumbnail = formData.get("thumbnail") as File | null;
      if (thumbnail && !thumbnail.type.startsWith("image/")) {
        return NextResponse.json(
          { error: "Thumbnail must be an image" },
          { status: 400 }
        );
      }

      const { item, error } = await createVideoFromUpload({ title, caption, file, thumbnail });
      if (error || !item) {
        return NextResponse.json(
          { error: error || "Upload failed" },
          { status: error === "Videos are not set up yet" ? 503 : 400 }
        );
      }
      return NextResponse.json({ success: true, item }, { status: 201 });
    }

    // source === "link"
    const link = ((formData.get("link") as string) ?? "").trim();
    const thumbnailUrl = ((formData.get("thumbnailUrl") as string) ?? "").trim();

    if (!isUrl(link)) {
      return NextResponse.json(
        { error: "A valid link is required" },
        { status: 400 }
      );
    }
    if (thumbnailUrl && !isUrl(thumbnailUrl)) {
      return NextResponse.json(
        { error: "Thumbnail must be a valid URL" },
        { status: 400 }
      );
    }

    const resolved = resolveEmbed(link, thumbnailUrl);
    if (!resolved) {
      return NextResponse.json(
        { error: "Only YouTube and Vimeo links are supported" },
        { status: 400 }
      );
    }

    const { item, error } = await createVideoFromLink({
      title,
      caption,
      linkUrl: link,
      embedUrl: resolved.embedUrl,
      thumbnail: resolved.thumbnail,
    });
    if (error || !item) {
      return NextResponse.json(
        { error: error || "Could not save the video" },
        { status: error === "Videos are not set up yet" ? 503 : 400 }
      );
    }
    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (err) {
    console.error("Error creating video:", err);
    return NextResponse.json(
      { error: "Failed to add video" },
      { status: 500 }
    );
  }
}