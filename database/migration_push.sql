-- Web Push notifications: stores each device's push subscription so the
-- server can send Creed + DM unread-count notifications to installed apps.
--
-- Paste this in the Supabase SQL Editor and run it.
-- You do NOT need to re-run it if you already ran it once.

-- Per-user last time the Creed chat was opened. Lets the server count
-- "unread creed messages" (browser-only today) for accurate totals.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS creed_last_read_at TIMESTAMPTZ;

-- Each installed device a user has granted notification permission to.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions (user_id);

-- RLS: server writes via the service role; keep the table locked down.
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;