import { embedSrc, type MediaItem } from "@/lib/landing-feed";
import { absoluteUrl } from "@/lib/site";
import { ARTIST, LISTENING_LINKS, SOCIAL_LINKS } from "../content";

/**
 * JSON-LD for the public landing page.
 *
 * This is what lets a search engine show the artist as a music act with its
 * releases, rather than as a page of blue links. Everything here is derived
 * from the same data the page already renders, so it cannot drift from what a
 * visitor sees.
 *
 * Deliberately absent: uploadDate, duration and release dates. None of that is
 * known, and schema.org values that are wrong are worse than missing ones.
 */

/** The watch page, which is what a `VideoObject` should point a human at. */
function watchUrl(item: MediaItem & { kind: "video" }): string {
  return "youtube" in item.source
    ? `https://www.youtube.com/watch?v=${item.source.youtube}`
    : `https://vimeo.com/${item.source.vimeo}`;
}

function videoObject(item: MediaItem & { kind: "video" }) {
  return {
    "@type": "VideoObject",
    name: item.title,
    description: item.note ?? item.title,
    thumbnailUrl: absoluteUrl(item.poster.src),
    embedUrl: embedSrc(item) ?? undefined,
    contentUrl: watchUrl(item),
    uploadDate: undefined,
  };
}

function imageObject(item: MediaItem & { kind: "photo" }) {
  return {
    "@type": "ImageObject",
    name: item.title,
    caption: item.poster.alt,
    contentUrl: absoluteUrl(item.poster.src),
    width: item.poster.width,
    height: item.poster.height,
  };
}

export function StructuredData({ feed }: { feed: MediaItem[] }) {
  /* Spotify appears in both lists; a duplicate sameAs entry is noise. */
  const sameAs = Array.from(
    new Set([...SOCIAL_LINKS, ...LISTENING_LINKS].map((link) => link.href))
  );

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${absoluteUrl("/")}#website`,
        url: absoluteUrl("/"),
        name: ARTIST.name,
        description: ARTIST.bio,
        inLanguage: "en",
        publisher: { "@id": `${absoluteUrl("/")}#artist` },
      },
      {
        "@type": "MusicGroup",
        "@id": `${absoluteUrl("/")}#artist`,
        name: ARTIST.name,
        alternateName: ARTIST.tagline,
        url: absoluteUrl("/"),
        description: ARTIST.bio,
        image: absoluteUrl(ARTIST.portrait.src),
        genre: ["trap", "pop"],
        sameAs,
      },
      {
        "@type": "ItemList",
        "@id": `${absoluteUrl("/")}#feed`,
        name: `${ARTIST.name} - videos, visualizers and stills`,
        numberOfItems: feed.length,
        itemListElement: feed.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${absoluteUrl("/")}#listen`,
          item:
            item.kind === "video" ? videoObject(item) : imageObject(item),
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      /* `<` is escaped so a title containing it cannot close the script tag. */
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(graph).replace(/</g, "\\u003c"),
      }}
    />
  );
}
