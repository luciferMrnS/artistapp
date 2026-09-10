import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/server-auth";

/**
 * POST /api/auth/logout
 * Clear auth session
 */
export async function POST(req: NextRequest) {
  try {
    const response = NextResponse.json(
      { success: true },
      { status: 200 }
    );

    response.cookies.delete("auth-token");
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
