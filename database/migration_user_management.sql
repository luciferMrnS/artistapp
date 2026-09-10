-- ─────────────────────────────────────────────────────────
-- User management: account restriction (view-only)
-- The artist can flip a fan to "view only" from the dashboard.
-- When restricted, the fan can browse the site but every write
-- (posts, comments, likes, follows, chat, DMs) is rejected by the API.
--
-- NOTE: deleting a fan from the dashboard removes their account row;
-- ON DELETE CASCADE already clears their posts, comments, likes,
-- follows, notifications, direct messages and community-chat messages.
-- ─────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS restricted_at TIMESTAMPTZ;