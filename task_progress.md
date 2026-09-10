# Phase 4 Implementation: Likes, Comments & Follow

## Overview
- Only the artist (Kendrick David) can create posts
- Fans can only interact: like, comment, follow
- Data stored in Supabase PostgreSQL
- Built and verified: `npx tsc --noEmit` passes, `npx next build` passes

## Completed Steps

### Database Layer (src/lib/db.ts)
- Extended `StoredUser` with `role: "artist" | "fan"` field
- Added interfaces: `Post`, `PostWithAuthor`, `Like`, `Comment`, `CommentWithAuthor`, `Follow`
- All CRUD functions: `getAllPosts`, `getPostsByAuthor`, `getPostById`, `createPost`, `likePost`, `unlikePost`, `hasUserLikedPost`, `getLikesForPost`, `getCommentsForPost`, `createComment`, `deleteComment`, `followUser`, `unfollowUser`, `isFollowing`, `getFollowCounts`, `getFollowers`, `getFollowing`, `getArtistUser`

### Migration SQL (database/migration_phase4.sql)
- Creates tables: posts, likes, comments, follows (with role column on users)
- Indexes for performance
- Postgres RPC function `increment_post_counter` (with read-then-update fallback)
- RLS policies on all new tables
- Artist seed: `kendrick@kendrickdavid.com` (password stored as a bcrypt hash only — never kept in the repo)

### Server-side Auth (src/lib/server-auth.ts)
- JWT now includes `role` field
- `createToken` takes 3 args (userId, email, role)
- `formatUserResponse` includes role

### API Routes (All server-side, cookie-authenticated)
- `GET /api/posts` — Fetch all posts with author info
- `GET /api/posts/[id]` — Fetch single post
- `POST /api/posts/create` — Create post (artist-only enforced)
- `GET/DELETE /api/posts/[id]/likes` — Like/unlike posts
- `GET/POST /api/posts/[id]/comments` — List/add comments
- `DELETE /api/posts/[id]/comments` — Delete comment (author only)
- `GET/POST/DELETE /api/follow` — Follow/unfollow/check status

### UI Components
- `LikeButton` — Heart animation, optimistic update, toggle like/unlike
- `CommentSection` — Expandable comment list, add/delete comments
- `FollowButton` — Toggle follow/unfollow, shows follower count (artist only)
- `CreatePostForm` — Artist-only post creation form with auto-refresh

### Pages Updated
- `page.tsx` — Server-side fetch of posts with like/follow status, conditionally shows CreatePostForm for artist
- `create/page.tsx` — New page for artist post creation + existing posts
- `auth/signup/page.tsx` — Added username field, artist signup toggle with signup key
- `auth/login/page.tsx` — Unchanged (works with new role-aware backend)
- `Sidebar.tsx` — Conditional "Post" button (artist only), shows role badge

### Client-side Auth
- `AuthContext.tsx` — Works with role field from User interface
- `lib/auth.ts` — User interface now includes `role: UserRole`

## How to Run
1. Run the migration SQL in your Supabase SQL Editor: `database/migration_phase4.sql`
2. Start the dev server: `npm run dev`
3. Artist login: `kendrick@kendrickdavid.com` (see credentials note in the seed migration comment)
4. Fans signup at `/auth/signup` (default role: fan)
5. Artist creates posts at `/create`
6. Fans can like, comment, and follow from the home feed

## Verification Log (2026-09-05)

### Passed
- `npx tsc --noEmit` — clean, zero type errors
- `npx next build` — production build succeeds (15 routes: `/`, `/create`, auth pages, and all API routes)
- Dev server boots cleanly on `localhost:3000`
- API auth guard works as designed (unauthenticated requests return 401; fan post-creation correctly 403 blocked once DB is present)

### BLOCKER — database migration not yet applied
End-to-end API verification failed because the Phase 4 schema is **not present** in the connected Supabase project:

- `users` table exists (from earlier phases) but has **no `role` column** → `column users.role does not exist`
- `posts`, `likes`, `comments`, `follows` tables are missing → `PGRST205 Could not find the table ... in the schema cache`
- Artist seed user (`kendrick@kendrickdavid.com`) is absent
- Consequence until applied: artist login returns 401, all like/comment/follow endpoints return 4xx

**Action required:** run `database/migration_phase4.sql` in the Supabase SQL Editor, then re-verify with `pwsh -File e2e_test.ps1`.

> Note: if you ever re-run the migration, the `CREATE POLICY` statements are not idempotent — drop existing policies first or run the script once only.

### Bug fixed during verification
The seed bcrypt hash in `database/migration_phase4.sql` did **not** match the documented password
(verified with `bcryptjs.compareSync`). It was replaced with a freshly generated, verified `$2b$` hash.
Without this fix, the artist would not have been able to log in even after the migration was applied.

### New verification harness
`e2e_test.ps1` — 14-step end-to-end API test (artist login → post create → fan signup → fan blocked from posting →
like → comment → follow → feed/comments/follow-status GETs → comment delete → unlike → `/api/auth/me` → 401 guard).
Run it with `pwsh -File e2e_test.ps1` after the migration is applied and the dev server is running.

### Re-test (2026-09-05, later same day)
- Dev server boots cleanly on `localhost:3000` (Next.js 16.3.4 / Turbopack, ready in 4.9s)
- `pwsh -File e2e_test.ps1` re-run: **1/14 passed** — same failure signature as before
- Confirmed the Phase 4 schema is still **not applied** in Supabase:
  - Artist login → 401 `Invalid email or password` (seed artist absent)
  - Fan signup → 400 `Could not find the 'role' column of 'users' in the schema cache`
  - All authenticated endpoints → 401 (cascading from login failures)
- **Blocker unchanged:** `database/migration_phase4.sql` must be run in the Supabase SQL Editor before Phase 4 can be verified end-to-end.

### Full verification (2026-09-05, final) — ✅ 14/14 PASSED
Migration was applied to Supabase; Phase 4 verified end-to-end:

