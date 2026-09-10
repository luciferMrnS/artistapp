import { NextRequest, NextResponse } from "next/server";
import {
  findUserById,
  getUserPublicData,
  isUsernameTaken,
  updateUserProfile,
} from "@/lib/db";
import { verifyToken } from "@/lib/server-auth";

const USERNAME_MIN = 2;
const USERNAME_MAX = 30;
const USERNAME_PATTERN = /^[a-zA-Z0-9_.\- ]+$/;

/**
 * PATCH /api/profile
 * Update the authenticated user's own profile: username (display/artist name)
 * and avatar (profile picture URL). Both artists and fans can do this.
 * Body: { username?: string, avatar?: string }
 */
export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get("auth-token")?.value;
    const payload = token ? verifyToken(token) : null;

    if (!payload) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await findUserById(payload.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const updates: { username?: string; avatar?: string } = {};

    // ─── Username / artist name ───────────────────────
    if (body.username !== undefined) {
      const username = String(body.username).trim();

      if (
        username.length < USERNAME_MIN ||
        username.length > USERNAME_MAX ||
        !USERNAME_PATTERN.test(username)
      ) {
        return NextResponse.json(
          {
            error: `Name must be ${USERNAME_MIN}-${USERNAME_MAX} characters (letters, numbers, spaces, . _ - only)`,
          },
          { status: 400 }
        );
      }

      if (await isUsernameTaken(username, user.id)) {
        return NextResponse.json(
          { error: "That name is already taken" },
          { status: 400 }
        );
      }

      updates.username = username;
    }

    // ─── Avatar / profile picture ─────────────────────
    if (body.avatar !== undefined) {
      const avatar = String(body.avatar).trim();

      if (avatar === "") {
        // Reset to a default avatar when cleared
        updates.avatar = `https://i.pravatar.cc/150?img=${Math.floor(
          Math.random() * 70
        )}`;
      } else {
        try {
          const parsed = new URL(avatar);
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            throw new Error("bad protocol");
          }
          updates.avatar = avatar;
        } catch {
          return NextResponse.json(
            { error: "Profile picture must be a valid http(s) URL" },
            { status: 400 }
          );
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 }
      );
    }

    const updated = await updateUserProfile(user.id, updates);
    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, user: getUserPublicData(updated) },
      { status: 200 }
    );
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
