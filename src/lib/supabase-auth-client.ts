/**
 * Supabase Auth helpers
 * Identity + email verification run on Supabase Auth (auth.users); the app
 * keeps its own `public.users` profile table and custom JWT cookie sessions.
 */
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/** Public origin of this app — used for email confirmation redirects. */
export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3000"
  );
}

/**
 * Cookie-backed Supabase client for PKCE flows (signup + email-confirm
 * callback). Storing the PKCE code verifier in cookies lets the
 * /auth/callback route exchange the confirmation code for a session.
 * Only usable in Route Handlers / Server Actions (mutates cookies).
 */
export async function createAuthCookieClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a context that can't set cookies — safe to ignore,
            // the callback route re-sets them on its own response.
          }
        },
      },
    }
  );
}

/**
 * Plain anon-key client for password grants (login) and resending
 * confirmation emails — no cookie persistence needed.
 */
export function createAnonAuthClient(): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
}
