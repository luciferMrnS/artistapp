-- ─────────────────────────────────────────────────────────
-- Phase 4: Likes, Comments & Follow
-- Tables: users (add role column), posts, likes, comments, follows
-- ─────────────────────────────────────────────────────────

-- Add role column to existing users table (if it doesn't exist yet)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'fan' CHECK (role IN ('artist', 'fan'));

-- Create posts table (only the artist can create posts)
CREATE TABLE IF NOT EXISTS posts (
  id              TEXT PRIMARY KEY,
  author_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  image           TEXT,
  likes_count     INTEGER NOT NULL DEFAULT 0,
  comments_count  INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create likes table (fans like posts)
CREATE TABLE IF NOT EXISTS likes (
  id         TEXT PRIMARY KEY,
  post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, user_id)  -- Prevent duplicate likes
);

-- Create comments table (fans comment on posts)
CREATE TABLE IF NOT EXISTS comments (
  id         TEXT PRIMARY KEY,
  post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create follows table (fans follow the artist)
CREATE TABLE IF NOT EXISTS follows (
  id            TEXT PRIMARY KEY,
  follower_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(follower_id, following_id)  -- Prevent duplicate follows
);

-- ─── Indexes for performance ────────────────────────

CREATE INDEX IF NOT EXISTS idx_posts_author    ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created   ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_post      ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user      ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post   ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user   ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower  ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- ─── Helper RPC: increment/decrement a post counter ─

CREATE OR REPLACE FUNCTION increment_post_counter(
  post_id  TEXT,
  col_name TEXT,
  increment INT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF col_name = 'likes_count' THEN
    UPDATE posts SET likes_count = likes_count + increment WHERE id = post_id;
  ELSIF col_name = 'comments_count' THEN
    UPDATE posts SET comments_count = comments_count + increment WHERE id = post_id;
  END IF;
END;
$$;

-- ─── Row Level Security (RLS) ───────────────────────
-- Enable RLS on all tables
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read everything
CREATE POLICY "Allow authenticated read on posts"     ON posts     FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read on likes"     ON likes     FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read on comments"  ON comments  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read on follows"   ON follows   FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert their own interactions
CREATE POLICY "Allow authenticated insert on likes"     ON likes     FOR INSERT TO authenticated WITH CHECK (auth.uid()::TEXT = user_id);
CREATE POLICY "Allow authenticated insert on comments"  ON comments  FOR INSERT TO authenticated WITH CHECK (auth.uid()::TEXT = user_id);
CREATE POLICY "Allow authenticated insert on follows"   ON follows   FOR INSERT TO authenticated WITH CHECK (auth.uid()::TEXT = follower_id);

-- Allow users to delete their own likes, comments, and follows
CREATE POLICY "Allow authenticated delete on likes"     ON likes     FOR DELETE TO authenticated USING (auth.uid()::TEXT = user_id);
CREATE POLICY "Allow authenticated delete on comments"  ON comments  FOR DELETE TO authenticated USING (auth.uid()::TEXT = user_id);
CREATE POLICY "Allow authenticated delete on follows"   ON follows   FOR DELETE TO authenticated USING (auth.uid()::TEXT = follower_id);

-- Allow authenticated users to insert posts — note: the application layer
-- additionally enforces that only the artist can create posts.
CREATE POLICY "Allow authenticated insert on posts"     ON posts     FOR INSERT TO authenticated WITH CHECK (true);

-- ─── Seed the artist user ──────────────────────────
-- Seeds Kendrick David as the artist account.
-- The password is a generated, random credential (rotated 2026-09-09); only
-- its bcrypt hash is stored here. Never paste the plaintext password into
-- code, comments, or docs that could reach a repo.
-- To regenerate a hash for a new password:
--   node -e "console.log(require('bcryptjs').hashSync('<password>', 10))"
INSERT INTO users (id, email, username, password_hash, avatar, role, created_at)
VALUES
  (
    'artist_kendrickdavid',
    'kendrick@kendrickdavid.com',
    'kendrickdavid',
    '$2b$10$hje.wxopzQS.ZRFoNzk8/OLBhknN9yqX1YrnRgFL1h46QK6K.4wGq',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    'artist',
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  username = EXCLUDED.username,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role;
