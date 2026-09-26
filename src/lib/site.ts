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
  "/community",
];
