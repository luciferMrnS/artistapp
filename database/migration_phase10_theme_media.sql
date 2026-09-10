-- ─────────────────────────────────────────────────────────
-- Phase 10: Themed media (New drop / Behind the scenes / Studio)
-- Table: theme_media (audio/video/photo, themed by slug)
-- Media files live in the public "theme-media" storage bucket.
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS theme_media (
  id           TEXT PRIMARY KEY,
  theme        TEXT NOT NULL
                   CHECK (theme IN ('new-drop', 'behind-the-scenes', 'studio')),
  media_type   TEXT NOT NULL
                   CHECK (media_type IN ('audio', 'video', 'photo')),
  title        TEXT NOT NULL DEFAULT '',
  caption      TEXT NOT NULL DEFAULT '',
  storage_path TEXT NOT NULL,
  mime_type    TEXT NOT NULL,
  size_bytes   BIGINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_theme_media_theme_created
  ON theme_media(theme, created_at DESC);

-- ─── Public bucket for browser-playable media ─────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('theme-media', 'theme-media', true)
ON CONFLICT (id) DO NOTHING;

-- ─── Row Level Security ───────────────────────────────

ALTER TABLE theme_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read theme media" ON theme_media;
CREATE POLICY "Allow authenticated read theme media"
  ON theme_media FOR SELECT TO authenticated USING (true);

-- The insert policy is intentionally open; the API route enforces
-- artist-only uploads server-side (like the other upload routes).
DROP POLICY IF EXISTS "Allow authenticated insert theme media" ON theme_media;
CREATE POLICY "Allow authenticated insert theme media"
  ON theme_media FOR INSERT TO authenticated WITH CHECK (true);