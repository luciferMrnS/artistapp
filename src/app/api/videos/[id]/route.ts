import { NextRequest, NextResponse } from "next/server";
import { deleteVideo, findUserById } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

/**
 * DELETE /api/videos/[id]
 * Artist-only. Removes the row and any stored files.
 */
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
        { error: "Only the artist can delete videos" },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const { success, error } = await deleteVideo(id);

    if (!success) {
      return NextResponse.json(
        { error: error || "Failed to delete video" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Error deleting video:", err);
    return NextResponse.json(
      { error: "Failed to delete video" },
      { status: 500 }
    );
  }
}