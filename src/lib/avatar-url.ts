/**
 * Avatar URL resolver.
 *
 * Avatars are stored in the public Supabase "avatars" bucket, but we never
 * hand those raw links to the browser — every rendered avatar points at our
 * own `/api/avatar` proxy instead. External (non-Supabase) image URLs a user
 * sets on their profile are passed through unchanged.
 */

const SUPABASE_AVATAR_RE =
  /^https:\/\/([a-z0-9-]+)\.supabase\.co\/storage\/v1\/object\/public\/avatars\/(.+)$/i;

/**
 * Convert a stored avatar value into a client-safe src URL.
 * - Supabase storage URLs become `/api/avatar?p=<encoded path>`
 * - External http(s) URLs and empty values pass through / fall back unchanged.
 */
export function resolveAvatarUrl(value: string | null | undefined): string {
  if (!value) return "/default-avatar.png";

  const match = value.match(SUPABASE_AVATAR_RE);
  if (match) {
    return `/api/avatar?p=${encodeURIComponent(match[2])}`;
  }

  return value;
}