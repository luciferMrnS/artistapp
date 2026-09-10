import { NextRequest, NextResponse } from "next/server";
import { ensureAvatarsBucket, uploadAvatar } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

/**
 * POST /api/profile/upload-avatar
 * Upload a profile picture — any authenticated user (artist or fan).
 * Files go to the public "avatars" bucket; the permanent public URL is
 * returned so it can be saved to the profile via PATCH /api/profile.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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

    await ensureAvatarsBucket();

    const { publicUrl, error } = await uploadAvatar(user.userId, file);
    if (error || !publicUrl) {
      return NextResponse.json(
        { error: error || "Upload failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, publicUrl }, { status: 201 });
  } catch (err) {
    console.error("Error uploading avatar:", err);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}