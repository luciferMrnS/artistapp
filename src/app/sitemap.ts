import type { MetadataRoute } from "next";
import { STORIES } from "@/lib/stories";
import { getLandingFeed } from "@/lib/db";
import { SITE_URL } from "@/lib/site";

/* The auth pages were listed here, but a login form is a thin, duplicate-prone
   result that competes with the pages worth ranking. They are now disallowed in
   robots.ts instead. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  /* The feed is artist-editable at runtime, so this has to be async. If the
     database is unreachable the sitemap must still build - a broken sitemap is
     worse than one missing the releases. */
  const items = await getLandingFeed().catch(() => []);

  /* /stories/live-now is both a hand-picked priority entry and a normal story,
     so the list is deduped by URL - a repeated <loc> is a defect, not a hint. */
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/stories/live-now`, changeFrequency: "daily", priority: 0.9 },
    ...items.map((item) => ({
      url: `${SITE_URL}/music/${item.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...STORIES.map((story) => ({
      url: `${SITE_URL}/stories/${story.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];

  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.url)) return false;
    seen.add(entry.url);
    return true;
  });
}
