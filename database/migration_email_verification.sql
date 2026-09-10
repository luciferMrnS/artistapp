-- ─────────────────────────────────────────────────────────────
-- Email Verification Migration (Supabase Auth)
-- Run ONCE in the Supabase SQL Editor.
--
-- Also required in the Supabase Dashboard (cannot be done via SQL):
--   Authentication → Sign In / Providers → "Confirm email" = ON
--   Authentication → URL Configuration → Site URL = http://localhost:3000
--   Authentication → URL Configuration → Redirect URLs add:
--       http://localhost:3000/auth/callback
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS supabase_auth_id UUID;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Grandfather existing accounts (created before verification existed):
UPDATE public.users SET email_verified = TRUE WHERE email_verified = FALSE;
