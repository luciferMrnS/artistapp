import { NextRequest, NextResponse } from "next/server";
import {
  deleteUserAccount,
  findUserById,
  setUserRestriction,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

/**
 * PATCH /api/admin/users/[id]
 * Artist-only. Manage a fan account:
 *   { action: "restrict" }   → set to view-only
 *   { action: "unrestrict" } → restore full access
 *   { action: "delete" }     → permanently remove the account
 */
export async function PATCH(
  req: NextRequest,
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
        { error: "Only the artist can manage accounts" },
        { status: 403 }
      );
    }

    const { id: targetId } = await context.params;
    const body = await req.json();
    const action = body?.action as string | undefined;

    if (!["restrict", "unrestrict", "delete"].includes(action ?? "")) {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }

    const target = await findUserById(targetId);
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (target.id === fullUser.id) {
      return NextResponse.json(
        { error: "You can't manage your own account" },
        { status: 400 }
      );
    }

    if (action === "delete") {
      const { success, error } = await deleteUserAccount(target.id);
      if (!success) {
        return NextResponse.json(
          { error: error || "Failed to delete account" },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, deleted: true }, { status: 200 });
    }

    const restricted = action === "restrict";
    const { success, error } = await setUserRestriction(
      target.id,
      restricted
    );
    if (!success) {
      return NextResponse.json(
        { error: error || "Failed to update account" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, restricted }, { status: 200 });
  } catch (err) {
    console.error("Error managing user:", err);
    return NextResponse.json(
      { error: "Failed to manage account" },
      { status: 500 }
    );
  }
}