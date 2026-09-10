-- ─────────────────────────────────────────────────────────
-- Phase 8: Notifications
-- Table: notifications (likes, comments, follows, artist posts)
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL
                 CHECK (type IN ('like', 'comment', 'follow', 'post')),
  actor_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  post_id    TEXT REFERENCES posts(id) ON DELETE CASCADE,
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id) WHERE NOT read;

-- ─── Row Level Security ───────────────────────────────

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users read own notifications" ON notifications;
CREATE POLICY "Allow users read own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (auth.uid()::TEXT = user_id);

DROP POLICY IF EXISTS "Allow users update own notifications" ON notifications;
CREATE POLICY "Allow users update own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (auth.uid()::TEXT = user_id);