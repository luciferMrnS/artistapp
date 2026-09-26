import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Play } from "lucide-react";
import { getLandingFeed } from "@/lib/db";
import {
  embedSrc,
  formatReleaseDate,
  isValidReleaseDate,
  type MediaItem,
} from "@/lib/landing-feed";
import { absoluteUrl } from "@/lib/site";
import { ARTIST } from "../../content";

/* The artist edits this feed at runtime, and the landing page is already
   rendered per request for the same reason. Forcing it here too means a new
   release is indexable the moment it is saved, with no redeploy - and a page
   for an item that was just deleted stops being served immediately. */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function byId(items: MediaItem[], id: string): MediaItem | undefined {
  return items.find((item) => item.id === id);
}

/** The watch page. A detail page links out rather than embedding, so the
 *  landing experience stays third-party-free until the visitor asks for it. */
function watchUrl(item: MediaItem & { kind: "video" }): string {
  return "youtube" in item.source
    ? `https://www.youtube.com/watch?v=${item.source.youtube}`
    : `https://vimeo.com/${item.source.vimeo}`;
}

function providerName(item: MediaItem): string {
  return item.kind === "video" && "vimeo" in item.source ? "Vimeo" : "YouTube";
}

function describe(item: MediaItem): string {
  const kind =
    item.kind === "video"
      ? `${providerName(item)} video`
      : "photo and visualizer still";
  return item.note
    ? `${item.title} — ${item.note}. ${kind} by ${ARTIST.name}.`
    : `${item.title} — ${kind} by ${ARTIST.name}.`;
}

/** Meta descriptions get truncated in results anyway, and a description cut
 *  mid-word reads worse than a clean shorter sentence. */
const META_LIMIT = 155;

function metaDescription(item: MediaItem): string {
  if (item.description) {
    const flat = item.description.replace(/\s+/g, " ").trim();
    if (flat.length <= META_LIMIT) return flat;
    const cut = flat.slice(0, META_LIMIT);
    const lastSpace = cut.lastIndexOf(" ");
    return `${cut.slice(0, lastSpace > 40 ? lastSpace : META_LIMIT).trimEnd()}…`;
  }
  return describe(item);
}

/** The release day, but only if it is genuinely one. A hand-edited feed entry
 *  with "sometime in May" must not reach the structured data, where Google
 *  treats a bad datePublished as a quality problem. */
