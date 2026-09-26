import { NextResponse } from "next/server";
import { findUserById } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";
import { isValidReleaseDate } from "@/lib/landing-feed";

/**
 * Every /api/landing-feed route is artist-only. The role is read from the
 * database rather than trusted from the JWT, so a stale or tampered token
 * cannot grant access to the feed.
 *
 * Returns the artist's user id, or the response to send straight back.
 */
export async function requireArtist(): Promise<
  { userId: string } | NextResponse
> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const fullUser = await findUserById(user.userId);
  if (!fullUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (fullUser.role !== "artist") {
    return NextResponse.json(
      { error: "Only the artist can edit the landing feed" },
      { status: 403 }
    );
  }

  return { userId: fullUser.id };
}

export function isGuardError(
  result: { userId: string } | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}

const LIMITS = {
  title: 120,
  note: 120,
  alt: 300,
  /* Long enough for a real paragraph, short enough that a paste of a whole
     article cannot bloat the page and its structured data. Matches the CHECK
     constraint in migration_landing_feed_copy.sql. */
  description: 1200,
} as const;

export type Provider = "youtube" | "vimeo";

/** YouTube ids are 11 url-safe base64 chars; Vimeo ids are numeric. */
const PROVIDER_ID = /^[A-Za-z0-9_-]{4,32}$/;
const VIMEO_ID = /^\d{4,20}$/;

/** Stable feed ids double as storage path segments and React keys. */
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,59}$/;

export type ParsedItem = {
  id?: string;
  kind: "video" | "photo";
  title: string;
  note?: string | null;
  releasedOn?: string | null;
  description?: string | null;
  provider?: Provider | null;
  providerId?: string | null;
  posterUrl: string;
  posterPath?: string | null;
  posterWidth: number;
  posterHeight: number;
  alt: string;
};

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Normalise a release date, or explain why it is not usable. The artist is
 * given a chance to correct the field rather than having the value dropped, so
 * they find out their date did not save instead of finding a page with no date
 * on it three months later.
 */
function releaseDate(value: unknown): { value: string } | { error: string } {
  if (value === undefined || value === null || value === "") return { value: "" };
  if (typeof value !== "string") return { error: "Release date must be a date" };
  const trimmed = value.trim();
  if (!isValidReleaseDate(trimmed)) {
    return { error: "Release date must be a real date in YYYY-MM-DD form" };
  }
  return { value: trimmed };
}

/**
 * A poster is either one of the files committed under public/landing or a
 * public object in this project's own Supabase bucket. Anything else would be
 * an image host the artist did not choose, and next/image would reject it at
 * render time anyway — so fail here with a message that explains why.
 */
function validPosterUrl(url: string): boolean {
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "supabase.co" || parsed.hostname.endsWith(".supabase.co"))
    );
  } catch {
    return false;
  }
}

function validDimension(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= 20000
  );
}

/**
 * Validate the shared shape of a create/update body. `requireId` distinguishes
 * the two: create allows the server to derive an id from the title, update
 * never touches it.
 */
export function parseItemBody(
  body: unknown,
  { requireId }: { requireId: boolean }
): { item: ParsedItem } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request body" };
  const raw = body as Record<string, unknown>;

  const kind = raw.kind === "video" ? "video" : raw.kind === "photo" ? "photo" : null;
  if (!kind) return { error: 'Kind must be "video" or "photo"' };

  const title = text(raw.title, LIMITS.title);
  if (!title) return { error: "Title is required" };

  const alt = text(raw.alt, LIMITS.alt);
  if (!alt) {
    return { error: "Alt text is required — it is what screen readers announce" };
  }

  const posterUrl = typeof raw.posterUrl === "string" ? raw.posterUrl.trim() : "";
  if (!posterUrl) return { error: "A poster image is required" };
  if (!validPosterUrl(posterUrl)) {
    return { error: "Poster must be an uploaded image or a path under /public" };
  }

  if (!validDimension(raw.posterWidth) || !validDimension(raw.posterHeight)) {
    return { error: "Poster width and height are required" };
  }

  const note = text(raw.note, LIMITS.note);
  const description = text(raw.description, LIMITS.description);

  const released = releaseDate(raw.releasedOn);
  if ("error" in released) return { error: released.error };

  // Videos need a player; photos must not carry one. Enforced here as well as
  // in the database CHECK so the artist gets a readable message.
  let provider: Provider | null = null;
  let providerId: string | null = null;

  if (kind === "video") {
    if (raw.provider !== "youtube" && raw.provider !== "vimeo") {
      return { error: 'Provider must be "youtube" or "vimeo"' };
    }
    provider = raw.provider;
    const id = typeof raw.providerId === "string" ? raw.providerId.trim() : "";
    const valid = provider === "youtube"
      ? PROVIDER_ID.test(id)
      : VIMEO_ID.test(id);
    if (!valid) {
      return {
        error:
          provider === "youtube"
            ? "That does not look like a YouTube video id"
            : "That does not look like a Vimeo video id",
      };
    }
    providerId = id;
  }

  /* One return for both kinds: the two branches used to build the same object
     separately, which is how a field ends up saved for a video and silently
     dropped for a photo. */
  return {
    item: {
      ...(requireId ? {} : { id: text(raw.id, 60) || undefined }),
      kind,
      title,
      alt,
      note: note || null,
      releasedOn: released.value || null,
      description: description || null,
      provider,
      providerId,
      posterUrl,
      posterPath: typeof raw.posterPath === "string" ? raw.posterPath : null,
      posterWidth: raw.posterWidth,
      posterHeight: raw.posterHeight,
    },
  };
}

/** Feed ids are used in storage paths, so keep them to a safe charset. */
export function isValidFeedId(id: string): boolean {
  return SAFE_ID.test(id);
}
