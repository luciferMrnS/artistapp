import { NextRequest, NextResponse } from "next/server";
import {
  ensureThemeMediaBucket,
  findUserById,
  getThemeMedia,
  uploadThemeMedia,
  type MediaType,
  type ThemeSlug,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

const THEMES: ThemeSlug[] = ["new-drop", "behind-the-scenes", "studio"];
const MEDIA_TYPES: MediaType[] = ["audio", "video", "photo"];

const SIZE_LIMITS: Record<MediaType, number> = {
  photo: 10 * 1024 * 1024,
  audio: 30 * 1024 * 1024,
  video: 100 * 1024 * 1024,
};

function typeForMime(mime: string): MediaType | null {
  if (mime.startsWith("image/")) return "photo";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return null;
}

function matchesType(mediaType: MediaType, mime: string): boolean {
  if (mediaType === "photo") return mime.startsWith("image/");
  if (mediaType === "audio") return mime.startsWith("audio/");
  return mime.startsWith("video/");
}

/**
 * GET /api/theme-media?theme=new-drop
 * List themed media (public read for authenticated users)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const theme = req.nextUrl.searchParams.get("theme") as ThemeSlug | null;
    if (!theme || !THEMES.includes(theme)) {
      return NextResponse.json(
        { error: "Invalid theme" },
        { status: 400 }
      );
    }

    const items = await getThemeMedia(theme);
    return NextResponse.json({ success: true, items }, { status: 200 });
  } catch (error) {
    console.error("Error fetching theme media:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/theme-media
 * Artist-only upload: FormData with theme, mediaType, title,
 * caption, and the file. Media lands in public "theme-media".
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
        { error: "Only the artist can upload media" },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const theme = formData.get("theme") as string | null;
    const mediaType = formData.get("mediaType") as string | null;
    const title = ((formData.get("title") as string) ?? "").trim();
    const caption = ((formData.get("caption") as string) ?? "").trim();
    const file = formData.get("file") as File | null;

    if (!THEMES.includes(theme as ThemeSlug)) {
      return NextResponse.json({ error: "Invalid theme" }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const detected = typeForMime(file.type);
    const resolvedType = (
      MEDIA_TYPES.includes(mediaType as MediaType) ? mediaType : detected
    ) as MediaType | null;

    if (!resolvedType) {
      return NextResponse.json(
        { error: "File must be an image, audio, or video" },
        { status: 400 }
      );
    }
    if (!matchesType(resolvedType, file.type)) {
      return NextResponse.json(
        { error: `File type does not match ${resolvedType}` },
        { status: 400 }
      );
    }
    if (file.size > SIZE_LIMITS[resolvedType]) {
      const mb = Math.round(SIZE_LIMITS[resolvedType] / (1024 * 1024));
      return NextResponse.json(
        { error: `${resolvedType[0].toUpperCase()}${resolvedType.slice(1)} must be under ${mb}MB` },
        { status: 400 }
      );
    }

    await ensureThemeMediaBucket();

    const { item, error } = await uploadThemeMedia({
      theme: theme as ThemeSlug,
      mediaType: resolvedType,
      title,
      caption,
      file,
    });

    if (error || !item) {
      return NextResponse.json(
        { error: error || "Upload failed" },
        { status: error === "Theme media is not set up yet" ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (err) {
    console.error("Error uploading theme media:", err);
    return NextResponse.json(
      { error: "Failed to upload media" },
      { status: 500 }
    );
  }
}