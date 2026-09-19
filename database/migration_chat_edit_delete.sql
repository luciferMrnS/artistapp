-- ─────────────────────────────────────────────────────────
-- Chat edit/delete support: Creed messages + direct messages
-- Adds:
--   edited_at  TIMESTAMPTZ  set when a message's text is edited
--   deleted_at TIMESTAMPTZ  set when a message is softly deleted
-- Paste into Supabase SQL Editor once. Until this is applied
-- the app degrades gracefully: edits still work but lose the
-- "(edited)" marker, and deletes hard-delete the row instead
-- of leaving a "Message deleted" placeholder.
-- ─────────────────────────────────────────────────────────

-- ─── Creed (community) messages ───────────────────────

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ─── Direct messages ──────────────────────────────────

ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;