-- ─────────────────────────────────────────────────────────
-- Phase 6: Fan community (real-time chat)
-- Tables: messages (text/gif/image/sticker) + realtime
-- publication + community-media storage bucket
-- ─────────────────────────────────────────────────────────

-- Messages table for the fan community chat
CREATE TABLE IF NOT EXISTS messages (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username     TEXT NOT NULL,
  avatar       TEXT,
  content      TEXT NOT NULL DEFAULT '',
  message_type TEXT NOT NULL DEFAULT 'text'
                   CHECK (message_type IN ('text', 'gif', 'image', 'sticker')),
  media_url    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- ─── Realtime publication (broadcasts new messages) ────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END$$;

-- ─── Private bucket for uploaded images/memes ──────────
-- (displayed via short-lived signed URLs, like tracks)

INSERT INTO storage.buckets (id, name, public)
VALUES ('community-media', 'community-media', false)
ON CONFLICT (id) DO NOTHING;

-- ─── Row Level Security ───────────────────────────────

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read on messages" ON messages;
CREATE POLICY "Allow authenticated read on messages"
  ON messages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert on messages" ON messages;
CREATE POLICY "Allow authenticated insert on messages"
  ON messages FOR INSERT TO authenticated WITH CHECK (auth.uid()::TEXT = user_id);