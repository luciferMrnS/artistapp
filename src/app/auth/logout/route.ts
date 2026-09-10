import { NextResponse } from "next/server";

/**
 * Logout API route
 * Client-side redirect handles clearing localStorage via useAuth hook
 */
export async function GET() {
  // In Phase 2, logout is handled client-side
  // In Phase 3, this will invalidate server sessions
  return NextResponse.json({ success: true });
}