- `pwsh -File e2e_test.ps1`: **14/14 passed** (artist login → post create → fan signup →
  fan 403-blocked → like → comment → follow → feed/comments/follow-status GETs →
  comment delete → unlike → `/api/auth/me` → 401 guard)
- `npx tsc --noEmit` — clean
- Home page (`/`) and `/create` load as artist with HTTP 200, feed renders posts, no errors in dev log

### Bugs fixed during this verification
1. **Server → Client Component function props** (`src/app/page.tsx:106`, `src/app/create/page.tsx:82`):
   Server Components passed `onPostCreated={() => {}}` to the client `CreatePostForm`,
   throwing "Event handlers cannot be passed to Client Component props". Prop removed
   (it is optional and redundant — the form already reloads via `window.location.reload()`).
2. **Signup hard-blocked by transient DNS failures** (`src/lib/email-validation.ts`):
   MX lookup (`dns.resolveMx`) failed with `ESERVFAIL` inside the dev-server process
   (shell DNS worked fine), falsely rejecting all signups with
   "Email domain does not accept mail". `hasMXRecords` now:
   - falls back to A/AAAA records (RFC 5321 implicit MX) when MX lookup fails or is empty
   - **fails open** on transient resolver errors (`ESERVFAIL`, timeouts) with a warning
   - still rejects genuinely nonexistent domains (`ENOTFOUND` is not transient)
3. Dev server restarted to clear the stale process with the broken resolver state.

### Phase 4 status: COMPLETE — verified, ready to move to next phase

### Demo picture feed (2026-09-05, follow-up)
- `CreatePostForm` "Add photo" is now functional: toggles a URL input with live
  preview + remove button; image is sent as `image` in the POST body
  (the API/DB already supported the `image` column — only the form was missing it).
- `Post` component already rendered `image` (with `placehold.co` fallback on error);
  both feed pages already pass `post.image` through — no changes needed there.
- Seeded 3 demo posts with images. Images are **local SVGs** in `public/demo/`
  (`studio.svg`, `live.svg`, `vinyl.svg`) instead of remote URLs, because
  `picsum.photos` redirects to `fastly.picsum.photos`, which failed DNS in this
  environment. `database/update_demo_images.mjs` (one-off script) repointed the
  seeded rows at the local files.
- Verified: SVGs serve as `image/svg+xml` (200); home page HTML contains exactly
  3 `/demo/*.svg` references, 0 remote `picsum.photos` references.

### Follow → Subscribe rework (2026-09-05)
- **Follow button scrapped from posts**: `FollowButton` component deleted;
  removed from `Post.tsx` along with the now-unused `userFollowing` prop and the
  per-post `isFollowing` enrichment in both feed pages (saves 1 DB query per post).
  The `/api/follow` backend endpoints remain (the subscribe button uses them,
  and `e2e_test.ps1` still exercises them).
- **New animated `SubscribeButton`** (`src/components/feed/SubscribeButton.tsx`,
  framer-motion) placed in the home header next to the "Kendrick David" title:
  - idle: animated primary→pink gradient shimmer + periodic sweeping shine + bell wiggle
  - hover/tap: spring scale up/down
  - subscribed: swaps to "Subscribed ✓" with vertical label roll + spring check-in
    + pulsing ring; shows live subscriber count badge
  - hidden when the artist views their own feed; status/toggle via
    `GET/POST/DELETE /api/follow`
- Lint errors fixed while in these files: unescaped apostrophe on login page,
  `any[]` fallbacks in both feed pages replaced with proper types.
- Verified: `tsc --noEmit` clean, `npm run lint` 0 errors (15 pre-existing warnings),
  `next build` succeeds, follow API round-trip (GET/POST/DELETE) confirmed live,
  no runtime errors in dev log after fresh page loads.

### Subscribe-once semantics (2026-09-05)
- Confirmed toggle behavior end-to-end: subscribe → `following:true`, subscribe
  again → still one row / unchanged count (DB `UNIQUE(follower_id, following_id)`
  + `23505` handled as success in `followUser`), unsubscribe → `following:false`.
- Hardened `POST /api/follow`: explicit `isFollowing` pre-check now returns the
  current state (with `alreadySubscribed: true`) before any insert attempt —
  the unique constraint remains the race-condition backstop.
- UI: the button itself is a toggle — first click subscribes ("Subscribed ✓"),
  second click unsubscribes (`DELETE`); `isLoading` guards double-clicks.

### Email verification via Supabase Auth (2026-09-05)
Identity + verification migrated to Supabase Auth; app sessions remain the
custom JWT cookie so all other API routes are untouched.

- **Signup**: validates as before → `supabase.auth.signUp` (cookie-backed
  @supabase/ssr client, PKCE verifier stored) → Supabase emails the
  confirmation link (`emailRedirectTo: <app>/auth/callback`) → creates the
  `public.users` profile row unverified (`password_hash: null`,
  `email_verified: false`). No session cookie issued.
- **Confirmation**: `GET /auth/callback` exchanges the PKCE code, syncs the
  profile (`email_verified: true`), issues the JWT cookie, redirects to `/`.
- **Login**: `signInWithPassword` gates on confirmation — unverified accounts
  get `403 { code: "EMAIL_NOT_VERIFIED" }`; on success the profile is synced
  and JWT issued. Legacy bcrypt fallback keeps pre-migration accounts
  (incl. the seeded artist) working.
- **Resend**: `POST /api/auth/resend-verification` (generic response, no
  account enumeration). Signup success panel and login banner both offer it.
- **Migration**: `database/migration_email_verification.sql` — adds
  `supabase_auth_id` + `email_verified` to `public.users`, grandfathers
  existing accounts. **Not yet applied — blocks signup/login of new users.**
- **Dashboard config required** (cannot be done via SQL): Confirm email ON;
  Site URL `http://localhost:3000`; Redirect URL `http://localhost:3000/auth/callback`.
- **e2e**: now 16 steps — signup (no session) → unverified login blocked →
  admin-API auto-confirm (User-Agent must not look like a browser; Supabase
  rejects secret keys with browser-like UAs) → fan login → rest unchanged.
