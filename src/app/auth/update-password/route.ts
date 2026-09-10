import { NextRequest, NextResponse } from "next/server";
import {
  findUserByEmail,
  getPendingPasswordChange,
  getPasswordChangePlaintext,
  consumePasswordChangeToken,
  updateSupabaseAuthPassword,
} from "@/lib/db";
import { createAuthCookieClient } from "@/lib/supabase-auth-client";

/**
 * GET /auth/update-password
 * Destination of the Supabase password-recovery email link (PKCE code flow)
 * that confirms a staged password change.
 * Applies the staged (encrypted) new password via the Admin API, consumes the
 * token, signs the user out, and redirects to login.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");

  const fail = () =>
    NextResponse.redirect(`${origin}/auth/login?password_confirm=failed`);

  if (!code) return fail();

  try {
    const supabase = await createAuthCookieClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user?.email) {
      console.error("Password confirm exchange error:", error?.message);
      return fail();
    }

    const profile = await findUserByEmail(data.user.email);
    if (!profile?.supabase_auth_id) return fail();

    const pending = await getPendingPasswordChange(profile.id);
    if (!pending) return fail();

    let newPassword: string;
    try {
      newPassword = getPasswordChangePlaintext(pending);
    } catch {
      return fail();
    }

    const applied = await updateSupabaseAuthPassword(
      profile.supabase_auth_id,
      newPassword
    );
    if (!applied) return fail();

    await consumePasswordChangeToken(pending.id);

    // Sign the user out of the app so they log in with the new password.
    const response = NextResponse.redirect(
      `${origin}/auth/login?password=changed`
    );
    response.cookies.set("auth-token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Password update callback error:", error);
    return fail();
  }
}