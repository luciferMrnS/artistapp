import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDown, Mail } from "lucide-react";
import {
  ARTIST,
  COMMUNE_ROUTE,
  LISTENING_LINKS,
  MARQUEE,
  SOCIAL_LINKS,
} from "./content";
import { LandingGreeting } from "./components/LandingGreeting";
import { MediaFeed } from "./components/MediaFeed";
import { PlatformIcon } from "./components/PlatformIcon";
import { Reveal } from "./components/Reveal";
import { ScrollCta } from "./components/ScrollCta";
import { StructuredData } from "./components/StructuredData";
import { getLandingFeed } from "@/lib/db";
import {
  absoluteUrl,
  COMMUNITY_ROUTE,
  LANDING_PREVIEW_VALUE,
} from "@/lib/site";
import { getCurrentUser } from "@/lib/server-auth";

/* The artist edits the feed from /landing-feed, so the page has to be rendered
   per request. Without this the feed is captured at build time and a change
   would not reach visitors until the next deploy. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  /* `absolute` — the root layout appends a "| Kendrick David" template, and
     the name is already the first half of this title. */
  title: { absolute: `${ARTIST.name} | ${ARTIST.tagline}` },
  description: ARTIST.bio,
  openGraph: {
    type: "website",
    siteName: ARTIST.name,
    title: `${ARTIST.name} — ${ARTIST.tagline}`,
    description: ARTIST.bio,
    url: "/",
    images: [
      {
        url: "/landing/og-card.jpg",
        width: 1280,
        height: 800,
        alt: ARTIST.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${ARTIST.name} — ${ARTIST.tagline}`,
    description: ARTIST.bio,
    images: ["/landing/og-card.jpg"],
  },
  /* The artist publishes here, so these are the URLs worth handing a crawler
     instead of a bare handle. */
  alternates: { canonical: absoluteUrl("/") },
  keywords: [
    "Kendrick David",
    ARTIST.tagline,
    "trap pop artist",
    "trap music",
    "pop music",
    "independent artist",
    "new music",
    "official music video",
    "visualizer",
  ],
};

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  /* This page is the anonymous front door: the marketing surface, and the
     thing search engines and link previews are meant to see. A signed-in
     account has no use for it once they are in - /auth/login and
     /auth/signup already send people to the community afterwards - so
     returning fans and the artist alike, opening the site root, a bookmark or
     the installed PWA, are sent straight to their feed instead of being made
     to click past the poster again.

     The artist is redirected too. They were left on this page at first so
     they could preview what they publish, but they are the person most likely
     to open the site constantly, and being the one account that never reaches
     the community is not worth a preview convenience. ?preview=1, linked from
     /landing-feed, keeps that capability, and it shows the page exactly as
     the public sees it rather than a special signed-in variant - which is the
     point of a preview, since this page is deliberately identical for
     everyone who is not being redirected.

     Safe for the page's own SEO. The condition is a signed cookie, and no
     crawler or unfurl bot sends one, so / keeps serving the landing page with
     its canonical, JSON-LD and OG tags to everything that indexes it. The
     destination is in PRIVATE_PATHS, so it is noindex and absent from the
     sitemap and cannot end up indexed in /'s place.

     redirect() works by throwing, so it has to stay outside any try/catch and
     ahead of the work below. */
  const { preview } = await searchParams;
  const user = await getCurrentUser();
  if (user && preview !== LANDING_PREVIEW_VALUE) {
    redirect(COMMUNITY_ROUTE);
  }

  /* The artist edits this feed from /landing-feed. It falls back to the static
     copy in lib/landing-feed.ts when the table hasn't been created yet, and is
     re-read on every visit, so a change shows up without a redeploy. */
  const feed = await getLandingFeed();

  return (
    <LandingGreeting portraitSrc={ARTIST.portrait.src}>
      <StructuredData feed={feed} />
      <ScrollCta />

      <a
        href="#listen"
        className="sr-only focus:not-sr-only focus:absolute focus:left-6 focus:top-6 focus:z-[120] focus:rounded-full focus:bg-[#262626] focus:px-5 focus:py-3 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      {/* ---------------------------------------------------------------- Hero */}
      <main id="top">
        <section className="lp-panel">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 pb-16 pt-20 sm:pt-28 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:pb-24">
            <div>
              <p className="lp-eyebrow">{ARTIST.tagline}</p>

              <h1 className="lp-display mt-4 text-[clamp(2.75rem,9vw,5.25rem)] leading-[1.15]">
                {ARTIST.name}
              </h1>

              <p className="lp-display mt-3 text-[clamp(1.5rem,4.4vw,2.5rem)] text-[#2e2e2e]">
                {ARTIST.heading}
              </p>

              <p className="lp-body mt-7 max-w-[46ch] text-[0.95rem] sm:text-base">
                {ARTIST.bio}
              </p>

              <ul className="mt-9 flex flex-wrap gap-2.5">
                {LISTENING_LINKS.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="lp-chip"
                    >
                      <PlatformIcon name={link.icon} className="h-4 w-4" />
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link href={COMMUNE_ROUTE} className="lp-pill">
                  Join The Creed Community
                </Link>
              </div>
            </div>

            {/* Portrait — offset on wide screens so it reads as a placed
                object rather than a centred column. */}
            <div className="relative lg:pl-6">
              <div className="relative overflow-hidden rounded-[1.25rem] bg-[#ececeb] shadow-[0_30px_70px_-40px_rgba(48,36,36,0.55)]">
                <Image
                  src={ARTIST.portrait.src}
                  alt={ARTIST.portrait.alt}
                  width={ARTIST.portrait.width}
                  height={ARTIST.portrait.height}
                  priority
                  sizes="(max-width: 1024px) 92vw, 44vw"
                  className="h-full w-full object-cover"
                />
              </div>

              <span
                className="lp-eyebrow absolute -left-1 -top-5 rounded-full bg-[#f5f5f5] px-3 py-1 text-[0.5625rem] sm:-left-4"
                aria-hidden="true"
              >
                est. trap / pop
              </span>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- Marquee strip */}
        <div className="overflow-hidden border-y border-black/[0.07] bg-white/30 py-4">
          <div className="lp-marquee">
            <div className="lp-marquee-track" aria-hidden="true">
              {[...MARQUEE, ...MARQUEE].map((word, index) => (
                <span
                  key={`${word}-${index}`}
                  className="lp-eyebrow flex shrink-0 items-center gap-10 px-10"
                >
                  {word}
                  <span className="text-[0.5rem]">✦</span>
                </span>
              ))}
            </div>
          </div>
          <span className="sr-only">{MARQUEE.join(", ")}</span>
        </div>

        {/* ----------------------------------------------------- Pictures + video */}
        <section id="listen" className="lp-panel">
          <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
            <Reveal>
              <p className="lp-eyebrow">...soulful music</p>
              <h2 className="lp-display mt-3 text-[clamp(2rem,5.4vw,3.25rem)]">
                The feed
              </h2>
              <p className="lp-body mt-5 max-w-[52ch] text-[0.95rem] sm:text-base">
                Stills, official videos and visualizers. Tap anything to open it
                full size.
              </p>
            </Reveal>

            <div className="mt-12">
              <MediaFeed items={feed} />
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------------- CTA */}
        <section className="lp-panel">
          <div className="mx-auto max-w-3xl px-6 py-24 text-center sm:py-32">
            <Reveal>
              <p className="lp-eyebrow">...join the journey</p>
              <h2 className="lp-display mt-4 text-[clamp(2.1rem,6.4vw,3.75rem)]">
                Be a part of a beautiful journey
              </h2>
              <p className="lp-body mx-auto mt-7 max-w-[48ch] text-[0.95rem] sm:text-base">
                Stay in touch to be the first to know about new releases,
                upcoming shows, and exclusive content. Let&apos;s make this
                journey together.
              </p>
            </Reveal>

            <Reveal delay={120}>
              <div className="mt-11 flex flex-wrap items-center justify-center gap-4">
                <Link href={COMMUNE_ROUTE} className="lp-pill">
                  Join The Creed Community
                </Link>
                <a href={`mailto:${ARTIST.email}`} className="lp-pill lp-pill-ghost">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </a>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------------------- Find him */}
        <section className="lp-panel">
          <div className="mx-auto max-w-6xl px-6 py-20 text-center sm:py-24">
            <Reveal>
              <p className="lp-eyebrow">Find Kendrick...</p>
              <ul className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
                {SOCIAL_LINKS.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="lp-chip"
                    >
                      <PlatformIcon name={link.icon} className="h-4 w-4" />
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------------------- Pull quote */}
        <section className="lp-panel">
          <div className="mx-auto max-w-4xl px-6 py-24 text-center sm:py-32">
            <Reveal>
              <blockquote className="lp-display text-[clamp(1.6rem,4.6vw,2.75rem)] leading-[1.45]">
                <p>
                  &ldquo;You are more than a listener; you are family. Your
                  opinions become part of the many fibers that this brand and
                  dream live through.&rdquo;
                </p>
              </blockquote>
              <Link
                href={COMMUNE_ROUTE}
                className="lp-body mt-9 inline-block text-[0.95rem] underline decoration-black/20 underline-offset-[6px] transition hover:decoration-black/60"
              >
                ...join The Creed
              </Link>
            </Reveal>
          </div>
        </section>
      </main>

      {/* -------------------------------------------------------------- Footer */}
      <footer className="border-t border-black/[0.07] bg-white/30">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-12 sm:flex-row sm:justify-between">
          <div>
            <p className="lp-display text-xl">{ARTIST.name}</p>
            <p className="lp-eyebrow mt-1 text-[0.5625rem]">{ARTIST.tagline}</p>
          </div>

          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {LISTENING_LINKS.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lp-ui text-[0.625rem] text-[#2e2e2e] transition hover:text-[#262626]"
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <Link
                href={COMMUNE_ROUTE}
                className="lp-ui text-[0.625rem] text-[#2e2e2e] transition hover:text-[#262626]"
              >
                Sign in
              </Link>
            </li>
          </ul>
        </div>
      </footer>

      <a
        href="#top"
        className="lp-ui fixed bottom-7 left-1/2 z-40 -translate-x-1/2 rounded-full border border-black/10 bg-white/90 px-5 py-3 text-[0.5625rem] text-[#2e2e2e] backdrop-blur transition hover:text-[#262626] sm:hidden"
      >
        <ArrowDown className="h-4 w-4 rotate-180" />
        <span className="sr-only">Back to top</span>
      </a>
    </LandingGreeting>
  );
}
