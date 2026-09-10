import { NextRequest, NextResponse } from "next/server";
import { createAnonAuthClient, getAppUrl } from "@/lib/supabase-auth-client";

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

    const supabase = createAnonAuthClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${getAppUrl()}/auth/callback` },
    });

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
