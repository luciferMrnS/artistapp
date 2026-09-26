import { NextRequest, NextResponse } from "next/server";
import { findUserById, getUserPublicData } from "@/lib/db";
import {
  renewSessionCookie,
  sessionNeedsRenewal,
  verifyToken,
} from "@/lib/server-auth";

/**
 * GET /api/auth/me
 * Get current authenticated user (includes role)
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Verify token
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await findUserById(payload.userId);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    /* Slide the session. AuthProvider calls this route on every page load, so
       simply being signed in keeps the window open — the session then only ends
       when the user signs out, instead of silently lapsing a week after they
       signed in. Renewal happens at the halfway mark rather than every time, so
       this is not a re-sign per navigation. */
    const response = NextResponse.json(
      {
        success: true,
        user: getUserPublicData(user),
      },
      { status: 200 }
    );

    if (sessionNeedsRenewal(payload)) {
      renewSessionCookie(response, user);
    }

    return response;
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
