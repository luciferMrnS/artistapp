"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "@/lib/auth";

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

/** How often to re-check the session while the app is open. Comfortably inside
 *  the renewal threshold on the server, so a tab left open never reaches the
 *  point where the cookie would lapse. */
const SESSION_REFRESH_MS = 25 * 60 * 1000; // 25 minutes

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Re-read the session from the server cookie.
   *
   * State is only changed on a success. A failed check leaves the current user
   * alone on purpose: the cookie is still valid through a dropped connection or
   * a 500, and clearing the user on a transient error is exactly the "signed me
   * out for no reason" behaviour this is meant to avoid.
   */
  const loadUser = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include", // Include cookies
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error("Failed to load user:", error);
    }
  }, []);

  // Load auth session on mount by checking server cookie
  useEffect(() => {
    const initialLoad = async () => {
      await loadUser();
      setIsLoading(false);
    };

    void initialLoad();
  }, [loadUser]);

  /**
   * Keep the session open for as long as the app is in use.
   *
   * Without this the cookie only slid on a fresh page load, so a PWA tab left
   * open in the background — the normal state of a phone app — would quietly
   * lapse. Returning to the tab is the other moment worth re-checking: someone
   * who closed it and came back hours later is exactly who should not have to
   * sign in again.
   */
  useEffect(() => {
    const revalidate = () => {
      if (document.visibilityState === "visible") void loadUser();
    };

    const interval = setInterval(revalidate, SESSION_REFRESH_MS);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, [loadUser]);

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
