import { NextRequest, NextResponse } from "next/server";
import { createAnonAuthClient, getAppUrl } from "@/lib/supabase-auth-client";

// Supabase Auth allows only ~2 confirmation emails per hour per account.
// Throttle resends to match and surface a friendly message.
const RATE_LIMIT_MS = 30 * 60 * 1000;
const resendAttempts = new Map<string, number>();

/**
 * POST /api/auth/resend-verification
 * Re-send the Supabase signup confirmation email.
 * Always responds generically to avoid account enumeration.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const now = Date.now();
    const sinceLastSend = now - (resendAttempts.get(email.toLowerCase()) ?? 0);
    if (sinceLastSend < RATE_LIMIT_MS) {
      return NextResponse.json(
        {
          error:
            "Verification emails are limited to 2 per hour. Please wait a while, then request another.",
          rateLimited: true,
          retryAfterMs: RATE_LIMIT_MS - sinceLastSend,
        },
        { status: 429 }
      );
    }

    const supabase = createAnonAuthClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${getAppUrl()}/auth/callback` },
    });

    // Mark the send as attempted regardless — the budget is consumed either
    // way, so the user waits instead of silently hitting the limit.
    resendAttempts.set(email.toLowerCase(), now);

    // Common "errors" (already confirmed, rate-limited, unknown email) are
    // intentionally swallowed — the response is identical either way.
    if (error) {
      console.error("Resend verification error:", error.message);
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "If an account exists for this email and it isn't verified yet, a new confirmation link has been sent.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Resend verification failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
