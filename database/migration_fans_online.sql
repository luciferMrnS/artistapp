-- Fans online / presence
-- Tracks the last-seen time of every authenticated user so the app can
-- show an accurate, real-time "fans online" count (a user counts as online
-- while their heartbeat is fresher than the online window on the server).
--
-- Apply this in the Supabase SQL Editor like the other *_phase* migrations.
-- The rest of the app degrades gracefully (count stays 0) until applied.

create table if not exists public.user_presence (
  user_id text primary key references public.users (id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

create index if not exists user_presence_last_seen_idx
  on public.user_presence (last_seen_at desc);