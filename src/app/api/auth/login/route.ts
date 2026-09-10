import { NextRequest, NextResponse } from "next/server";
import {
  findUserByEmail,
  verifyPassword,
  getUserPublicData,
  markEmailVerified,
  createUnverifiedUser,
} from "@/lib/db";
import { createToken } from "@/lib/server-auth";
import { createAnonAuthClient } from "@/lib/supabase-auth-client";
import type { StoredUser } from "@/lib/db";

/**
 * POST /api/auth/login
 * Sign in with email and password.
 * Passwords are verified against Supabase Auth, which also enforces email
 * confirmation ("Email not confirmed" until the verification link is clicked).
 * Legacy accounts that only exist in public.users (bcrypt hash, e.g. the
 * seeded artist) fall back to bcrypt verification.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const supabase = createAnonAuthClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const message = error.message || "";

      // Account exists but the confirmation email hasn't been clicked
      if (/not confirmed/i.test(message)) {
        return NextResponse.json(
          {
            error: "Please verify your email before signing in — check your inbox for the confirmation link.",
            code: "EMAIL_NOT_VERIFIED",
          },
          { status: 403 }
        );
      }

      // Legacy fallback: accounts created before the Supabase Auth migration
      // (bcrypt hash stored in public.users). Keeps the seeded artist working.
      const legacyUser = await findUserByEmail(email);
      if (
        legacyUser?.password_hash &&
        (await verifyPassword(legacyUser.password_hash, password))
      ) {
        if (legacyUser.email_verified === false) {
          return NextResponse.json(
            {
              error:
                "Please verify your email before signing in — check your inbox for the confirmation link.",
              code: "EMAIL_NOT_VERIFIED",
            },
            { status: 403 }
          );
        }
        return issueSession(legacyUser);
      }

      console.error("Supabase login error:", message);
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const authUser = data.user;
    if (!authUser?.email) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Sync the app profile row with the verified Supabase Auth identity
    let profile = await findUserByEmail(authUser.email);
    const metadata = (authUser.user_metadata ?? {}) as {
      username?: string;
      role?: "artist" | "fan";
    };

    if (!profile) {
      // First login of a Supabase-only account — create the profile row
      const created = await createUnverifiedUser({
        email: authUser.email,
        username: metadata.username ?? authUser.email.split("@")[0],
        role: metadata.role ?? "fan",
        supabaseAuthId: authUser.id,
      });
      if ("error" in created) {
        return NextResponse.json({ error: created.error }, { status: 500 });
      }
      profile = created;
    }

    // Hard gate: an unverified profile can only sign in if Supabase itself
    // confirms the email on its side (email_confirmed_at set, e.g. when the
    // user clicked the confirmation link). This keeps the "confirm email"
    // requirement enforced even if the project's dashboard toggle were off.
    if (
      profile.email_verified === false &&
      !authUser.email_confirmed_at
    ) {
      return NextResponse.json(
        {
          error:
            "Please verify your email before signing in — check your inbox for the confirmation link.",
          code: "EMAIL_NOT_VERIFIED",
        },
        { status: 403 }
      );
    }

    // Reaching here means Supabase accepted the password — the email is
    // confirmed on their side. Reflect that in the app profile.
    const verified = await markEmailVerified(profile.email, authUser.id);
    if (verified) profile = verified;

    return issueSession(profile);
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/** Issue the app's custom JWT session cookie for a profile row. */
function issueSession(user: StoredUser) {
  const token = createToken(user.id, user.email, user.role);
  const response = NextResponse.json(
    {
      success: true,
      user: getUserPublicData(user),
    },
    { status: 200 }
  );

  response.cookies.set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });

  return response;
}

