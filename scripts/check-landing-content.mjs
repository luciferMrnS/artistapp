/**
 * Guards the landing page's static feed against the mistakes that are easy to
 * make when hand-editing it: a poster that was never uploaded, a duplicate id,
 * a video with no player. TypeScript already covers the shape of an entry;
 * this covers the things that are wrong at runtime instead.
 *
 * Once database/migration_landing_feed.sql has been applied the artist edits
 * the feed from /landing-feed and this array is only the fallback — but the
 * fallback still has to be correct, or it is what the public page shows if the
 * table is ever missing.
 *
 *   node --experimental-strip-types scripts/check-landing-content.mjs
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const feedUrl = pathToFileURL(resolve(root, "src/lib/landing-feed.ts")).href;

const { STATIC_FEED, embedSrc, isValidReleaseDate, formatReleaseDate } = await import(feedUrl);

const problems = [];

/** YouTube ids are 11 word characters; Vimeo ids are digits. */
const YOUTUBE_ID = /^[\w-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;

const seenIds = new Set();

for (const item of STATIC_FEED) {
  const where = `STATIC_FEED entry "${item?.id ?? "<missing id>"}"`;

  if (!item.id) {
    problems.push(`${where}: no id. It is the React key — give it a stable slug.`);
  } else if (seenIds.has(item.id)) {
    problems.push(`${where}: duplicate id. Ids must be unique.`);
  } else {
    seenIds.add(item.id);
  }

  if (!item.title) problems.push(`${where}: no title.`);

  /* These two reach Google as structured data, so a bad value is worse than a
     missing one - the page would ship a claim it cannot stand behind. */
  if (item.releasedOn && !isValidReleaseDate(item.releasedOn)) {
    problems.push(
      `${where}: releasedOn "${item.releasedOn}" is not a real date in YYYY-MM-DD form. It is sent to Google as uploadDate.`
    );
  }
  if (item.description && item.description.length > 1200) {
    problems.push(
      `${where}: description is ${item.description.length} characters. The limit is 1200, and the database rejects anything longer.`
    );
  }

  const { poster } = item;
  if (!poster) {
    problems.push(`${where}: no poster.`);
  } else {
    if (!poster.src.startsWith("/")) {
      problems.push(
        `${where}: poster.src "${poster.src}" is not a path under public/. Seeded fallback posters must be committed files, so use "/landing/…".`
      );
      // Strip the leading slash — otherwise resolve() treats it as an
      // absolute path and checks the filesystem root.
    } else if (!existsSync(resolve(root, "public", poster.src.slice(1)))) {
      problems.push(
        `${where}: poster.src "${poster.src}" does not exist in public/. Add the image.`
      );
    }

    if (!poster.alt) problems.push(`${where}: poster has no alt text.`);
    if (!(poster.width > 0) || !(poster.height > 0)) {
      problems.push(
        `${where}: poster is ${poster.width}x${poster.height}. The card takes its shape from these.`
      );
    }
  }

  if (item.kind === "video") {
    const src = embedSrc(item);
    if (!src) {
      problems.push(`${where}: kind "video" but no source.`);
    } else if ("youtube" in item.source) {
      if (!YOUTUBE_ID.test(item.source.youtube)) {
        problems.push(
          `${where}: "${item.source.youtube}" is not a YouTube id (expected 11 characters). Use the id, not the whole URL.`
        );
      }
    } else if (!VIMEO_ID.test(item.source.vimeo)) {
      problems.push(
        `${where}: "${item.source.vimeo}" is not a Vimeo id. Use the digits, not the whole URL.`
      );
    }
  } else if (item.kind === "photo") {
    if ("source" in item && item.source) {
      problems.push(`${where}: kind "photo" should not carry a source.`);
    }
  } else {
    problems.push(`${where}: unknown kind "${item.kind}". Use "video" or "photo".`);
  }
}

/* The release-date formatter is the one piece of this that fails *silently*:
   routing the string through `new Date()` reads it as UTC midnight, so in any
   negative-offset timezone "2024-05-01" quietly becomes April 30 - a release
   page claiming the wrong day, with no error anywhere. Pin the output so the
   parts-based implementation is the only one that passes. */
for (const [input, expected] of [
  ["2024-05-01", "1 May 2024"],
  ["2024-12-31", "31 December 2024"],
  ["2024-01-09", "9 January 2024"],
]) {
  const actual = formatReleaseDate(input);
  if (actual !== expected) {
    problems.push(
      `formatReleaseDate("${input}") returned ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}.`
    );
  }
}

/* Values shaped like a date that are not one. These would reach uploadDate if
   they were not rejected, and Google treats a bad date as a quality problem. */
for (const bad of ["2024-13-01", "2024-02-31", "2024-5-1", "01/05/2024", "May 2024", "2024-05-01T00:00:00Z"]) {
  if (isValidReleaseDate(bad)) {
    problems.push(
      `isValidReleaseDate("${bad}") returned true, but it is not a plain YYYY-MM-DD calendar date.`
    );
  }
}

/* The migration seeds the same items so the artist's editor opens with today's
   feed already editable. If the two lists drift, the fallback and a freshly
   migrated database disagree — catch that here rather than on the live page. */
const migrationPath = resolve(root, "database/migration_landing_feed.sql");
if (existsSync(migrationPath)) {
  const sql = readFileSync(migrationPath, "utf8");
  const seeded = [...sql.matchAll(/^\s*\('([^']+)',\s*\d+,\s*'(?:video|photo)'/gm)].map(
    (match) => match[1]
  );

  if (seeded.length === 0) {
    problems.push(
      "database/migration_landing_feed.sql: no seed rows found — the INSERT may have been reformatted."
    );
  } else {
    for (const id of seenIds) {
      if (!seeded.includes(id)) {
        problems.push(
          `STATIC_FEED has "${id}" but the migration does not seed it. Add it to the INSERT so a new database starts from the same feed.`
        );
      }
    }
    for (const id of seeded) {
      if (!seenIds.has(id)) {
        problems.push(
          `The migration seeds "${id}" but STATIC_FEED does not have it. Add it to src/lib/landing-feed.ts.`
        );
      }
    }
  }
}

/* The page background is the collage, so a missing or emptied asset would ship
   as a silently blank backdrop. Its source is committed too, which is what makes
   the collage regeneratable with `npm run build:collage`. */
for (const [label, file] of [
  ["collage.webp", "public/landing/collage.webp"],
  ["collage-source.jpg", "public/landing/collage-source.jpg"],
]) {
  if (!existsSync(resolve(root, file))) {
    problems.push(`public/landing/${label} is missing — the page background would be blank. Run \`npm run build:collage\`.`);
  }
}

if (problems.length > 0) {
  console.error(`\nLanding content check failed (${problems.length}):\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("\n");
  process.exit(1);
}

const videos = STATIC_FEED.filter((item) => item.kind === "video").length;
const photos = STATIC_FEED.length - videos;
console.log(
  `Landing content OK — ${STATIC_FEED.length} fallback feed entries (${videos} video, ${photos} photo), all posters found, migration seed in sync.`
);
