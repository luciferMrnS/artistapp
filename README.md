# Kendrick David — Artist Community

Artist community site built with **Next.js 16** (App Router) + **Supabase**
(Postgres, Auth, Storage). Includes an artist feed, auth with email
verification, likes/comments, subscriptions, music tracks with stream
counting and a player seek bar, themed media pages, direct messages,
notifications, live-status, and real-time "fans online" presence.

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind CSS v4)
- Supabase Postgres (data), Auth (email confirm / password reset), Storage (uploads)
- Custom server auth: bcrypt password hashing + signed JWT cookie sessions

## Local development

1. Copy `.env.example` to `.env.local` and fill in the real values.
2. Install and run:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

> Data always lives in the hosted Supabase project (there is no local
> database). Schema is versioned as SQL in `database/` — apply new migrations
> in the Supabase SQL Editor.

## Environment variables

See `.env.example` for the full list. Required at runtime:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_APP_URL` | Public base URL (used for metadata, sitemap, email redirects) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Public key — safe in the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key — **server only**, never expose or commit |
| `JWT_SECRET` | Signs app session cookies (long random string in prod) |

Optional: `LIVE_*` vars enable live streaming; without them the live page
shows "Live soon". `E2E_ARTIST_PASSWORD` is used by `e2e_test.ps1`.
`RESEND_API_KEY` (and a verified `RESEND_FROM` sender) enable the dashboard's
"Send newsletter" tool; the free tier needs a verified domain, otherwise
`onboarding@resend.dev` only reaches your own inbox.

`.env*` files are gitignored.

## Deploy on Render

The app keeps using the **same Supabase database** in production — nothing is
stored locally, so fans, posts, tracks, and storage carry over automatically.

1. Push this repo to GitHub (it is checked out on branch `main`).
2. In Render, create a **Web Service** from the repo (or use the Blueprint tab,
   which reads `render.yaml`). Defaults already match:
   - Build command: `npm run build`
   - Start command: `npm run start` (honors Render's `$PORT`, binds `0.0.0.0`)
3. Set the same env vars as your dev `.env.local` in Render
   (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `JWT_SECRET`, and `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_APP_URL` =
   `https://<your-app>.onrender.com`).
4. In the **Supabase dashboard → Authentication → URL Configuration**:
   - Site URL: `https://<your-app>.onrender.com`
   - Redirect URLs: add `https://<your-app>.onrender.com/auth/callback`
     and `https://<your-app>.onrender.com/auth/update-password`
   - (Dev/localhost entries can stay alongside.)
5. Confirm SMTP is configured (Authentication → Emails) so confirmation and
   password-reset emails actually send.

Optional: run Render in a region close to your Supabase project for lower
latency. Enable Supabase **Pro** for automated daily backups (the free tier
has none and pauses the project after 7 days of inactivity).

A `Dockerfile` (multi-stage, non-root, standalone output) is included for
self-hosting; `vercel.json` is included for Vercel as an alternative.