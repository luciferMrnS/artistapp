/**
 * Single source of truth for every string and link on the public landing page.
 * Kept apart from the community app so the marketing surface can be edited
 * without touching feed/auth code.
 *
 * The picture + video feed is NOT here — the artist edits it at runtime from
 * /landing-feed, so it lives in the database. See src/lib/landing-feed.ts for
 * the types and the static fallback used when the database has no table yet.
 */

export const ARTIST = {
  name: "Kendrick David",
  /** Carrd meta description / og:description — the artist's own word for it. */
  tagline: "Luceàvá",
  heading: "Crafting music for the soul",
  bio: "Kendrick David’s music is an experience. Rooted in trap/pop, his sound takes listeners on a journey through rhythm, passion, and expression.",
  portrait: {
    src: "/landing/portrait.jpg",
    width: 570,
    height: 570,
    alt: "Kendrick David",
  },
  email: "iamkendrickdavid@gmail.com",
} as const;

/** Repeating strip under the hero. Duplicated once for a seamless loop. */
export const MARQUEE = [
  "trap / pop",
  "rhythm",
  "passion",
  "expression",
  "Luceàvá",
  "the Creed",
] as const;

/** Listening platforms, shown beside the name in the hero. */
export const LISTENING_LINKS = [
  {
    label: "Spotify",
    href: "https://open.spotify.com/artist/0qIquZcEABahK95ZRAuSYS",
    icon: "spotify" as const,
  },
  {
    label: "Apple Music",
    href: "https://music.apple.com/us/artist/kendrick-david/1519821340",
    icon: "appleMusic" as const,
  },
  {
    label: "YouTube",
    href: "https://youtube.com/@iam_kendrickdavid",
    icon: "youtube" as const,
  },
];

/** The "Find Kendrick..." row. */
export const SOCIAL_LINKS = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/iam_kendrickdavid",
    icon: "instagram" as const,
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@iam_kendrickdavid",
    icon: "tiktok" as const,
  },
  {
    label: "X",
    href: "https://x.com/ImKendrickdavid",
    icon: "x" as const,
  },
  {
    label: "Spotify",
    href: "https://open.spotify.com/artist/0qIquZcEABahK95ZRAuSYS",
    icon: "spotify" as const,
  },
];

/** Every "join" call to action on the landing page lands here. Single source
 *  of truth so the hero, the mid-page repeat, the pull quote and the sticky
 *  scroll bar can never drift onto different routes. */
export const COMMUNE_ROUTE = "/auth/login";

/** Lines typed out in the greeting overlay, in order. */
export const GREETING = [
  { kind: "eyebrow", text: ARTIST.tagline, hold: 620 },
  { kind: "display", text: ARTIST.name, hold: 780 },
  { kind: "display", text: ARTIST.heading, hold: 900 },
  { kind: "body", text: ARTIST.bio, hold: 1500 },
] as const;
