-- ─────────────────────────────────────────────────────────
-- Landing feed: release date + description
--
-- /music/[id] existed with a title, a poster and no body copy,
-- which is not enough text for a search engine to rank. This
-- adds the two fields that make the page a real page:
--
--   released_on  a plain calendar date, for datePublished in the
--                structured data and a visible line on the page.
--                Not a timestamp: a release has a day, not a
--                moment, and TIMESTAMPTZ here would drag a
--                timezone into every read.
--   description  the paragraph the artist writes about the
--                release. This is the copy that actually matters.
--
-- Both are nullable, so existing rows keep rendering and the
-- page still says something useful without them.
--
-- Apply in the Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────

ALTER TABLE landing_feed
  ADD COLUMN IF NOT EXISTS released_on DATE,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- A date is a date: no time, no timezone, not '2024-13-45'. The
-- column type already rejects a malformed value on insert, but
-- ISO-8601 text can still sneak past with a time or a
-- single-digit month, and JSON-LD would then carry a value
-- Rich Results rejects.
ALTER TABLE landing_feed DROP CONSTRAINT IF EXISTS landing_feed_released_on_check;
ALTER TABLE landing_feed ADD CONSTRAINT landing_feed_released_on_check CHECK (
  released_on IS NULL OR released_on = DATE(released_on::text)
);

-- The editor is the only writer, and it caps the field, but the
-- column is the last line of defence against a paragraph that
-- would blow out the page and the structured data with it.
ALTER TABLE landing_feed DROP CONSTRAINT IF EXISTS landing_feed_description_len_check;
ALTER TABLE landing_feed ADD CONSTRAINT landing_feed_description_len_check CHECK (
  description IS NULL OR char_length(description) <= 1200
);
