-- ─────────────────────────────────────────────────────────
-- Videos topic (Highlights -> Videos)
-- Table: videos (uploaded files OR embedded links)
-- Video files + thumbnails reuse the public "theme-media" bucket.
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS videos (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  caption         TEXT NOT NULL DEFAULT '',
  source          TEXT NOT NULL CHECK (source IN ('upload', 'link')),
  storage_path    TEXT NOT NULL DEFAULT '',
  link_url        TEXT NOT NULL DEFAULT '',
  embed_url       TEXT NOT NULL DEFAULT '',
  thumbnail_path  TEXT NOT NULL DEFAULT '',
  thumbnail_url   TEXT NOT NULL DEFAULT '',
  mime_type       TEXT NOT NULL DEFAULT '',
  size_bytes      BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created_at DESC);

-- Videos live in the shared public bucket (already exists from phase 10)
INSERT INTO storage.buckets (id, name, public)
VALUES ('theme-media', 'theme-media', true)
ON CONFLICT (id) DO NOTHING;

-- ─── Row Level Security ───────────────────────────────

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read videos" ON videos;
CREATE POLICY "Allow authenticated read videos"
  ON videos FOR SELECT TO authenticated USING (true);

-- The insert/update policies are intentionally open; the API routes enforce
-- artist-only writes server-side (like the other upload routes).
DROP POLICY IF EXISTS "Allow authenticated insert videos" ON videos;
CREATE POLICY "Allow authenticated insert videos"
  ON videos FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update videos" ON videos;
CREATE POLICY "Allow authenticated update videos"
  ON videos FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated delete videos" ON videos;
CREATE POLICY "Allow authenticated delete videos"
  ON videos FOR DELETE TO authenticated USING (true);