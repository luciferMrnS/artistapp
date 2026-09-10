-- ─────────────────────────────────────────────────────────
-- Phase 9: Direct messages (fan-artist / fan-fan)
-- Table: direct_messages (single table, derived conversation ids)
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS direct_messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         TEXT NOT NULL DEFAULT '',
  media_url       TEXT,
  read            BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_dm_conversation_created
  ON direct_messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_dm_recipient_unread
  ON direct_messages(recipient_id, conversation_id) WHERE NOT read;

-- ─── Row Level Security ───────────────────────────────

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users read own DMs" ON direct_messages;
CREATE POLICY "Allow users read own DMs"
  ON direct_messages FOR SELECT TO authenticated
  USING (auth.uid()::TEXT IN (sender_id, recipient_id));

DROP POLICY IF EXISTS "Allow users send DMs" ON direct_messages;
CREATE POLICY "Allow users send DMs"
  ON direct_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::TEXT = sender_id);

DROP POLICY IF EXISTS "Allow recipients mark own DMs read" ON direct_messages;
CREATE POLICY "Allow recipients mark own DMs read"
  ON direct_messages FOR UPDATE TO authenticated
  USING (auth.uid()::TEXT = recipient_id);