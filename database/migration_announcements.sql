-- Artist announcements shown as a sliding banner on the Creed page
-- Paste this whole file into the Supabase SQL Editor and run it.

-- 1. Announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Server-side admin client bypasses RLS; keep a deny-all policy for safety.
DROP POLICY IF EXISTS "No direct access to announcements" ON public.announcements;
CREATE POLICY "No direct access to announcements"
  ON public.announcements
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- 2. Allow the increment_post_counter RPC-like behavior to also count announcements is NOT needed.
--    Announcements are counted by the table itself; nothing else required.