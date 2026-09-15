-- ─────────────────────────────────────────────────────────
-- Phase 10: DM interactions: replies + emoji reactions
-- 1. Adds reply_to_id (self-reference) to direct_messages
-- 2. Adds direct_message_reactions (one row per message+user+emoji)
-- Paste into Supabase SQL Editor once. The app degrades
-- gracefully until this is applied (reactions show []
-- and replies fall back to plain messages).
-- ─────────────────────────────────────────────────────────

-- ─── Replies ──────────────────────────────────────────

ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS reply_to_id TEXT
  REFERENCES public.direct_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dm_reply_to
  ON public.direct_messages (reply_to_id);

-- ─── Reactions ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.direct_message_reactions (
  message_id TEXT NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_dm_reactions_message
  ON public.direct_message_reactions (message_id);

-- ─── Row Level Security ───────────────────────────────

ALTER TABLE public.direct_message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow participants read dm reactions"
  ON public.direct_message_reactions;
CREATE POLICY "Allow participants read dm reactions"
  ON public.direct_message_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.direct_messages dm
      WHERE dm.id = message_id
        AND (auth.uid()::TEXT IN (dm.sender_id, dm.recipient_id))
    )
  );

DROP POLICY IF EXISTS "Allow participants insert own dm reactions"
  ON public.direct_message_reactions;
CREATE POLICY "Allow participants insert own dm reactions"
  ON public.direct_message_reactions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid()::TEXT = user_id
    AND EXISTS (
      SELECT 1 FROM public.direct_messages dm
      WHERE dm.id = message_id
        AND (auth.uid()::TEXT IN (dm.sender_id, dm.recipient_id))
    )
  );

DROP POLICY IF EXISTS "Allow users delete own dm reactions"
  ON public.direct_message_reactions;
CREATE POLICY "Allow users delete own dm reactions"
  ON public.direct_message_reactions FOR DELETE TO authenticated
  USING (auth.uid()::TEXT = user_id);
