import { NextRequest, NextResponse } from "next/server";
import { uploadCommunityImage, isUserRestricted } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (await isUserRestricted(user.userId)) {
      return NextResponse.json({ error: "You have limited access, try again later" }, { status: 403 });
    }
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Image must be under 10MB" }, { status: 400 });
const { path, error } = await uploadCommunityImage(user.userId, file);
    if (error || !path) return NextResponse.json({ error: error || "Upload failed" }, { status: 400 });
    // Store our own permanent proxy URL instead of an expiring sign URL.
    const url = `/api/community-media?p=${encodeURIComponent(path)}`;
    return NextResponse.json({ success: true, url }, { status: 201 });
  } catch (err) {
    console.error("Error uploading image:", err);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}
