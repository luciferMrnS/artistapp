-- ─────────────────────────────────────────────────────────
-- Email-confirm password change (Phase: password recovery)
-- Table: password_change_tokens
-- A logged-in user stages their new password; a confirmation
-- email (Supabase password-recovery link) approves the change.
-- The new password is stored AES-256-GCM encrypted (key derived
-- from JWT_SECRET) with a 30-minute expiry and single use.
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS password_change_tokens (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_password_enc TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  consumed        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_change_tokens_user
  ON password_change_tokens(user_id);

ALTER TABLE password_change_tokens ENABLE ROW LEVEL SECURITY;