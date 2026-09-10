// One-off: point the demo picture posts at local SVG images in /public/demo
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Minimal .env.local parser (no dotenv dependency needed)
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const updates = [
  ["post_1788648819510_s41kqomsl", "/demo/studio.svg"],
  ["post_1788648820179_chg7l3bjf", "/demo/live.svg"],
  ["post_1788648820891_aw3chx4hk", "/demo/vinyl.svg"],
];

for (const [id, image] of updates) {
  const { error } = await supabase.from("posts").update({ image }).eq("id", id);
  if (error) {
    console.error(`FAIL ${id}:`, error.message);
    process.exitCode = 1;
  } else {
    console.log(`OK ${id} -> ${image}`);
  }
}