- Verified live: legacy artist login 200; unverified login → 403
  EMAIL_NOT_VERIFIED; wrong creds → 401; confirmed login works once columns
  exist; `tsc` clean; `next build` passes (incl. `/auth/callback`).

### Artist ownership lock (2026-09-05)
- `ARTIST_SIGNUP_KEY` added to `.env.local` — artist-role registration now
  requires the secret key (previously unset ⇒ anyone could register as artist).
- Verified: rogue artist signup with wrong key → 403.

### Story pages (2026-09-05)
- The five home-feed highlight cards are now links → `/stories/[slug]`
  (hover lift + icon + primary tint).
- `src/lib/stories.ts` — shared story data (slug, name, gradient tone,
  tagline, description, lucide icon) used by both the feed cards and pages.
- `src/app/stories/[slug]/page.tsx` — dynamic route, unknown slugs 404.
  Gradient hero (matching card tone) + tagline + themed body:
  - **new-drop**: featured latest post with artwork + more posts
  - **behind-the-scenes**: recent posts
  - **live-now**: pulsing live panel with "Join live" CTA
  - **fan-club**: live subscriber count from `getFollowCounts` + perks +
    animated `SubscribeButton`
  - **studio**: recent posts feed
  - all: "Explore more" cross-links to the other stories
- Verified: all 5 slugs → 200, bogus slug → 404, fan-club subscriber panel and
  new-drop artwork present in payload, home links to all 5, no dev-log errors,
  `tsc` clean, production build passes (`/stories/[slug]` in route table).

### Phase 6 chat migration — applied & made idempotent (2026-09-06)
- Fan-club chat ("text function") never worked: `messages` table was missing in
  Supabase — `GET /rest/v1/messages` returned `404 PGRST205`.
- User attempts at `database/migration_phase6.sql` failed twice in SQL Editor:
  - `42601` on `ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS
    messages` (PG < 15) → replaced with a `DO $$` block guarded by
    `pg_publication_tables`.
  - `42710` "policy ... already exists" → added `DROP POLICY IF EXISTS` before
    each `CREATE POLICY`.
- Verified live: `messages` table now 200; `users.supabase_auth_id` +
  `email_verified` columns 200 (email-verification migration applied). Chat
  back-end confirmed working.

### GIF messaging removed (2026-09-06)
- Root cause of GIF failures: `RAPIDAPI_KEY` gets 403 "You are not subscribed to
  this API." for humor-jokes-and-memes, tenor, and giphy hosts;
  `api.giphy.com` times out from this env. Profile lacks any GIF subscription.
- Per user decision, GIFs are removed: GIF button + search panel + state +
  `searchGifs`/`sendGif` deleted from `FanCommunity.tsx`; `/api/gif` route
  deleted. `message_type: "gif"` stays in the type + `<img>` renderer so image
  messages still work. `RAPIDAPI_KEY` now unused.
- Verified: `tsc` clean, eslint 0 errors (15 pre-existing warnings).

### Email-confirm password change (2026-09-06)
User chose **type once, no re-entry**: the new password is staged (encrypted),
applied automatically when the emailed link is clicked. Legacy accounts (artist)
keep the direct current-password change (no email channel).

- **Migration**: `database/migration_password_recovery.sql` — `password_change_tokens`
  table (encrypted new password, 30-min single-use token, RLS admin-key).
  **Not yet applied — blocks the email-confirm flow.**
- **Staging**: `POST /api/profile/password` — for Supabase Auth accounts, verifies
  current password via `signInWithPassword`, then `createPasswordChangeToken` +
  `resetPasswordForEmail` (cookie-backed client, redirect → `/auth/update-password`).
  Returns `{ success, requiresEmailConfirmation, message }`. Email-send failure
  deletes staged tokens. Legacy path unchanged (`updateLegacyUserPassword`).
- **Apply**: `GET /auth/update-password` — PKCE `exchangeCodeForSession` (mirrors
  `/auth/callback`), decrypts pending token, `updateSupabaseAuthPassword`,
  consumes token, clears `auth-token` cookie, redirects to
  `/auth/login?password=changed` (failure → `?password_confirm=failed`).
- **Encryption**: AES-256-GCM, key = sha256(`JWT_SECRET`);
  stored format `iv.tag.cipher` base64 joined by `.`.
- **Signup hardening**: removed the `data.session` auto-login/auto-verify branch —
  signup now ALWAYS returns `requiresVerification: true` even if the project's
  "Confirm email" toggle is off.
- **Login hardening**: gates sign-in on `email_verified === false` → `403
  EMAIL_NOT_VERIFIED`, except when Supabase itself reports `email_confirmed_at`
  (genuinely confirmed, stale profile row) which syncs and allows. Granfathering
  keeps the artist + pre-migration accounts safe.
- **UI**: profile page shows the confirmation-email message; login page shows
  banners for `?password=changed` / `?password_confirm=failed` (render-phase URL
  read per `react-hooks/set-state-in-effect`).
- Verified: `tsc` clean, `npm run lint` 0 errors (15 pre-existing warnings),
  `next build` succeeds (`/auth/update-password` in route table), live probes
  200 for `messages` / `users` verification columns, 404 for `password_change_tokens`
  (migration pending).
- **Action required**: run `database/migration_password_recovery.sql` in the
  Supabase SQL Editor; keep Confirm-email + redirects configured as above.

### Live verification + a found bug (2026-09-06)
- Probes against the live project: `messages` 200, `users` verification columns
  200, `password_change_tokens` 200 (migration applied) — all three migrations
  now in place.
- **Bug found**: `password_hash` is `NOT NULL` (phase 4 schema), but
  `createUnverifiedUser` inserted `null` → any first-time
  login/callback/signup for a Supabase Auth account 500'd
  ("null value in column password_hash"). From `migration_email_verification.sql`
  onward the design is "password lives in Supabase Auth", so the fix is
  `password_hash: ""` — a non-hash empty string is falsy and the legacy bcrypt
  path skips it. Verified:   Supabase-fan login now 200 + JWT cookie.
