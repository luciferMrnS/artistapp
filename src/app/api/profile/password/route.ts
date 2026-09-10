import { NextRequest, NextResponse } from "next/server";
import {
  findUserById,
  getUserPublicData,
  verifyPassword,
  updateLegacyUserPassword,
  createPasswordChangeToken,
  deletePasswordChangeTokens,
} from "@/lib/db";
import { verifyToken } from "@/lib/server-auth";
import { createAnonAuthClient, createAuthCookieClient, getAppUrl } from "@/lib/supabase-auth-client";

const PASSWORD_CHANGE_CONFIRM_URL = "/auth/update-password";

/**
 * POST /api/profile/password
 * Change the authenticated user's password.
 * Body: { currentPassword: string, newPassword: string }
 *
 * - Supabase Auth accounts: the new password is staged and a confirmation
 *   email (Supabase password-recovery link) is sent. The change only
 *   applies after the user clicks that link.
 * - Legacy accounts (bcrypt hash, e.g. the seeded artist) have no email
 *   channel and keep a direct change after verifying the current password.
 */
export async function POST(req: NextRequest) {
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

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current and new password are required" },
        { status: 400 }
      );
    }

    if (String(newPassword).length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters" },
        { status: 400 }
      );
    }

    if (newPassword === currentPassword) {
      return NextResponse.json(
        { error: "New password must be different from the current one" },
        { status: 400 }
      );
    }

    // ─── Verify the current password ──────────────────
    if (user.password_hash) {
      // Legacy account (bcrypt hash in public.users, e.g. the seeded artist)
      const valid = await verifyPassword(user.password_hash, currentPassword);
      if (!valid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 401 }
        );
      }

      const updated = await updateLegacyUserPassword(user.id, newPassword);
      if (!updated) {
        return NextResponse.json(
          { error: "Failed to change password" },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { success: true, user: getUserPublicData(updated) },
        { status: 200 }
      );
    }

    if (user.supabase_auth_id) {
      // Supabase Auth account — stage the change and require email confirmation
      const supabase = createAnonAuthClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (error) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 401 }
        );
      }

      const staged = await createPasswordChangeToken(user.id, newPassword);
      if ("error" in staged) {
        console.error("Failed to stage password change:", staged.error);
        return NextResponse.json(
          { error: "Failed to prepare password change" },
          { status: 500 }
        );
      }

      // Cookie-backed client so the PKCE verifier survives to the callback.
      const cookieClient = await createAuthCookieClient();
      const { error: sendError } = await cookieClient.auth.resetPasswordForEmail(
        user.email,
        { redirectTo: `${getAppUrl()}${PASSWORD_CHANGE_CONFIRM_URL}` }
      );

      if (sendError) {
        console.error("Password confirmation email failed:", sendError.message);
        await deletePasswordChangeTokens(user.id);
        return NextResponse.json(
          { error: "Failed to send confirmation email. Please try again." },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          requiresEmailConfirmation: true,
          message:
            "A confirmation link has been sent to your email. Click it to finish changing your password.",
        },
        { status: 200 }
      );
    }

    // No verifiable credential on this account
    return NextResponse.json(
      { error: "This account cannot change its password here" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}