/**
 * The site's canonical origin.
 *
 * This has to resolve correctly with no environment configuration, because a
 * wrong value here is invisible until a crawler reads it: production had
 * `NEXT_PUBLIC_API_URL` unset, so the sitemap and robots.txt fell back to
 * `http://localhost:3000` and every URL a search engine was pointed at was
 * unfollowable. The site was, in effect, not indexable.
 *
 * Precedence lets a preview or self-hosted deploy point somewhere else:
 *   1. NEXT_PUBLIC_SITE_URL  - the explicit override
 *   2. NEXT_PUBLIC_API_URL   - the existing convention (still what dev uses)
 *   3. the real production origin, so an unset env var cannot break SEO again
 */
const DEFAULT_ORIGIN = "https://www.kendrickdavid.com";

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  DEFAULT_ORIGIN
).replace(/\/+$/, "");

/** A root-relative path as an absolute URL, for metadata, sitemap and JSON-LD. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Where a signed-in account belongs.
 *
 * Single source on purpose. /auth/login and /auth/signup already sent people
 * here after authenticating, and the landing page now sends a returning fan
 * here from the site root; if those were separate literals they could drift
 * and strand a signed-in user on the marketing page.
 */
export const COMMUNITY_ROUTE = "/community";

/**
 * Opt out of the signed-in redirect on the landing page.
 *
 * The artist edits the copy and the feed on /landing-feed, so they still need
 * to see what they published - but / is the anonymous front door and every
 * signed-in account is redirected away from it. A query parameter is the
 * smallest thing that gives the artist their own page back without
 * reintroducing an exception for a role, which is what made them the one
 * account that never reached the community in the first place.
 */
export const LANDING_PREVIEW_PARAM = "preview";

/** The value the landing page looks for. Kept next to the name because the two
 *  are easy to conflate - the page reads the param's value, not its key. */
export const LANDING_PREVIEW_VALUE = "1";

/** The landing page as the public sees it, for a signed-in artist. */
export const LANDING_PREVIEW_URL = `/?${LANDING_PREVIEW_PARAM}=${LANDING_PREVIEW_VALUE}`;

/**
 * Routes only a signed-in account should reach. They are all auth-guarded, so
 * this is crawl hygiene rather than access control - but there is no reason to
 * spend crawl budget on them, and indexing a login page is a bad look.
 */
export const PRIVATE_PATHS = [
  "/api/",
  "/landing-feed",
  "/dashboard",
  "/create",
  "/messages",
  "/notifications",
  "/profile",
  "/alert",
  "/fan-club",
  COMMUNITY_ROUTE,
];
