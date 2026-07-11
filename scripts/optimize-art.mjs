// One-shot art optimizer: shrink the shipped copies in client/public/assets
// to WebP at display-appropriate resolution. Source originals in root assets/
// are untouched. Rerun after dropping a new art batch, then update the code
// references if any new folder is added.
//
//   node scripts/optimize-art.mjs          # convert + delete the source .png
//   node scripts/optimize-art.mjs --keep   # convert, keep .png alongside
import sharp from "sharp";
import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../client/public/assets");
const keep = process.argv.includes("--keep");

// Folder → max edge in px. Display sizes: avatars 60 world px (max zoom 2.8,
// DPR ≤3 ⇒ ~500 px worst case), zone tiles/structures ≤192 world px, mobs and
// NPCs ≤ ~100 world px. 512 keeps everything retina-sharp at max zoom.
const TARGETS = [
  { dir: "characters", max: 512 },
  { dir: ".", max: 512 }, // zone assets (ground/structures/resources)
  { dir: "mobs", max: 512 },
  { dir: "npcs", max: 512 },
  { dir: "world", max: 512 },
];

let before = 0;
let after = 0;

for (const { dir, max } of TARGETS) {
  const folder = path.join(root, dir);
  if (!existsSync(folder)) continue;
  const files = readdirSync(folder).filter((f) => f.toLowerCase().endsWith(".png"));
  for (const file of files) {
    const src = path.join(folder, file);
    const out = src.replace(/\.png$/i, ".webp");
    const size = statSync(src).size;
    const img = sharp(src);
    const meta = await img.metadata();
    const scale = Math.min(1, max / Math.max(meta.width ?? max, meta.height ?? max));
    await img
      .resize(scale < 1 ? { width: Math.round((meta.width ?? max) * scale) } : undefined)
      .webp({ quality: 85, alphaQuality: 90, effort: 6 })
      .toFile(out);
    const outSize = statSync(out).size;
    before += size;
    after += outSize;
    if (!keep) unlinkSync(src);
    console.log(
      `${path.join(dir, file)}: ${meta.width}x${meta.height} ${(size / 1024).toFixed(0)}KB -> ${(outSize / 1024).toFixed(0)}KB`,
    );
  }
}

console.log(`\nTOTAL: ${(before / 1048576).toFixed(1)}MB -> ${(after / 1048576).toFixed(1)}MB`);