- **Email confirm password change verified live** (via
  `pwflowtest2@kendrickdavid.com`, Supabase admin-created + `email_confirm`,
  cleaned up after): login 200 → `POST /api/profile/password`
  ({currentPassword,newPassword}) stages a token and calls
  `resetPasswordForEmail`; on send failure the staged tokens are deleted
  (idempotent re-try). The route hit **Supabase's sandbox SMTP rate limit**
  (`over_email_send_rate_limit`, a few emails/hour) — that is host throttling,
  not a code bug; retries are safe. The literal email round-trip
  (click link → `/auth/update-password` → apply → redirect) still needs a real
  inbox + a browser holding the PKCE verifier cookie, so it is left as a manual
  step on the user's machine.
- Note: `example.com` (and other disposable domains) is rejected by Supabase's
  auth email validation — use a real-looking domain for manual tests.
- Login-page result banners (`?password=changed` / `?password_confirm=failed`)
  confirmed rendering via headless browser (hydration-timed read).
- `task_progress` cleanup: removed both `pwflowtest*` auth users + profiles.



### Phase 8: Notifications (2026-09-09)
- `database/migration_phase8_notifications.sql` — `notifications` table
  (id, user_id→users cascade, type like/comment/follow/post, actor_id→users set
  null, post_id→posts cascade, read, created_at), indexes on
  (user_id, created_at DESC) and partial unread (WHERE NOT read), RLS read/update
  own. **Not yet applied — until then notifications are empty and best-effort.**
- `src/lib/db.ts`: `Notification`/`NotificationWithActor` types + best-effort
  `createNotification` (never throws). Hooked into `likePost`, `createComment`
  (notify post author), `followUser` (notify followed user), and `createPost`
  (notify all followers). `getNotifications`, `getUnreadNotificationCount`,
  `markNotificationsRead` — all tolerate a missing table (`PGRST205`/message
  "Could not find the table" => no-op success) so like/comment/follow/post flows
  can never be broken by notifications.
- API: `GET /api/notifications` (list + unreadCount), `POST /api/notifications/read`
  (single `{id}` or all).
- UI: `src/app/notifications/page.tsx` renders live feed
  (`src/components/notifications/NotificationsFeed.tsx`) with per-type icon/
  color, actor avatar/name, relative time, link to the post. Sidebar Bell shows
  a red unread badge, polled every 30s.
- New `src/app/post/[id]/page.tsx` — single-post page so notification links
  resolve (was 404 before).
- Previously-placeholder `/messages` keeps its "Coming soon" shell (Phase 8/Messages pending).
- Verified: `tsc` clean, eslint 0 errors (warnings only: pre-existing `<img>`
  + unused `supabase`/`password_hash` in db.ts), `next build` passes (all new
  routes in table), live probes: `/api/notifications` 200 empty, like round-trip
  200, `/api/notifications/read` 200, `/notifications` 200, `/post/[id]` 200.
- **Action required**: run `database/migration_phase8_notifications.sql` in the
  Supabase SQL Editor to enable real notifications (likes/comment/follow/post
  creation will then fan out to the notifications table).

### Requested nav cleanup (2026-09-09)
- Removed Reels, Likes, and Explore from `Sidebar.tsx` nav (user: not relevant).
- Dead sidebar links `/notifications` and `/messages` (404) now render
  in-app placeholder pages; notifications page upgraded to the real feed above.
- `tsc` clean, lint 0 errors (same pre-existing warnings).

### Phase 8: Artist dashboard/stats (2026-09-09)
- New `src/app/dashboard/page.tsx` — artist-only (fans 307 -> "/", anon ->
  /auth/login): stat cards (Followers, Monthly listeners, Posts, Engagement %,
  Total likes, Total comments, Track plays), "Biggest fans" leaderboard ranked
  by likes+comments with medal/stats bars, and per-post "Post performance"
  list with mini engagement bars.
- `src/lib/db.ts` — new `getArtistStats()` aggregates posts/likes/comments/
  follows/tracks/streams in one Promise.all + builds the top-fans leaderboard.
- Sidebar: `BarChart3` "Dashboard" nav item shown only when role === "artist"
  (navItems gained an `artistOnly` flag).
- Verified: tsc clean, eslint 0 errors (pre-existing warnings), next build
  passes (`/dashboard` in route table), live probes: artist /dashboard 200 with
  both sections, minted fan JWT -> 307 /, anonymous -> 307 /auth/login.

### Phase 9: Direct messages (2026-09-09)
- `database/migration_phase9_dm.sql` — `direct_messages` table
  (id, conversation_id, sender_id/recipient_id -> users CASCADE,
  content, media_url, read, created_at), indexes on
  (conversation_id, created_at) + partial recipient-unread, RLS read/send/
  mark-read. **Not yet applied — until then the DM API returns
  "Direct messages are not set up yet" (503) on send and empty lists on read.**
- `src/lib/db.ts`: `isTableMissing()` helper (PGRST205/42P01 handled
  centrally; `markNotificationsRead` now reuses it). New DM layer:
  `sendDirectMessage` (implicit conversation via deterministic `dm_<a>_<b>`
  id), `getConversations` (latest message + other-user profile + unread
  counts), `getDirectMessages` (participant-only), `markConversationRead`,
  `getUsersForDirectMessage`.
- API: `GET /api/dm/conversations`, `GET/POST /api/dm/messages`,
  `POST /api/dm/read`, `GET /api/dm/users` — all cookie-authenticated.
- UI: `/messages` replaced its "Coming soon" shell with a two-pane inbox
  (`src/components/messages/DirectMessages.tsx`): conversation list with
  avatar/preview/time + unread badges, chat window with bubbles, "New"
  button with searchable user picker, 4s polling for the active thread that
  auto-marks it read. Sidebar Mail icon shows a blue unread badge (30s poll,
  same effect as notifications).
