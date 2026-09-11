import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { findUserById, deleteAnnouncement } from "@/lib/db";

/**
 * DELETE /api/announcements/:id
 * Artist-only. Remove an announcement so it stops showing.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
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
        { error: "Only the artist can delete announcements" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const result = await deleteAnnouncement(id);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Failed to delete announcement" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting announcement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}