function publishedDate(item: MediaItem): string | undefined {
  return item.releasedOn && isValidReleaseDate(item.releasedOn)
    ? item.releasedOn
    : undefined;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const item = byId(await getLandingFeed(), id);
  if (!item) return { title: "Not found" };

  const url = absoluteUrl(`/music/${item.id}`);
  const poster = absoluteUrl(item.poster.src);
  const summary = metaDescription(item);

  return {
    title: item.title,
    description: summary,
    alternates: { canonical: url },
    openGraph: {
      type: item.kind === "video" ? "video.other" : "article",
      url,
      title: `${item.title} — ${ARTIST.name}`,
      description: summary,
      images: [{ url: poster, width: item.poster.width, height: item.poster.height, alt: item.poster.alt }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${item.title} — ${ARTIST.name}`,
      description: summary,
      images: [poster],
    },
  };
}

export default async function MusicPage({ params }: Params) {
  const { id } = await params;
  const feed = await getLandingFeed();
  const item = byId(feed, id);
  if (!item) notFound();

  const url = absoluteUrl(`/music/${item.id}`);
  const others = feed.filter((other) => other.id !== item.id).slice(0, 4);
  const releasedOn = publishedDate(item);
  const releasedLabel = formatReleaseDate(item.releasedOn);
  const summary = metaDescription(item);

  /* VideoObject / ImageObject for this item, plus the breadcrumb trail. The
     item is the page's subject, so it is described on its own rather than as
     one entry in the landing page's list. */
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "The feed", item: `${absoluteUrl("/")}#listen` },
          { "@type": "ListItem", position: 3, name: item.title, item: url },
        ],
      },
      item.kind === "video"
        ? {
            "@type": "VideoObject",
            name: item.title,
            description: summary,
            thumbnailUrl: absoluteUrl(item.poster.src),
            embedUrl: embedSrc(item) ?? undefined,
            contentUrl: watchUrl(item),
            url,
            mainEntityOfPage: url,
            uploadDate: releasedOn,
          }
        : {
            "@type": "ImageObject",
            name: item.title,
            caption: item.poster.alt,
            description: summary,
            contentUrl: absoluteUrl(item.poster.src),
            url,
            width: item.poster.width,
            height: item.poster.height,
            dateCreated: releasedOn,
          },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <main id="top" className="min-h-screen">
        <section className="lp-panel">
          <div className="mx-auto max-w-4xl px-6 pb-16 pt-20 sm:pt-28">
            <nav aria-label="Breadcrumb" className="mb-8">
              <Link
                href="/#listen"
                className="inline-flex items-center gap-2 text-sm text-[#2e2e2e] underline decoration-black/20 underline-offset-[6px] transition hover:decoration-black/60"
              >
                <ArrowLeft className="h-4 w-4" /> Back to the feed
              </Link>
            </nav>

            <p className="lp-eyebrow">
              {item.kind === "video" ? providerName(item) : "Photo"}
              {item.note ? ` · ${item.note}` : ""}
            </p>

            <h1 className="lp-display mt-3 text-[clamp(2rem,6vw,3.5rem)] leading-[1.1]">
              {item.title}
            </h1>

            {/* A machine-readable date as well as the visible one, so the day a
                page says is provably the day the structured data claims. */}
            {releasedLabel && (
              <p className="mt-3 text-sm text-[#2e2e2e]">
                <time dateTime={releasedOn}>Released {releasedLabel}</time>
              </p>
            )}

            <div className="mt-8 overflow-hidden rounded-[1.25rem] border border-black/10 bg-[#ececeb]">
              <Image
                src={item.poster.src}
                alt={item.poster.alt}
                width={item.poster.width}
                height={item.poster.height}
                priority
                sizes="(max-width: 896px) 92vw, 896px"
                className="mx-auto max-h-[70vh] w-auto object-contain"
              />
            </div>

            {item.kind === "video" && (
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a
                  href={watchUrl(item)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lp-pill"
                >
                  <Play className="h-3.5 w-3.5" /> Watch on {providerName(item)}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <p className="text-xs text-[#2e2e2e]">
                  {item.poster.width} × {item.poster.height}
                </p>
              </div>
            )}

            {/* The artist's own words when there are any. Without them the page
                falls back to the poster's alt text, which is written for a
                screen reader and says nothing about the release. */}
            {item.description ? (
              <p className="lp-body mt-8 max-w-[62ch] whitespace-pre-line text-[0.95rem] sm:text-base">
                {item.description}
              </p>
            ) : (
              <p className="lp-body mt-8 max-w-[62ch] text-[0.95rem] sm:text-base">
                {item.poster.alt}
              </p>
            )}
          </div>
        </section>

        {others.length > 0 && (
          <section className="lp-panel">
            <div className="mx-auto max-w-6xl px-6 pb-24 pt-4">
              <h2 className="lp-display text-[clamp(1.5rem,4vw,2.25rem)]">
                More from the feed
              </h2>
              <ul className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
                {others.map((other) => (
                  <li key={other.id}>
                    <Link href={`/music/${other.id}`} className="group block">
                      <span
                        className="relative block overflow-hidden rounded-xl border border-black/10 bg-[#ececeb]"
                        style={{ aspectRatio: `${other.poster.width} / ${other.poster.height}` }}
                      >
                        <Image
                          src={other.poster.src}
                          alt={other.poster.alt}
                          fill
                          sizes="(max-width: 640px) 45vw, 22vw"
                          className="object-contain"
                        />
                      </span>
                      <span className="lp-body mt-2 block truncate text-[0.95rem] text-[#262626]">
                        {other.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
