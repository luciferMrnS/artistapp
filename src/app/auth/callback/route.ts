import { NextRequest, NextResponse } from "next/server";
import {
  findUserByEmail,
  markEmailVerified,
  createUnverifiedUser,
} from "@/lib/db";
import { createToken } from "@/lib/server-auth";
import { createAuthCookieClient } from "@/lib/supabase-auth-client";

/**
 * GET /auth/callback
 * Destination of the Supabase confirmation-email link (PKCE code flow).
 * Exchanges the code for a session, marks the app profile verified, and
 * issues the app's JWT session cookie so the user is signed in.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?verify=failed`);
  }

  try {
    const supabase = await createAuthCookieClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user?.email) {
      console.error("Callback exchange error:", error?.message);
      return NextResponse.redirect(`${origin}/auth/login?verify=failed`);
    }

    // Sync the app profile row with the now-verified identity
    let profile = await findUserByEmail(data.user.email);
    const metadata = (data.user.user_metadata ?? {}) as {
      username?: string;
      role?: "artist" | "fan";
    };

    if (!profile) {
      const created = await createUnverifiedUser({
        email: data.user.email,
        username: metadata.username ?? data.user.email.split("@")[0],
        role: metadata.role ?? "fan",
        supabaseAuthId: data.user.id,
      });
      if ("error" in created) {
        console.error("Callback profile creation failed:", created.error);
        return NextResponse.redirect(`${origin}/auth/login?verify=failed`);
      }
      profile = created;
    }

    const verified =
      (await markEmailVerified(profile.email, data.user.id)) ?? profile;

    // Issue the app's JWT session cookie on the redirect response
    const token = createToken(verified.id, verified.email, verified.role);
    const response = NextResponse.redirect(`${origin}${next}?verified=1`);
    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Auth callback error:", error);
    return NextResponse.redirect(`${origin}/auth/login?verify=failed`);
  }
}
