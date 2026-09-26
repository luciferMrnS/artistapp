/**
 * Server-side Auth Utilities
 * Handles JWT token generation and validation
 * Uses httpOnly cookies for secure session storage
 * Phase 4: Includes user role in JWT payload
 */

import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { StoredUser, UserRole } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const COOKIE_NAME = "auth-token";

/**
 * How long a session lasts, in one place.
 *
 * This was 7 days, hard, and nothing extended it — so every user was silently
 * signed out a week after signing in and had to type their password again. The
 * session now slides (see `renewSessionCookie`), so the only thing that ends it
 * is signing out.
 *
 * Deliberately not "never expires". The token is a bearer credential: anyone
 * holding the cookie is the user, so a token with no expiry cannot be revoked
 * at all. A long window that renews on activity means an idle or abandoned
 * session still dies on its own, which is the behaviour people expect and the
 * one that survives a stolen cookie being reused later.
 */
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

const TOKEN_EXPIRY = `${SESSION_TTL_SECONDS}s`;

/**
 * Re-issue once less than half the window remains, so an active visitor never
 * experiences the tail end of it.
 */
const RENEW_AFTER_SECONDS = SESSION_TTL_SECONDS / 2;

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  /** Added by jsonwebtoken; used to decide when to renew. */
  iat?: number;
  exp?: number;
}

/**
 * Create JWT token
 */
export function createToken(userId: string, email: string, role: UserRole): string {
  return jwt.sign(
    { userId, email, role } as JWTPayload,
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * The cookie's attributes, defined once.
 *
 * Login and renewal used to spell these out separately, so the two could drift
 * — a session renewed with different flags than it was issued with is a bug
 * that only shows up as an intermittent sign-out.
 */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  };
}

/**
 * True once the session is past the halfway mark and should be re-issued.
 *
 * A payload with no `exp` is left alone rather than renewed: it came from
 * somewhere this code did not sign, and re-issuing it on a guess would extend a
 * session whose real lifetime is unknown.
 */
export function sessionNeedsRenewal(payload: JWTPayload): boolean {
  if (typeof payload.exp !== "number") return false;
  const remaining = payload.exp - Math.floor(Date.now() / 1000);
  return remaining < RENEW_AFTER_SECONDS;
}

/**
 * Re-issue the session cookie on a response, extending the window.
 *
 * Takes the user row rather than the token payload so a renewed token carries
 * the role as it stands in the database now. The JWT's role is not trusted
 * anywhere anyway — /api/landing-feed re-reads it for exactly that reason — but
 * renewing from stale claims would bake an old role into a fresh token.
 */
export function renewSessionCookie(
  response: NextResponse,
  user: Pick<StoredUser, "id" | "email" | "role">
): void {
  response.cookies.set(
    COOKIE_NAME,
    createToken(user.id, user.email, user.role),
    sessionCookieOptions()
  );
}

/**
 * Set auth cookie (server-side)
 */
export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, sessionCookieOptions());
}

/**
 * Get auth token from cookie
 */
export async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

/**
 * Clear auth cookie
 */
export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Get current user from token (server-side)
 * Returns full JWT payload including role
 */
export async function getCurrentUser(): Promise<JWTPayload | null> {
  const token = await getAuthToken();
  if (!token) return null;

  return verifyToken(token);
}

/**
 * Format response for JSON
 */
export function formatUserResponse(user: Omit<StoredUser, "password_hash">) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatar: user.avatar,
    role: user.role,
    createdAt: user.created_at, // Maps DB created_at to API createdAt
  };
}
