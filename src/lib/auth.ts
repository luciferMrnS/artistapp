/**
 * Auth utilities
 * Used for the client-side User interface
 * Phase 4: Includes user role (artist | fan)
 */

import type { UserRole } from "@/lib/db";

export type { UserRole };

export interface User {
  id: string;
  email: string;
  username: string;
  avatar: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: number;
}

const AUTH_STORAGE_KEY = "artist_app_auth";
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Get stored auth session from localStorage
 */
export function getAuthSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;

    const session: AuthSession = JSON.parse(stored);

    // Check if session expired
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    return session;
  } catch (error) {
    console.error("Failed to parse auth session:", error);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

/**
 * Store auth session in localStorage
 */
export function setAuthSession(session: AuthSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

/**
 * Clear auth session
 */
export function clearAuthSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

/**
 * Mock login with email/password
 * Phase 2: Mock validation (Phase 3 will call real API)
 */
export function mockLogin(
  email: string,
  password: string
): AuthSession | { error: string } {
  // Basic validation
  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  if (!email.includes("@")) {
    return { error: "Invalid email format" };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  // Mock: Generate user from email
  const username = email.split("@")[0];
  const user: User = {
    id: `user_${Math.random().toString(36).substr(2, 9)}`,
    email,
    username,
    avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`,
    role: "fan",
    createdAt: new Date().toISOString(),
  };

  const session: AuthSession = {
    user,
    token: `token_${Math.random().toString(36).substr(2, 16)}`,
    expiresAt: Date.now() + SESSION_DURATION,
  };

  setAuthSession(session);
  return session;
}

/**
 * Mock signup with email/password
 * Phase 2: Mock validation (Phase 3 will call real API)
 */
export function mockSignup(
  email: string,
  password: string,
  confirmPassword: string
): AuthSession | { error: string } {
  // Basic validation
  if (!email || !password || !confirmPassword) {
    return { error: "All fields are required" };
  }

  if (!email.includes("@")) {
    return { error: "Invalid email format" };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  // Mock: Check if user already exists (in localStorage)
  const session = getAuthSession();
  if (session && session.user.email === email) {
    return { error: "Email already registered" };
  }

  // Mock: Create new user
  const username = email.split("@")[0];
  const newUser: User = {
    id: `user_${Math.random().toString(36).substr(2, 9)}`,
    email,
    username,
    avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`,
    role: "fan",
    createdAt: new Date().toISOString(),
  };

  const newSession: AuthSession = {
    user: newUser,
    token: `token_${Math.random().toString(36).substr(2, 16)}`,
    expiresAt: Date.now() + SESSION_DURATION,
  };

  setAuthSession(newSession);
  return newSession;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getAuthSession() !== null;
}
