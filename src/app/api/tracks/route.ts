import { NextRequest, NextResponse } from "next/server";
import {
  createTrack,
  findUserById,
  getTracksWithSignedUrls,
  removeTrackFile,
  uploadTrackFile,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

const MAX_AUDIO_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_COVER_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * GET /api/tracks
 * List all tracks with short-lived signed streaming URLs
 */
export async function GET() {
  try {
    const tracks = await getTracksWithSignedUrls();
    return NextResponse.json({ success: true, tracks });
  } catch (error) {
    console.error("Error listing tracks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tracks
 * Upload a track (multipart form-data: title + file + optional cover) —
 * artist only. The audio goes to the private "tracks" storage bucket; it
 * can only be streamed via short-lived signed URLs, never downloaded
 * directly.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Fetch the full user record to check role
    const fullUser = await findUserById(user.userId);
    if (!fullUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Enforce: only the artist can upload tracks
    if (fullUser.role !== "artist") {
      return NextResponse.json(
        { error: "Only the artist can upload tracks" },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const title = String(formData.get("title") ?? "").trim();
    const file = formData.get("file");
    const cover = formData.get("cover");

    if (!title) {
      return NextResponse.json({ error: "Track title is required" }, { status: 400 });
    }

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
    }

    // Only accept real audio uploads
    if (!file.type.startsWith("audio/")) {
      return NextResponse.json(
        { error: "File must be an audio file (mp3, wav, ogg, m4a...)" },
        { status: 400 }
      );
    }

    if (file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "Audio file is too large (max 50 MB)" },
        { status: 400 }
      );
    }

    // Optional album cover: must be an image under 5 MB
    let coverPath: string | null = null;
    if (cover && cover instanceof File && cover.size > 0) {
      if (!cover.type.startsWith("image/")) {
        return NextResponse.json(
          { error: "Album cover must be an image (jpg, png, webp...)" },
          { status: 400 }
        );
      }
      if (cover.size > MAX_COVER_BYTES) {
        return NextResponse.json(
          { error: "Album cover is too large (max 5 MB)" },
          { status: 400 }
        );
      }
      const coverSafeName = cover.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      coverPath = `${user.userId}/covers/${Date.now()}_${coverSafeName}`;
    }

    // Sanitize the filename so it's safe as a storage path
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${user.userId}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await uploadTrackFile(
      storagePath,
      Buffer.from(await file.arrayBuffer()),
      file.type
    );

    if (uploadError) {
      console.error("Error uploading audio:", uploadError);
      return NextResponse.json(
        { error: uploadError.message || "Failed to upload audio" },
        { status: 500 }
      );
    }

    // Optional album cover — same private bucket, separate path
    if (coverPath) {
      const { error: coverUploadError } = await uploadTrackFile(
        coverPath,
        Buffer.from(await (cover as File).arrayBuffer()),
        (cover as File).type
      );

      if (coverUploadError) {
        console.error("Error uploading cover:", coverUploadError);
        await removeTrackFile(storagePath); // don't leave an orphaned audio
        return NextResponse.json(
          { error: coverUploadError.message || "Failed to upload album cover" },
          { status: 500 }
        );
      }
    }

    const track = await createTrack(user.userId, title, storagePath, coverPath);

    if ("error" in track) {
      // Clean up the orphaned uploads if the DB insert failed
      await removeTrackFile(storagePath);
      if (coverPath) await removeTrackFile(coverPath);

      // Pre-migration: the cover_path column doesn't exist yet
      if (coverPath && /cover_path/.test(track.error)) {
        return NextResponse.json(
          { error: "Album cover support is not set up yet." },
          { status: 400 }
        );
      }

      return NextResponse.json({ error: track.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, track }, { status: 201 });
  } catch (error) {
    console.error("Error creating track:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}