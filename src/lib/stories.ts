/**
 * Site "stories" — the clickable highlight cards on the home feed.
 * Each slug maps to a themed page at /stories/[slug].
 */
import {
  Disc3,
  Camera,
  Radio,
  Heart,
  Mic2,
  Video,
  type LucideIcon,
} from "lucide-react";

export interface Story {
  slug: string;
  name: string;
  /** Tailwind gradient classes used for the card + page hero */
  tone: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
}

export const STORIES: Story[] = [
  {
    slug: "new-drop",
    name: "New drop",
    tone: "from-violet-500 to-pink-500",
    tagline: "Fresh out the lab",
    description:
      "The latest release from Kendrick David — first listens, artwork and the story behind the track, straight to the community before it goes anywhere else.",
    icon: Disc3,
  },
  {
    slug: "behind-the-scenes",
    name: "Behind the scenes",
    tone: "from-cyan-500 to-blue-500",
    tagline: "What the cameras don't show",
    description:
      "Raw moments from the road, the booth and the writing room. Unpolished, unfiltered — the process behind the music.",
    icon: Camera,
  },
  {
    slug: "live-now",
    name: "Live now",
    tone: "from-rose-500 to-orange-500",
    tagline: "In the moment, together",
    description:
      "Listening parties, Q&As and studio streams happening right now. Pull up a seat — the room is open.",
    icon: Radio,
  },
  {
    slug: "fan-club",
    name: "Fan club",
    tone: "from-emerald-500 to-teal-500",
    tagline: "Where the day-ones live",
    description:
      "Subscribe to be part of the inner circle — early drops, exclusive content and a community of real ones.",
    icon: Heart,
  },
  {
    slug: "studio",
    name: "Studio",
    tone: "from-yellow-500 to-amber-500",
    tagline: "Where the records get made",
    description:
      "Sessions, gear, takes and out-takes. A look at the room where every song starts.",
    icon: Mic2,
  },
  {
    slug: "videos",
    name: "Videos",
    tone: "from-fuchsia-500 to-purple-500",
    tagline: "Watch the visuals",
    description:
      "Music videos, live cuts and short films from the artist — every upload gets a clean, uniform thumbnail, a title and a caption to match.",
    icon: Video,
  },
];

export function getStory(slug: string): Story | undefined {
  return STORIES.find((s) => s.slug === slug);
}
