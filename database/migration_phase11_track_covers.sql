-- ─────────────────────────────────────────────────────────
-- Phase 11: Track album covers
-- Adds an optional cover_image to the tracks table.
-- Covers live in the existing private "tracks" storage bucket
-- (path: <artist_id>/covers/<name>) and are served via the
-- same short-lived signed URLs as the audio, so they cannot
-- be permanently linked/downloaded.
-- ─────────────────────────────────────────────────────────

ALTER TABLE tracks
  ADD COLUMN IF NOT EXISTS cover_path TEXT;