- Verified: tsc clean, eslint 0 errors (pre-existing warnings only), next
  build passes (4 new DM routes), live probes: /messages 200 (no placeholder),
  /api/dm/users 200, /api/dm/conversations 200 [], send -> 503
  "not set up yet" (migration pending, as designed).
- **Action required**: run `database/migration_phase9_dm.sql` in the Supabase
  SQL Editor to enable direct messages.

### Phase 10: Themed media pages (2026-09-09)
- Home "Highlights" cards already link each theme to its page; the three
  themes (new-drop / behind-the-scenes / studio) now support audio, video
  and photo uploads, with copy addressing each topic.
- `database/migration_phase10_theme_media.sql` — `theme_media` table
  (theme enum, media_type audio/video/photo, title, caption, storage_path,
  mime_type, size_bytes, created_at) + public "theme-media" storage bucket.
  **Not yet applied — until then uploads return 503 "Theme media is not set up yet".**
- `src/lib/db.ts`: `uploadThemeMedia` (uploads to public bucket, inserts row,
  deletes the file if the row insert fails), `getThemeMedia` (newest first via
  public URLs), `ensureThemeMediaBucket`. Missing-table safe.
- `src/app/api/theme-media/route.ts` — GET ?theme= (any authenticated),
  POST (artist-only): theme/mediaType validation, MIME↔type matching,
  size limits (photo 10MB / audio 30MB / video 100MB).
- `src/components/media/ThemeMediaSection.tsx` — artist upload form (file
  input auto-detects photo/audio/video, title + caption)
  + responsive gallery rendering photos / `<video controls>` / `<audio controls>`
  with per-theme headings + hints.
- `src/app/stories/[slug]/page.tsx` renders the section on the three themes only.
- Verified: tsc clean, eslint 0 errors (pre-existing warnings), next build
  passes (`/api/theme-media` in table), live probes: three themed pages 200 +
  media GET 200 [], live-now/fan-club media GET -> 400 "Invalid theme",
  artist upload round-trip -> 503 "Theme media is not set up yet".
- **Action required**: run `database/migration_phase10_theme_media.sql` in the
  Supabase SQL Editor to enable uploads.

### Themed pages: exclusive content (2026-09-09)
- Home feed removed from new-drop / behind-the-scenes / fan-club / studio.
- `src/app/stories/[slug]/page.tsx` only fetches posts for live-now; posts
  section renders for live-now only ("From the room"). Old themed headings
  (Latest drop / Recent moments / Members feed / From the studio) removed.
- new-drop / behind-the-scenes / studio now show ONLY their themed media gallery.
  fan-club shows only the subscription panel.
- Verified: tsc clean, eslint 0 errors, build passes, live probes confirm no
  feed text on the four pages, live-now keeps feed + "From the room" heading.

### Phase 11: Track album covers (2026-09-09)
- Home-feed music card upload now accepts an optional album cover.
- `database/migration_phase11_track_covers.sql` — `ALTER TABLE tracks ADD COLUMN cover_path TEXT`.
  **Not yet applied** — until then cover uploads return "Album cover support is not set up yet." (400)
  and the audio file uploaded alongside is cleaned up; audio-only uploads keep working.
- `src/lib/db.ts`: Track + TrackWithSignedUrl gain `cover_path` / `cover_url`;
  `createTrack` accepts an optional cover path and only sets the column when present
  (insert stays compatible pre-migration); signed URL list includes covers.
