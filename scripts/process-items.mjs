// Item-icon pipeline: assets/items/*.png (drop folder, ~1024px) →
// client/public/assets/items/*.png (shipped, 256px).
//
// Item icons are the one art category that stays PNG — optimize-art.mjs skips
// this folder because ItemIcon.tsx builds `/assets/items/<id>.png` from the
// item id and falls back to a procedural canvas icon on 404. Filenames are the
// item id minus `item_`, with `_` → `-` (item_copper_helm → copper-helm.png).
//
// Drops that ship with a baked-in background (opaque corners) get the same
// border flood-fill the world art uses, then autocrop, so a checkerboard or
// flat-gray backdrop doesn't end up as a gray square in the inventory.
//
//   node scripts/process-items.mjs          # only items missing a shipped copy
//   node scripts/process-items.mjs --all    # reprocess every item
//   node scripts/process-items.mjs wood ore # reprocess just these
import sharp from "sharp";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(repo, "assets", "items");
const OUT = path.join(repo, "client", "public", "assets", "items");
const SHIPPED_PX = 256;
// Max RGB distance from the corner colour still counted as background.
const BG_TOLERANCE = 60;

const args = process.argv.slice(2);
const all = args.includes("--all");
const only = args.filter((a) => !a.startsWith("--")).map((a) => a.replace(/\.png$/i, ""));

/** Flood-fill from the border, clearing pixels close to the corner colour. */
function stripBakedBackground(data, width, height) {
  const at = (x, y) => (y * width + x) * 4;
  const ref = [data[0], data[1], data[2]];
  const visited = new Uint8Array(width * height);
  const queue = [];
  const consider = (x, y) => {
    const idx = y * width + x;
    if (visited[idx]) return;
    visited[idx] = 1;
    const i = at(x, y);
    const dist = Math.hypot(data[i] - ref[0], data[i + 1] - ref[1], data[i + 2] - ref[2]);
    if (dist < BG_TOLERANCE) queue.push(x, y);
  };
  for (let x = 0; x < width; x++) {
    consider(x, 0);
    consider(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    consider(0, y);
    consider(width - 1, y);
  }
  for (let head = 0; head < queue.length; head += 2) {
    const cx = queue[head];
    const cy = queue[head + 1];
    data[at(cx, cy) + 3] = 0;
    if (cx + 1 < width) consider(cx + 1, cy);
    if (cx > 0) consider(cx - 1, cy);
    if (cy + 1 < height) consider(cx, cy + 1);
    if (cy > 0) consider(cx, cy - 1);
  }
}

if (!existsSync(SRC)) {
  console.error(`No source folder at ${SRC}`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const sources = readdirSync(SRC).filter((f) => f.toLowerCase().endsWith(".png"));
const todo = sources.filter((f) => {
  const name = f.replace(/\.png$/i, "");
  if (only.length > 0) return only.includes(name);
  if (all) return true;
  return !existsSync(path.join(OUT, f));
});

if (todo.length === 0) {
  console.log(`Nothing to do — ${sources.length} item(s) already shipped. Use --all to redo.`);
  process.exit(0);
}

for (const file of todo) {
  const src = path.join(SRC, file);
  const dest = path.join(OUT, file);
  const img = sharp(src);
  const meta = await img.metadata();

  // Only pay for the flood-fill when the art actually has an opaque border.
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const opaqueCorner = data[3] > 250;
  if (opaqueCorner) stripBakedBackground(data, info.width, info.height);

  const outSize = statSync(src).size;
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim()
    .resize(SHIPPED_PX, SHIPPED_PX, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(dest);

  console.log(
    `${file}: ${meta.width}x${meta.height} ${(outSize / 1024).toFixed(0)}KB` +
      `${opaqueCorner ? " (bg stripped)" : ""} -> ${SHIPPED_PX}px ${(statSync(dest).size / 1024).toFixed(0)}KB`,
  );
}

console.log(`\nShipped ${todo.length} item icon(s) to client/public/assets/items.`);
