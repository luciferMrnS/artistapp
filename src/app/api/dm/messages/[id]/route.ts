import { NextRequest, NextResponse } from "next/server";
import {
  deleteDirectMessage,
  isUserRestricted,
  updateDirectMessage,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

/**
 * PATCH /api/dm/messages/[id]
 * Edit the text of your own direct message.
 * Body: { content }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (await isUserRestricted(user.userId)) {
      return NextResponse.json(
        { error: "You have limited access, try again later" },
        { status: 403 }
      );
    }
    const { id } = await params;

    let body: { content?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const content = typeof body.content === "string" ? body.content : "";
    if (!content.trim()) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

    const result = await updateDirectMessage(id, user.userId, content);
    if (!result.success) {
      const status = result.error === "Message not found" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json(
      { success: true, message: result.message },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating DM:", error);
    return NextResponse.json(
      { error: "Failed to edit message" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dm/messages/[id]
 * Soft-delete your own direct message (falls back to a hard delete
 * if the migration hasn't been applied yet).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (await isUserRestricted(user.userId)) {
      return NextResponse.json(
        { error: "You have limited access, try again later" },
        { status: 403 }
      );
    }
    const { id } = await params;

    const result = await deleteDirectMessage(id, user.userId);
    if (!result.success) {
      const status = result.error === "Message not found" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json(
      { success: true, message: result.message ?? null },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting DM:", error);
    return NextResponse.json(
      { error: "Failed to delete message" },
      { status: 500 }
    );
  }
}