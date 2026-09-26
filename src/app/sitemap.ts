import type { MetadataRoute } from "next";
import { STORIES } from "@/lib/stories";
import { SITE_URL } from "@/lib/site";

/* The auth pages were listed here, but a login form is a thin, duplicate-prone
   result that competes with the pages worth ranking. They are now disallowed in
   robots.ts instead. */
export default function sitemap(): MetadataRoute.Sitemap {
  /* /stories/live-now is both a hand-picked priority entry and a normal story,
     so the list is deduped by URL - a repeated <loc> is a defect, not a hint. */
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/stories/live-now`, changeFrequency: "daily", priority: 0.9 },
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
