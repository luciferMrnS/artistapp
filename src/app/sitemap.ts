import type { MetadataRoute } from "next";
import { STORIES } from "@/lib/stories";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const storyPages = STORIES.map((story) => ({
    url: `${BASE}/stories/${story.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [
    { url: `${BASE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/stories/live-now`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/fan-club`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/auth/login`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/auth/signup`, changeFrequency: "monthly", priority: 0.3 },
    ...storyPages,
  ];
}