import { NextRequest, NextResponse } from "next/server";
import {
  ensurePostImagesBucket,
  findUserById,
  uploadPostImage,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

/**
 * POST /api/posts/upload-image
 * Upload an image for a post — artist only.
 * Files go to the public "post-images" bucket; the permanent public
 * URL is returned so it can be attached when the post is created.
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

    if (fullUser.role !== "artist") {
      return NextResponse.json(
        { error: "Only the artist can upload post images" },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image must be under 10MB" },
        { status: 400 }
      );
    }

    await ensurePostImagesBucket();

    const { publicUrl, error } = await uploadPostImage(user.userId, file);
    if (error || !publicUrl) {
      return NextResponse.json(
        { error: error || "Upload failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, publicUrl }, { status: 201 });
  } catch (err) {
    console.error("Error uploading post image:", err);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}