- `src/app/api/tracks/route.ts`: POST accepts optional `cover` (image/*, ≤5 MB),
  uploads to the private tracks bucket at `<userId>/covers/<name>`, cleans up all
  files on partial failure, friendly pre-migration message.
- `src/components/music/TrackUploader.tsx`: album-cover picker with thumbnail preview
  + remove button, client-side size check.
- `src/components/music/MusicSection.tsx`: each track row shows the cover thumbnail
  (or a Music2 icon placeholder). `src/app/page.tsx` maps `cover_url`.
- Verified: tsc clean, eslint 0 errors, build passes; live: audio-only upload 201,
  cover upload -> 400 friendly message (pre-migration), tracks list shows
  `cover_url: null`. Test track cleaned up.
- **Action required**: run `database/migration_phase11_track_covers.sql` in the
  Supabase SQL Editor to enable covers.

### Track player: hidden gauge, digital countdown (2026-09-09)
- Home-feed music rows no longer use native audio controls (gauge hidden).
- `src/components/music/TrackPlayer.tsx` — custom minimal player: round
  play/pause button + a digital time countdown (-m:ss, tabular figures)
  that is rendered but invisible (opacity-0) and only shows while the
  track is actually playing; audio element is display:none-style hidden.
  Keeps cross-track pausing + one stream count per session via callbacks.
- `src/components/music/MusicSection.tsx` uses TrackPlayer; audioEls registry
  handled through a registerRef callback (element removed on unmount).
- Verified in a real headless browser (logged in as artist): 0 native
  `audio[controls]`, click play -> countdown "-4:13" appears and audio
  actually playing; click pause -> countdown vanishes. tsc/lint/build clean.

### Delete controls: posts + tracks (2026-09-09)
- 3-dot menu on each track row (artist only) with two-step Delete ("Delete track"
  -> "Confirm delete") -> DELETE /api/tracks/[id]: removes audio + cover from the
  private bucket and the DB row (streams cascade). Fan DELETE -> 403.
- 3-dot on each post now opens a menu (artist only) with the same two-step
  Delete -> DELETE /api/posts/[id]: removes post-image from public bucket and the
  row (likes/comments/notifications cascade). Fan DELETE -> 403.
- `src/components/ui/KebabMenu.tsx` shared two-step dropdown (backdrop to close).
- db.ts: deleteTrack (bucket paths + row; cover_path aware), deletePost.
- New route src/app/api/tracks/[id]/route.ts (DELETE, ownership belt+suspenders);
  posts route gained DELETE.
- Verified: tsc/eslint/build clean; live browser QA as artist deleted a throwaway
  track (row + storage file gone) and three QA posts via the menus; direct API
  deletes 200; fan JWTs 403 with data untouched. All QA artifacts cleaned up.
- No migration needed (reuses existing schema).

### Upload progress ring everywhere (2026-09-09)
- Every site upload now shows a clockwise percentage ring while it transfers:
  track upload, theme-media upload, post image upload, profile avatar upload,
  and community-chat image upload.
- `src/lib/upload.ts` — `uploadWithProgress(url, formData, onProgress)`: XHR-based
  (fetch has no upload progress; XHR exposes `xhr.upload.onprogress`), same
  multipart body the existing APIs already accept, returns `{ok,status,data}`.
  Also `uploadErrorOf(...)` to read the API's `error` string.
- `src/components/ui/UploadProgress.tsx` — reusable clockwise ring: SVG circle
  viewBox 72, r=30, `strokeDasharray`/`strokeDashoffset` with `-rotate-90` so it
  sweeps clockwise from 12 o'clock; live % centered (tabular-nums), optional
  label, `stroke-primary` track on `stroke-zinc-800` (Tailwind v4 theme).
- Integration (all replace the old `fetch` upload / plain spinner):
  - `TrackUploader` — ring under the form while the audio (+ optional cover) uploads.
  - `ThemeMediaSection` — ring under the upload button; button no longer swaps to a spinner.
  - `CreatePostForm` — ring under the dashed "Choose an image" box; removed the now-unused Loader2.
  - `profile/page.tsx` — ring overlay inside the avatar circle (bg-black/70) while
    the avatar uploads; the camera badge no longer spins.
  - `FanCommunity` — composer row is replaced by the ring (centered) while the
    chat image uploads; upload failures now surface inline as red text.
- Verified: tsc clean; eslint 0 errors (pre-existing `<img>` warnings only); next
  build passes. Live headless-browser QA (artist login):
  1. Route-delayed the upload API -> during upload exactly one
     `svg circle.stroke-primary` ring is on screen with the live % and the
     "Uploading image…" label; after completion the ring is gone and the post
     image preview appears (no error).
  2. CDP-throttled the connection to 50 KB/s -> % ticks upward in real time
     (sampled 1% -> 2% -> 3% -> 5% -> 7%) proving it tracks actual transfer.
  - QA upload artifact removed from the post-images storage bucket; local temp
    files cleaned up.

### Fan club: merch marketplace + donate (2026-09-09)
- The fan-club story page (`/stories/fan-club`, the highlights-card destination)
  now has a full artist merch store below the subscription panel.
- `src/components/ui/ComingSoonProvider.tsx` — shared animated "Coming soon"
  overlay: context (`useComingSoon()`) + `ComingSoonTrigger` helper button.
  Modal uses framer-motion spring pop + fading backdrop-blur, a pulsing/rocking
  gradient Rocket medallion on a blurred glow ring, gradient "Coming soon"
  headline, the trigger's label, and a "Got it" close (also closes on backdrop/X).
- `src/components/store/MerchStore.tsx` — "The Store" marketplace: 8 merch items
  (GNX Vinyl $40.00, Crewneck Hoodie $65.00, Tour Tee $35.00, Signed Poster
  $25.00, Mixtape Cassette $22.00, Live Session Pass $75.00, Studio Headphones
  $89.00, Canvas Tote $18.00), each a gradient hero tile with icon + tag, price,
  description, and a "Buy now" button that opens the Coming soon popup.
- Donate button (HeartHandshake, emerald) added inside the fan-club panel —
  "Donate to the music" opens the same popup.
- Page wrapped in `<ComingSoonProvider>`; client/skeleton wiring is the standard
  server-slots-into-client pattern.
- Verified: tsc clean, eslint 0 errors, build passes; headless-browser QA as
  artist on /stories/fan-club: "The Store" heading present, 8 Buy buttons, all
  8 prices render, Donate button present; click Buy -> "Coming soon" popup shows
  the item label; "Got it" closes it; click Donate -> same popup shows
  "Donations".

### Live Now: real streaming (Option A — platform embed) (2026-09-09)
- `/stories/live-now` no longer shows the fake "Live session active" panel — it
  now runs a real live-stream embed driven by Twitch Helix / YouTube Data API.
- `src/lib/live.ts` — server-side `getLiveStatus()`: if `LIVE_PLATFORM=twitch`,
  mint an app token (`LIVE_TWITCH_CLIENT_ID`/`_SECRET`) and hit
  `helix/streams?user_login=LIVE_CHANNEL`; if `LIVE_PLATFORM=youtube`, hit the
  Data API `search?eventType=live` for `LIVE_YOUTUBE_CHANNEL_ID`/`LIVE_YOUTUBE_API_KEY`.
  Returns `{configured, platform, live, title, viewerCount, embed, error}`.
  Missing credentials -> `configured:false` (UI shows a dev hint), API failure
  -> `error` with `live:false` so the page can never crash the live badge.
- `GET /api/live/status` (force-dynamic) — public probe consumed by the player.
- `src/components/live/LiveNowPlayer.tsx` — client player that polls the status
  route every 30s: pulsing red LIVE dot + "LIVE · On air now" + stream title +
  "N watching" pill, then either the Twitch embed
  (`player.twitch.tv/?channel=X&parent=<hostname>&autoplay=true`; parent uses
  `window.location.hostname` so it works in dev AND prod) or the YouTube embed
  (`youtube.com/embed/<id>?autoplay=1`) in a 16:9 box. Off the air: "The room is
  quiet for now" panel + SubscribeButton. Also shows a small "configure LIVE_*
  env vars" note while unconfigured.
- New option in story page: `<LiveNowPlayer artistId={...} />` replaces the
  static live-now block inside the live-now branch.
- Verified: tsc clean, eslint 0 errors, build passes (`/api/live/status` in
  route table). Headless-browser QA (artist login, mocked status route):
  offline -> "Off the air"/"The room is quiet" + configured hint, 0 embeds;
  twitch live -> LIVE badge + title + "1,284 watching" + player.twitch.tv
  iframe; youtube live -> LIVE badge + title + youtube.com/embed iframe. The
  Twitch player actually initialized (its channel fetch hit usher.ttvnw.net,
  expected 404/429 for the fake channel).
- **To go live for real**: set in `.env.local` — `LIVE_PLATFORM`, plus either
  Twitch (`LIVE_CHANNEL`, `LIVE_TWITCH_CLIENT_ID`, `LIVE_TWITCH_CLIENT_SECRET`)
  or YouTube (`LIVE_YOUTUBE_CHANNEL_ID`, `LIVE_YOUTUBE_API_KEY`), then the
  artist streams to that platform with OBS (Twitch Studio game-capture path).

### Live Now page: feed removed (2026-09-09)
- The home feed is fully removed from `/stories/live-now`. The "From the room"
  posts section, `getAllPosts` fetch, `Post` mapping helpers
  (`formatTimeDifference`/`FeedPost`/`toPostProps`) are all gone — the page now
  shows only the hero + the LiveNowPlayer + story copy.
- Verified: tsc clean, eslint 0 errors; live browser QA (artist login): no
  "From the room" heading, 0 post articles, LiveNowPlayer still renders.

### Live Now: animated "Coming soon" banner (2026-09-09)
- `src/components/live/ComingSoonBanner.tsx` renders between the hero and the
  player on `/stories/live-now`. Animated via pure CSS keyframes added to
  `src/app/globals.css`: `gradient-x` (animated rose→purple→orange sweep),
  `banner-shine` (repeating diagonal sheen sweep), `float-bounce` (floating
  Radio icon in a glass tile). Copy: "Live broadcasts / Coming soon / Stay
  tuned — the artist is getting ready to go live." plus a pulsing "Stay tuned"
  pill on the right.
- Server-rendered (no hydration dependency). Verified: tsc clean, eslint 0
  errors, headless-browser QA shows the banner with its animations + the
  player on the same page.

### Artist credential hardening (2026-09-09)
- The seeded artist password was rotated to a new, randomly generated 20-char
  credential. The old one no longer works (login now 401s). The new plaintext
  is NOT stored anywhere in the repo — share it with the user out-of-band.
- `database/migration_phase4.sql`: replaced the old bcrypt hash with the new
  one, added `password_hash = EXCLUDED.password_hash` to the seed's
  `ON CONFLICT ... DO UPDATE` so re-running the migration keeps the account in
  sync, and removed the "Password is ..." comment (now instructs to generate a
  hash via bcryptjs without pasting plaintext).
- Live DB row updated to the same hash (verified byte-for-byte on re-read;
  bcrypt compare true).
- `e2e_test.ps1` now reads the artist password from the `E2E_ARTIST_PASSWORD`
  env var instead of a hardcoded string (header documents it).
- `task_progress.md` no longer prints the plaintext credential anywhere.
- Verified: `kendrick@kendrickdavid.com` + new password -> 200 role=artist;
  old password -> 401. `rg` for the old password returns nothing.

### Streams count after 30s minimum playback (2026-09-09)
- A track no longer counts as played the moment you press play. It now only
  records a stream once the listener has accumulated **at least 30 seconds** of
  playback (a track shorter than 30s counts when it finishes playing).
- `src/components/music/TrackPlayer.tsx` owns the rule: a new `onQualified`
  callback fires once via a `qualifiedRef` guard — triggered in `onTimeUpdate`
  when `audio.currentTime >= 30`, or in `onEnded` (full play-through of short
  tracks). It keeps its own elapsed-position logic, so pausing/resuming across
  the 30s boundary still qualifies.
- `src/components/music/MusicSection.tsx`: `handlePlay` now only pauses the
  other tracks; the per-session `recordedRef` guard + `POST /api/tracks/[id]/stream`
  moved into the new `handleQualified(trackId)`.
- Client-side enforcement by design (the server has no playback telemetry to
  verify) — one session per page still counts once per track.
- Verified: tsc clean, eslint 0 errors, headless-browser QA (artist login):
  after clicking play, 0 stream POSTs while `currentTime` sits at 0; after
  seeking to 31s the POST fires exactly once (1 unique track).

### Fans online (real-time presence) (2026-09-09)
- Replacements: the static "Trending" card in the home sidebar is gone. In its
  place: a live **"Fans online"** card showing the number of fans whose
  presence heartbeat is still fresh.
- Architecture: every authenticated user's browser runs a `PresenceHeartbeat`
  (mounted in the root layout) that POSTs `/api/presence` every 20s while the
  tab is visible, and pauses as soon as the tab is hidden (a backgrounded tab
  drops off after the online window). The widget polls `/api/fans/online`
  every 10s.
- `database/migration_fans_online.sql` (REQUIRED, apply in Supabase SQL
  Editor): `user_presence(user_id pk → users.id, last_seen_at)` + index.
  Before it's applied the app degrades gracefully — count stays 0, heartbeat
  returns `{success:true, recorded:false}`.
- Fat/degrade notes:
  - `touchPresence()` and `countFansOnline()` in `src/lib/db.ts` return
    silently-0 on a missing table (`isTableMissing`); the ONLINE window is
    60s; stale rows >5min are swept on each touch.
  - The count joins `user_presence` → `users` and filters `role='fan'`, so the
    artist's own browsing never inflates the number.
  - Couldn't DDL remotely (no DB password on this machine; REST can't run
    SQL), so the table must be created via the SQL editor.
- Files: `src/app/api/presence/route.ts`, `src/app/api/fans/online/route.ts`,
  `src/components/presence/PresenceHeartbeat.tsx`,
  `src/components/presence/FansOnlineWidget.tsx`, edits in `src/app/layout.tsx`
  + `src/app/page.tsx`.
- QA (before migration): widget renders in place of Trending, polls the count
  endpoint, heartbeat POSTs every 20s; tsc/eslint/build clean.
- Migration applied by user 2026-09-09; note `users.id` is `text` (not uuid),
  so `user_presence.user_id` is `text`. Post-apply QA (artist browser + a
  forged heartbeat for a real fan `john`):
    - `POST /api/presence` for the fan -> `{success:true, recorded:true}`;
      `GET /api/fans/online` -> `{count:1}`.
    - Widget poll timeline: count 1 while the fan row was fresh, dropped to 0
      ~60s after the last heartbeat (accurate real-time decay).
- Artist-only heartbeats still not counted (role filter); widget end state
  "Right now 0 0 fans are here right now".

### Review pass / polish (1-6) (2026-09-09)
- Schema probe: ALL migrations are actually applied (notifications,
  direct_messages, theme_media, tracks exist). The earlier "pending 8-11"
  note was stale — only `communities` is absent and nothing references it.
- Live indicator: the home header's red-dot button was fake/static. It's now
  a real link to `/stories/live-now` driven by `getLiveStatus()`: red pulsing
  "Live now" when actually live, "Offline" when configured but not live,
  "Live soon" when unconfigured.
- Branding: `database/logo.png` also copied to `public/logo.png`; new shared
  `src/components/brand/Logo.tsx` (rounded-full 1:1 crop) replaced the old
  "KD" gradient circles in the Sidebar, login, signup, and the home header.
  (Favicon already used the same art via `src/app/icon.png`.)
- Music player: `TrackPlayer` got a thin progress/seek bar (range input,
  `accent-primary`, shows once duration is known, drives `audio.currentTime`
  on change) and now reports active-state to `MusicSection` so the playing
  row highlights (border-primary/ring). Countdown + 30s rule untouched.
- SEO: layout metadata extended (metadataBase, title template, icons,
  Open Graph, Twitter cards); added `src/app/robots.ts` and
  `src/app/sitemap.ts` (covers `/`, live-now, fan-club, auth pages, all
  STORIES slugs).
- Verified: tsc/eslint clean; `npm run build` passes with 39 routes
  (incl. /icon.png, /robots.txt, /sitemap.xml). Headless QA: logo renders
  (login 56x56, home header + sidebar = 2), header link shows "Live soon" ->
  /stories/live-now, player range enables once metadata loads (253s),
  seeks to 20s correctly and continues playing, active row highlights,
  robots/sitemap serve 200.
- Merch/donate left as the intentional coming-soon experience (no payment
  processor behind it).

### Home page load optimization (2026-09-10)
- Diagnosed `/` at ~3.4s: 7 serial Supabase REST calls (getArtistUser 851ms,
  getAllPosts 812ms, 7x hasUserLikedPost N+1 613ms, track signed URL 519ms,
  counts ~380ms). Static pages (fan-club) warm ~309ms; dev Turbopack also
  lazily compiles routes per session.
- Fix 1 — parallel: `Home()` now runs `fetchFeedData()`, `getArtistUser()`,
  `getLiveStatus()`, `getTracksWithSignedUrls()` concurrently via
  `Promise.all` (followers/listeners still keyed off the artist result).
- Fix 2 — batch: new `getUserLikedPostIds(userId, postIds)` in `src/lib/db.ts`
  replaces the per-post `hasUserLikedPost` loop in `fetchFeedData` with a
  single `.in()` query returning a Set. `hasUserLikedPost` kept for the
  `/api/posts/[id]/likes` route.
- Verified: tsc/eslint clean (only 2 pre-existing unused-var warnings).
  Headless QA after login: 7 feed articles render, `/api/auth/me` 200,
  track rows + seek bar present. Timing: consistent min dropped from ~3.4s
  to ~2.25s (~32%); remaining cost is Supabase network latency per call.
  (Early "No posts yet" false alarms were anonymous curl + transient
  dev/Supabase flakiness — data probe confirmed 7 posts, join intact.)
- No behavioral change: anonymous visitors still see the empty feed state.

### Deploy scaffolding + production cache pass (2026-09-10)
- `git init` run (repo previously had none). Nothing committed.
- `.env.example` created listing all vars the code reads: NEXT_PUBLIC_API_URL /
  NEXT_PUBLIC_APP_URL, SUPABASE_URL, SUPABASE_ANON_KEY (public),
  SUPABASE_SERVICE_ROLE_KEY (server-only), JWT_SECRET, optional LIVE_* set,
  E2E_ARTIST_PASSWORD (dev). Notes that Supabase dashboard must set SMTP +
  email-confirm redirect URL, and Pro plan for backups.
- `next.config.ts` now `output: "standalone"`; `Dockerfile` (node:22-alpine,
  multi-stage, non-root `nextjs` user, runs `.next/standalone/server.js`)
  and `.dockerignore` (excludes node_modules, .next, .git, and ALL `.env*`
  so no secrets bake into images). `vercel.json` pins framework/buildCommand
  (Next auto-detects; env still set in Vercel dashboard).
- Production cache pass: `Home()`'s global (non user-specific) lookups are
  wrapped in `unstable_cache` — getAllPosts (`feed-posts`, 60s),
  getArtistUser (`artist-user`, 300s), getLiveStatus (`live-status`, 30s),
  getTracksWithSignedUrls (`tracks`, 60s), getFollowCounts (300s),
  getMonthlyListeners (300s). Auth token + per-user liked state remain
  uncached. Chose `unstable_cache` per Next 16 docs: `use cache` in-memory
  entries don't persist across serverless invocations, while
  `unstable_cache` uses the Data Cache (Vercel) / in-memory+disk
  (self-hosted). Tags left for future revalidateTag on mutations.
- Verified in prod (`next build` 320 routes family + `next start` on :3001):
  tsc/eslint clean; HTML for an authenticated fan contains the feed (no
  "No posts yet") and the "Animal" track; timings dropped from
  dev ~2.25s best to prod ~0.15-0.4s warm (anon) / ~0.4-1.5s (auth, first
  hit is the uncached per-user liked query). `.next/standalone/server.js`
  present for the Docker path.
- data persistence note: all uploads are Supabase Postgres rows + Storage
  objects; nothing is written to the local filesystem (auth session only in
  browser). Durability = Supabase plan (free: no auto-backups, auto-pause
  after 7 days idle; Pro: daily backups + PITR).
