-- ─────────────────────────────────────────────────────────
-- Landing page feed (the public artist's picture + video grid)
--
-- The feed is editable at runtime by the artist from the community
-- app (/landing-feed). Until this migration is applied the site
-- falls back to the static copy in src/lib/landing-feed.ts, so the
-- landing page keeps working either way.
--
-- Apply in the Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS landing_feed (
  id            TEXT PRIMARY KEY,
  -- Display order, ascending. Reassigned wholesale by the reorder endpoint.
  position      INTEGER NOT NULL DEFAULT 0,
  kind          TEXT NOT NULL CHECK (kind IN ('video', 'photo')),
  title         TEXT NOT NULL,
  -- Small grey line under the title in the media modal, e.g. 'Official video'.
  note          TEXT,
  -- Videos only: which player, and its id (NOT a full URL).
  provider      TEXT CHECK (provider IN ('youtube', 'vimeo')),
  provider_id   TEXT,
  -- Public URL shown until the visitor presses play. Either a Supabase
  -- storage URL or a path under /public (the seeded rows use /landing/…).
  poster_url    TEXT NOT NULL,
  -- Storage object to delete with the row. NULL for seeded rows, whose
  -- posters are files in /public rather than storage objects.
  poster_path   TEXT,
  -- The card's shape is derived from these, so they must be truthful.
  poster_width  INTEGER NOT NULL DEFAULT 16 CHECK (poster_width > 0),
  poster_height INTEGER NOT NULL DEFAULT 9  CHECK (poster_height > 0),
  alt           TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS landing_feed_position_idx ON landing_feed (position);

-- A video must carry a player and a photo must not, so a half-filled
-- row can never reach the page.
ALTER TABLE landing_feed DROP CONSTRAINT IF EXISTS landing_feed_kind_source_check;
ALTER TABLE landing_feed ADD CONSTRAINT landing_feed_kind_source_check CHECK (
  (kind = 'photo' AND provider IS NULL     AND provider_id IS NULL) OR
  (kind = 'video' AND provider IS NOT NULL AND provider_id IS NOT NULL)
);

-- Seed the feed with what is live on the site today, so the artist's
-- editor opens with the current six items already editable.
-- poster_path is NULL: these posters live in /public/landing, not in
-- storage, so deleting a seeded row must not try to remove a file.
INSERT INTO landing_feed
  (id, position, kind, title, note, provider, provider_id,
   poster_url, poster_path, poster_width, poster_height, alt)
VALUES
  ('animal',           0, 'video', 'Animal',              'Official video',      'youtube', '8LXIM0GbqPQ',  '/landing/video-animal.jpg',     NULL, 1280, 720,  'Animal — video still'),
  ('landmark',         1, 'photo', 'Landmark',            'Visualizer artwork',  NULL,      NULL,          '/landing/visualizer.jpg',      NULL,  880, 1566, 'Landmark visualizer artwork'),
  ('unholy',           2, 'video', 'Unholy',              NULL,                  'youtube', 'QlyBUD_RxiE',   '/landing/video-unholy.jpg',     NULL, 1280, 720,  'Unholy — video still'),
  ('dark-dance',       3, 'video', 'Dark Dance',          'Vimeo',               'vimeo',   '1032445716',   '/landing/video-dark-dance.jpg', NULL, 1280, 960,  'Dark Dance — video still'),
  ('tyb',              4, 'video', 'Touch Your Body (TYB)', NULL,                 'youtube', '-xAuL03StPU',  '/landing/video-tyb.jpg',        NULL, 1280, 720,  'Touch Your Body (TYB) — video still'),
  ('chant-and-wishes', 5, 'video', 'Chant And Wishes',    NULL,                  'youtube', 'oWF8kUp64tQ',  '/landing/video-chant.jpg',      NULL, 1280, 720,  'Chant And Wishes — video still')
ON CONFLICT (id) DO NOTHING;
