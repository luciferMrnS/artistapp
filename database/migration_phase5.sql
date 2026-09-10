-- ─────────────────────────────────────────────────────────
-- Phase 5: Music streaming
-- Tables: tracks, streams (monthly listeners = distinct
-- streamers in the last 30 days) + private storage bucket
-- ─────────────────────────────────────────────────────────

-- Create tracks table (only the artist can upload music)
CREATE TABLE IF NOT EXISTS tracks (
  id              TEXT PRIMARY KEY,
  artist_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  storage_path    TEXT NOT NULL,           -- path inside the private "tracks" bucket
  plays_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create streams table (one row per stream start; artist_id is
-- denormalized so monthly listeners can be counted in one query)
CREATE TABLE IF NOT EXISTS streams (
  id         TEXT PRIMARY KEY,
  track_id   TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  artist_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  played_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes for performance ────────────────────────

CREATE INDEX IF NOT EXISTS idx_tracks_artist      ON tracks(artist_id);
CREATE INDEX IF NOT EXISTS idx_streams_track      ON streams(track_id);
CREATE INDEX IF NOT EXISTS idx_streams_artist     ON streams(artist_id);
CREATE INDEX IF NOT EXISTS idx_streams_played_at  ON streams(played_at DESC);

-- ─── Helper RPC: count distinct listeners over a window ─

CREATE OR REPLACE FUNCTION get_monthly_listeners(
  p_artist_id TEXT,
  p_days      INT DEFAULT 30
)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(DISTINCT user_id)::INTEGER
  FROM streams
  WHERE artist_id = p_artist_id
    AND played_at >= NOW() - make_interval(days => p_days);
$$;

-- ─── Helper RPC: atomically bump a track's play counter ─

CREATE OR REPLACE FUNCTION increment_track_plays(
  p_track_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE tracks SET plays_count = plays_count + 1 WHERE id = p_track_id;
END;
$$;

-- ─── Row Level Security (RLS) ───────────────────────
-- (The server uses the service-role key which bypasses RLS;
--  policies below mirror the phase 4 pattern.)

ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read on tracks"  ON tracks  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read on streams" ON streams FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on streams" ON streams FOR INSERT TO authenticated WITH CHECK (auth.uid()::TEXT = user_id);

-- ─── Private storage bucket for audio ───────────────
-- Private bucket: audio is only reachable through short-lived
-- signed URLs generated server-side, so tracks cannot be
-- permanently linked/downloaded.

INSERT INTO storage.buckets (id, name, public)
VALUES ('tracks', 'tracks', false)
ON CONFLICT (id) DO NOTHING;