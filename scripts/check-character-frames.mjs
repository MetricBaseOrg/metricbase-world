// Character animation frame checker — see docs/character-prompts.md.
//
// Catches the two defects that ruin an animation and are invisible in a
// thumbnail: the feet drifting between frames (the character bobs), and the
// body changing size between frames (the character pulses). Both are the
// normal failure mode of generated art, because nothing in an image model
// holds a baseline across separate generations.
//
// Also catches a frame that is simply MISSING from a declared action, which
// the engine does not report: resolveHdPose falls back to that direction's
// idle pose, so a half-drawn action plays as a stutter rather than an error.
//
//   node scripts/check-character-frames.mjs         # every character in the manifest
//   node scripts/check-character-frames.mjs boy     # just this one
import sharp from "sharp";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(repo, "client", "public", "assets", "characters");
const MANIFEST = path.join(DIR, "manifest.json");
const DIRECTIONS = ["front", "back", "right", "tqright"];

// Tolerances are PER ACTION, and are derived from the art already shipped
// rather than from an ideal — the job here is to catch a new batch drifting
// away from the house style, not to relitigate the house style.
//
// Locomotion is held tight: in idle and walk the feet are planted or in
// contact, so any baseline movement is drift and reads as a bob. Chop, attack
// and fish legitimately crouch, rise and lunge — the shipped chop moves its
// baseline 3.5% and changes height 5.3% on purpose — so those get real room.
const TOLERANCE = {
  idle: { baseline: 0.5, height: 2 },
  walk: { baseline: 1.0, height: 4 },
  chop: { baseline: 4.0, height: 6 },
  attack: { baseline: 4.0, height: 6 },
  fish: { baseline: 4.0, height: 6 },
};
const DEFAULT_TOLERANCE = { baseline: 4.0, height: 6 };

if (!existsSync(MANIFEST)) {
  console.error(`No manifest at ${MANIFEST}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")).characters ?? {};
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const characters = only.length > 0 ? only : Object.keys(manifest);

/** Tight alpha bounding box, as percentages of the frame. */
async function measure(file) {
  const img = sharp(file).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  let top = Infinity;
  let bottom = -1;
  let left = Infinity;
  let right = -1;
  let opaqueCorners = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 16) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  for (const [cx, cy] of [[0, 0], [info.width - 1, 0], [0, info.height - 1], [info.width - 1, info.height - 1]]) {
    if (data[(cy * info.width + cx) * 4 + 3] > 200) opaqueCorners++;
  }
  return {
    width: info.width,
    height: info.height,
    square: info.width === info.height,
    opaqueCorners,
    feetPct: (bottom / info.height) * 100,
    headPct: (top / info.height) * 100,
    charHeightPct: ((bottom - top) / info.height) * 100,
    centrePct: (((left + right) / 2) / info.width) * 100,
  };
}

function resolveFrame(character, dir, action, frame) {
  for (const ext of [".webp", ".png"]) {
    const p = path.join(DIR, `${character}-${dir}-${action}-${frame}${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}

let problems = 0;
const note = (msg) => {
  problems++;
  console.log(`  ✗ ${msg}`);
};

for (const character of characters) {
  const counts = manifest[character];
  if (!counts) {
    console.log(`\n${character}: not in manifest — the engine will not load it at all.`);
    problems++;
    continue;
  }
  console.log(`\n=== ${character} ===`);

  for (const [action, count] of Object.entries(counts)) {
    for (const dir of DIRECTIONS) {
      const rows = [];
      let missing = 0;
      for (let f = 0; f < count; f++) {
        const file = resolveFrame(character, dir, action, f);
        if (!file) {
          missing++;
          // Not a crash — resolveHdPose deliberately falls back to this
          // direction's idle pose rather than the procedural doll. Reported
          // because that fallback is silent, and a half-drawn action reads
          // in-game as the character freezing mid-swing.
          note(`${character}-${dir}-${action}-${f} is MISSING — manifest declares ${count}, so this pose plays as ${dir} idle`);
          continue;
        }
        const m = await measure(file);
        rows.push({ f, ...m });
        if (!m.square) note(`${path.basename(file)} is ${m.width}x${m.height}, not square`);
        if (m.opaqueCorners > 0) note(`${path.basename(file)} has ${m.opaqueCorners} opaque corner(s) — background not transparent`);
      }
      if (rows.length === 0) continue;

      const feet = rows.map((r) => r.feetPct);
      const heights = rows.map((r) => r.charHeightPct);
      const feetSpread = Math.max(...feet) - Math.min(...feet);
      const heightSpread = Math.max(...heights) - Math.min(...heights);

      const label = `${dir}/${action}`.padEnd(18);
      const detail = rows.map((r) => `f${r.f} feet=${r.feetPct.toFixed(1)}%`).join(" ");
      console.log(`  ${label} ${detail}`);

      const tol = TOLERANCE[action] ?? DEFAULT_TOLERANCE;
      if (feetSpread > tol.baseline) {
        note(`${character} ${dir}/${action}: baseline moves ${feetSpread.toFixed(2)}% between frames (max ${tol.baseline}%) — will bob`);
      }
      if (heightSpread > tol.height) {
        note(`${character} ${dir}/${action}: character height varies ${heightSpread.toFixed(2)}% between frames (max ${tol.height}%) — will pulse`);
      }
      if (missing > 0 && missing < count) {
        note(`${character} ${dir}/${action}: ${missing} of ${count} frames missing — partial actions stutter`);
      }
    }
  }
}

console.log(
  problems === 0
    ? "\n✅ All checked frames are consistent."
    : `\n❌ ${problems} problem(s) found.`,
);
process.exit(problems === 0 ? 0 : 1);
