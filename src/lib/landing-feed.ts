/**
 * Shape of the public landing page's picture + video feed, shared by the
 * landing page itself and the artist's editor at /landing-feed.
 *
 * The data lives in Supabase (see database/migration_landing_feed.sql) so the
 * artist can change it without a deploy. Until that migration is applied, and
 * whenever the table is unreachable, `getLandingFeed()` in db.ts falls back to
 * STATIC_FEED below — the landing page must never go blank because of a
 * database problem.
 */

export type Poster = {
  /** Public URL or /public path of the still shown until the visitor plays. */
  src: string;
  /** The card's shape is derived from these — keep them true to the file. */
  width: number;
  height: number;
  alt: string;
};

/**
 * Bounds for a feed tile's aspect ratio, as width / height.
 *
 * Cards take their shape from the poster so a new entry never has to name a
 * Tailwind aspect class, and the varied ratios are what make the grid look
 * editorial rather than uniform. But a poster's own ratio is not always a sane
 * *tile* ratio: the "Landmark" visualizer is 880x1566 (0.56), which in a
 * 3-column grid produced a 355x631 card — 70% of the viewport — sitting next to
 * 199px neighbours. One thumbnail, and the grid stopped reading as a grid.
 *
 * Clamping to square..16:9 keeps the variety while bounding the tallest card to
 * the width of its column. A poster outside that range is letterboxed rather
 * than cropped — see {@link posterFitsTile} — so the artwork is never cut, and
 * replacing the file with a squarer crop stays the artist's option rather than
 * a layout requirement.
 */
export const MIN_TILE_RATIO = 1;
export const MAX_TILE_RATIO = 16 / 9;

/** True when a poster's own ratio can fill a tile with no letterbox and no crop. */
export function posterFitsTile(width: number, height: number): boolean {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return false;
  }
  const ratio = width / height;
  return ratio >= MIN_TILE_RATIO && ratio <= MAX_TILE_RATIO;
}

/** A tile's aspect ratio, clamped to {@link MIN_TILE_RATIO}..{@link MAX_TILE_RATIO}. */
export function tileRatio(width: number, height: number): number {
  // A zero or missing dimension would make aspect-ratio divide by zero and
  // collapse the card, so fall back to a square rather than trusting the data.
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return MIN_TILE_RATIO;
  }
  const ratio = width / height;
  return Math.min(MAX_TILE_RATIO, Math.max(MIN_TILE_RATIO, ratio));
}

export type MediaItem = {
  /** Unique and stable — used as the React key and to restart playback. */
  id: string;
  title: string;
  /** Shown under the title in the media modal, e.g. "Official video". */
  note?: string;
  poster: Poster;
} & (
  | { kind: "photo" }
  | { kind: "video"; source: { youtube: string } | { vimeo: string } }
);

export type FeedProvider = "youtube" | "vimeo";

/* ---------------------------------------------------------------------------
 * HOW TO ADD SOMETHING TO THE FEED
 *
 * Once database/migration_landing_feed.sql is applied you do not edit this
 * file at all — use /landing-feed in the community app, which writes to the
 * database. This array is only the offline fallback, and it is also what
 * `npm run check:landing` validates.
 *
 * The three shapes, if you ever do hand-edit it:
 *
 *   photo    { id, title, kind: "photo", poster, note? }
 *   YouTube  { id, title, kind: "video", source: { youtube: "VIDEO_ID" }, note? }
 *   Vimeo    { id, title, kind: "video", source: { vimeo: "VIDEO_ID" }, note? }
 *
 * `kind: "video"` without a player, or a photo with one, is a type error.
 * ------------------------------------------------------------------------- */

/** Must stay in step with the INSERT in migration_landing_feed.sql. */
export const STATIC_FEED: MediaItem[] = [
  {
    id: "animal",
    title: "Animal",
    kind: "video",
    source: { youtube: "8LXIM0GbqPQ" },
    poster: {
      src: "/landing/video-animal.jpg",
      width: 1280,
      height: 720,
      alt: "Animal — video still",
    },
    note: "Official video",
  },
  {
    id: "landmark",
    title: "Landmark",
    kind: "photo",
    poster: {
      src: "/landing/visualizer.jpg",
      width: 880,
      height: 1566,
      alt: "Landmark visualizer artwork",
    },
    note: "Visualizer artwork",
  },
  {
    id: "unholy",
    title: "Unholy",
    kind: "video",
    source: { youtube: "QlyBUD_RxiE" },
    poster: {
      src: "/landing/video-unholy.jpg",
      width: 1280,
      height: 720,
      alt: "Unholy — video still",
    },
  },
  {
    id: "dark-dance",
    title: "Dark Dance",
    kind: "video",
    source: { vimeo: "1032445716" },
    poster: {
      src: "/landing/video-dark-dance.jpg",
      width: 1280,
      height: 960,
      alt: "Dark Dance — video still",
    },
    note: "Vimeo",
  },
  {
    id: "tyb",
    title: "Touch Your Body (TYB)",
    kind: "video",
    source: { youtube: "-xAuL03StPU" },
    poster: {
      src: "/landing/video-tyb.jpg",
      width: 1280,
      height: 720,
      alt: "Touch Your Body (TYB) — video still",
    },
  },
  {
    id: "chant-and-wishes",
    title: "Chant And Wishes",
    kind: "video",
    source: { youtube: "oWF8kUp64tQ" },
    poster: {
      src: "/landing/video-chant.jpg",
      width: 1280,
      height: 720,
      alt: "Chant And Wishes — video still",
    },
  },
];

const YOUTUBE_PARAMS =
  "rel=0&loop=0&controls=1&cc_load_policy=0&autoplay=1&playsinline=1";
const VIMEO_PARAMS = "dnt=1&autoplay=1&title=0&byline=0&portrait=0";

/** Player URL for a video item, or null for a photo. Never mounted until the
 *  visitor opens the item, which keeps every embed off the critical path. */
export function embedSrc(item: MediaItem): string | null {
  if (item.kind !== "video") return null;
  if ("youtube" in item.source) {
    return `https://www.youtube-nocookie.com/embed/${item.source.youtube}?${YOUTUBE_PARAMS}`;
  }
  return `https://player.vimeo.com/video/${item.source.vimeo}?${VIMEO_PARAMS}`;
}

/** Player id → a public embed URL the poster can be grabbed from, or null
 *  when the provider has no such endpoint (Vimeo). */
export function thumbnailUrlFor(
  provider: FeedProvider,
  providerId: string
): string | null {
  if (provider !== "youtube") return null;
  return `https://i.ytimg.com/vi/${providerId}/maxresdefault.jpg`;
}

/** Turn a title into a feed id: "Touch Your Body!" -> "touch-your-body". */
export function slugifyFeedId(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "item";
}
