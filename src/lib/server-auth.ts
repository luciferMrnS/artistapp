/**
 * Server-side Auth Utilities
 * Handles JWT token generation and validation
 * Uses httpOnly cookies for secure session storage
 * Phase 4: Includes user role in JWT payload
 */

import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import type { StoredUser, UserRole } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const COOKIE_NAME = "auth-token";
const TOKEN_EXPIRY = "7d"; // 7 days

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
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
 * Set auth cookie (server-side)
 */
export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    path: "/",
  });
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
