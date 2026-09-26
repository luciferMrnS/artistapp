/**
 * Builds the tiled photo collage that sits behind the landing page, from
 * public/landing/collage-source.jpg.
 *
 *   node scripts/build-landing-collage.mjs
 *
 * The source is 810x1080 (3:4), so it is halved to a 405x540 tile and repeated
 * into a 4x3 block. 1620x1620 is wide enough that a 1440px viewport sees the
 * block near 1:1, and CSS repeats it from there.
 *
 * The collage is deliberately washed out — composited over the page's off-white
 * at low alpha rather than dropped in at full strength. The page is an editorial
 * surface with small type (#302424 on #f5f5f5) and eyebrow labels at 9px, so the
 * background has to read as texture and never compete with the words. Baking the
 * wash into the file means no extra layer, no opacity compositing at paint time,
 * and one cacheable asset.
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SOURCE = resolve(root, "public/landing/collage-source.jpg");
const OUTPUT = resolve(root, "public/landing/collage.webp");

/** Matches the landing page canvas in landing.css. */
const CANVAS = { r: 245, g: 245, b: 245 };

const COLS = 4;
const ROWS = 3;
const TILE_W = 405;
const TILE_H = 540;
/** Off-white gutter so the tiles read as separate photographs, not one texture. */
const GUTTER = 8;
/** How much of the photo survives over the canvas. */
const WASH = 0.55;

const source = sharp(SOURCE);
const { width, height } = await source.metadata();

if (!width || !height) throw new Error("Could not read the collage source image");

// Halve the source rather than crop it, so the tile keeps the original 3:4
// framing instead of a guessed centre crop.
const tileW = Math.round(width / 2);
const tileH = Math.round(height / 2);
if (tileW !== TILE_W || tileH !== TILE_H) {
  throw new Error(
    `Expected a ${TILE_W}x${TILE_H} tile from a 810x1080 source, got ${tileW}x${tileH}. ` +
      `Update TILE_W/TILE_H in this script to match the new source.`
  );
}

const blockW = COLS * TILE_W;
const blockH = ROWS * TILE_H;

// Encoded as JPEG deliberately: a JPEG buffer definitely carries no alpha
// channel, which is what makes the ensureAlpha(WASH) below do what it says.
// (Applying it to a PNG is a no-op, because sharp then treats the alpha as
// already present and the collage comes out at full strength.)
const tile = await sharp(SOURCE)
  .resize(TILE_W, TILE_H, { fit: "fill" })
  .jpeg({ quality: 88 })
  .toBuffer();

const washedTile = await sharp(tile).ensureAlpha(WASH).png().toBuffer();

const layers = [];
for (let row = 0; row < ROWS; row += 1) {
  for (let col = 0; col < COLS; col += 1) {
    layers.push({
      input: washedTile,
      left: col * TILE_W + Math.round(GUTTER / 2),
      top: row * TILE_H + Math.round(GUTTER / 2),
    });
  }
}

await mkdir(dirname(OUTPUT), { recursive: true });

// Tiles are composited straight onto the canvas colour, so the gutters between
// them are the page colour too and the whole block stays seamless.
await sharp({
  create: {
    width: blockW,
    height: blockH,
    channels: 3,
    background: { ...CANVAS },
  },
})
  .composite(layers)
  .webp({ quality: 72, effort: 6 })
  .toFile(OUTPUT);

const { size } = statSync(OUTPUT);

console.log(
  `Landing collage written — ${blockW}x${blockH} (${COLS}x${ROWS} tiles of ${TILE_W}x${TILE_H}, ${WASH * 100}% wash) → public/landing/collage.webp (${(size / 1024).toFixed(0)} KB)`
);
