-- ─────────────────────────────────────────────────────────
-- Creed interactions: replies + emoji reactions
-- 1. Adds reply_to_id (self-reference) to messages
-- 2. Adds message_reactions (one row per message+user+emoji)
-- Paste into Supabase SQL Editor once. The app degrades
-- gracefully until this is applied (reactions show [])
-- and replies fall back to plain messages.
-- ─────────────────────────────────────────────────────────

-- ─── Replies ──────────────────────────────────────────

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_id TEXT
  REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to
  ON public.messages (reply_to_id);

-- ─── Reactions ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id TEXT NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message
  ON public.message_reactions (message_id);

-- ─── Row Level Security ───────────────────────────────

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read on message_reactions"
  ON public.message_reactions;
CREATE POLICY "Allow authenticated read on message_reactions"
  ON public.message_reactions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert on message_reactions"
  ON public.message_reactions;
CREATE POLICY "Allow authenticated insert on message_reactions"
  ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::TEXT = user_id);

DROP POLICY IF EXISTS "Allow authenticated delete own on message_reactions"
  ON public.message_reactions;
CREATE POLICY "Allow authenticated delete own on message_reactions"
  ON public.message_reactions FOR DELETE TO authenticated
  USING (auth.uid()::TEXT = user_id);