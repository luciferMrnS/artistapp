import { NextRequest, NextResponse } from "next/server";
import { deleteTrack, findUserById, getTrackById } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

/**
 * DELETE /api/tracks/[id]
 * Delete a track (artist only). Removes the audio + cover files
 * from the private bucket and the DB row (streams cascade).
 */
export async function DELETE(
  req: NextRequest,
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
        { error: "Only the artist can delete tracks" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const track = await getTrackById(id);

    if (!track) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    // Belt and suspenders: only the artist's own uploads can be deleted
    if (track.artist_id !== user.userId) {
      return NextResponse.json(
        { error: "Only the artist can delete this track" },
        { status: 403 }
      );
    }

    const result = await deleteTrack(id);

    if (!result.success) {
      const status = result.error === "Track not found" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting track:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}