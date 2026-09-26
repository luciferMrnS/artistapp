-- ─────────────────────────────────────────────────────────
-- Mention notifications (@username / @all in Creed)
-- Extends the notifications type constraint with 'mention'.
-- ─────────────────────────────────────────────────────────

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('like', 'comment', 'follow', 'post', 'mention'));