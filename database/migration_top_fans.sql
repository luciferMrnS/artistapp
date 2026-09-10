-- Top fans leaderboard
-- Adds an accumulated "logged in" counter to the existing presence table so
-- the Top Fan ranking can weigh how long a fan has been online, alongside
-- their likes, comments and creed (chat) interactions.
--
-- Every presence heartbeat adds the minutes elapsed since the previous
-- heartbeat (capped server-side), so the tally grows only while the tab is
-- actually open.
--
-- Apply this in the Supabase SQL Editor like the other migrations. Until it's
-- applied the app degrades gracefully: the Top Fan tab shows an empty
-- leaderboard and the online-minutes sorting factor stays at zero.

alter table public.user_presence
  add column if not exists online_minutes integer not null default 0;