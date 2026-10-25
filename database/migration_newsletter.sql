ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS newsletter_opt_out_at TIMESTAMPTZ;
