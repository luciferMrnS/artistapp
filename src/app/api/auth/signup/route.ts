import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, getUserPublicData, createUnverifiedUser } from "@/lib/db";
import { isValidEmail } from "@/lib/email-validation";
import { createAuthCookieClient, getAppUrl } from "@/lib/supabase-auth-client";
import type { UserRole } from "@/lib/db";

/**
 * POST /api/auth/signup
 * Register with email, password, and username.
 * Identity lives in Supabase Auth — a confirmation email is sent to the
 * address and the account stays unverified until the link is clicked.
 * Supports an optional "role" field: "artist" or "fan" (defaults to "fan")
 */

// Supabase Auth sends confirmation emails on a strict schedule (currently
// 2 per hour per account/IP). Throttle our own signups to match so users get
// a friendly countdown instead of the raw "email rate limit" error, and so
// repeated clicks can't burn through Supabase's quota.
const RATE_LIMIT_MS = 30 * 60 * 1000;

// In-memory throttle — adequate on a single Render instance.
const sendAttempts = new Map<string, number>();

function isRateLimitError(message: string): boolean {
  return (
    /rate\s*limit/i.test(message) ||
    /too\s*many/i.test(message) ||
    /email sending is limited/i.test(message) ||
    /more than \d+ emails/i.test(message)
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, confirmPassword, username } = body; // role is ignored — everyone signs up as a fan

    // Validation
    if (!email || !password || !confirmPassword || !username) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Validate email format and domain
    const emailValidation = await isValidEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json(
        { error: emailValidation.error },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match" },
        { status: 400 }
      );
    }

    // Duplicate check on the app profile table
    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      );
    }

    // Throttle confirmation emails per email address (primary key) so a
    // burst of attempts is normalized instead of hitting Supabase's limit.
    const key = `${email.toLowerCase()} || ${req.headers.get("x-forwarded-for") ?? "unknown"}`;
    const now = Date.now();
    const sinceLastSend = now - (sendAttempts.get(key) ?? 0);
    if (sinceLastSend < RATE_LIMIT_MS) {
      return NextResponse.json(
        {
          error:
            "Verification emails are limited to 2 per hour. Please wait before trying again.",
          rateLimited: true,
          retryAfterMs: RATE_LIMIT_MS - sinceLastSend,
        },
        { status: 429 }
      );
    }

    // All new signups are fans. The artist account is seeded in the
    // database and cannot be created through the public signup flow.
    const userRole: UserRole = "fan";

    // Create the identity in Supabase Auth. Supabase emails the confirmation
    // link (redirecting to /auth/callback) when "Confirm email" is enabled.
    // A cookie-backed client is required so the PKCE code verifier is stored
    // for the later code exchange.
    const supabase = await createAuthCookieClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, role: userRole },
        emailRedirectTo: `${getAppUrl()}/auth/callback`,
      },
    });

    if (error) {
      if (isRateLimitError(error.message)) {
        // Mark the send as attempted so the user waits out the cooldown
        // instead of re-hitting the raw Supabase error.
        sendAttempts.set(key, now);
        console.error("Supabase signup rate-limited:", error.message);
        return NextResponse.json(
          {
            error:
              "You've used up this hour's send of verification emails (2 per hour). Please wait about 30 minutes and try again.",
            rateLimited: true,
            retryAfterMs: RATE_LIMIT_MS,
          },
          { status: 429 }
        );
      }
      console.error("Supabase signup error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    sendAttempts.set(key, now);

    if (!data.user) {
      return NextResponse.json(
        { error: "Signup failed — please try again" },
        { status: 400 }
      );
    }

    // Create the app profile row (unverified)
    const profile = await createUnverifiedUser({
      email,
      username,
      role: userRole,
      supabaseAuthId: data.user.id,
    });

    if ("error" in profile) {
      return NextResponse.json({ error: profile.error }, { status: 400 });
    }

    // Email confirmation is ALWAYS required — even if the project's
    // "Confirm email" toggle is off and Supabase would hand back a session,
    // we never auto-log-in an unverified account. Respond WITHOUT a session
    // cookie so the user must confirm first.
    const response = NextResponse.json(
      {
        success: true,
        requiresVerification: true,
        user: getUserPublicData(profile),
        // Supabase Auth user id — used by the e2e harness to auto-confirm.
        // Only exposed outside production.
        ...(process.env.NODE_ENV !== "production"
          ? { authUserId: data.user.id }
          : {}),
      },
      { status: 201 }
    );
    return response;
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

