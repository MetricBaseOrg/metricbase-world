// One-time (re-runnable) import of the X content system from the owner's
// OneDrive markdown into Neon, which becomes the source of truth.
//
//   node scripts/import-x-content.mjs [--dir "D:/OneDrive/metricbase-x"] [--dry]
//
// Requires DATABASE_URL. Point it at a Neon BRANCH first — a bad parse against
// prod is a mess to unpick, and the parse is heuristic by nature: it is reading
// prose that was written for a human, not a schema.
//
// Idempotent on the post ref ("#7"), so re-running refreshes copy without
// duplicating rows or resetting a post you have already marked posted.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

const args = process.argv.slice(2);
const argValue = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const DIR = argValue("--dir", "D:/OneDrive/metricbase-x");
const DRY = args.includes("--dry");

if (!process.env.DATABASE_URL && !DRY) {
  console.error("DATABASE_URL is required (or pass --dry to just parse).");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** "Mon 28 Jul" → 2026-07-28. The calendar omits the year; it was written for
 *  the current season, so anchor on the file's stated year when present and the
 *  current year otherwise. */
function parseSlotDate(text, year) {
  const m = text.match(/(\d{1,2})\s+([A-Za-z]{3})/);
  if (!m) return null;
  const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
  if (month == null) return null;
  const day = Number(m[1]);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Cadence slot: Mon = economy report, Wed = build-in-public, Fri = game/players.
 *
 * The weekday WORD in the heading wins over the weekday computed from the date,
 * because the two disagree in the source: week 1 is labelled "Mon 28 Jul" but
 * 2026-07-28 is a Tuesday (the calendar was drafted against a year where that
 * date was a Monday). slot_kind is a category describing intent, so the author's
 * word is the better signal; slot_date keeps the literal date either way.
 */
function slotKindFor(heading, date) {
  const lower = heading.toLowerCase();
  if (lower.includes("economy report")) return "mon_economy";
  const word = lower.match(/\b(mon|tue|wed|thu|fri|sat|sun)\b/)?.[1];
  if (word === "mon") return "mon_economy";
  if (word === "wed") return "wed_build";
  if (word === "fri") return "fri_game";
  if (word) return "extra";
  if (!date) return "extra";
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (day === 1) return "mon_economy";
  if (day === 3) return "wed_build";
  if (day === 5) return "fri_game";
  return "extra";
}

function formatFor(heading) {
  const l = heading.toLowerCase();
  if (l.includes("economy report")) return "economy_report";
  if (l.includes("bug")) return "bug_story";
  if (l.includes("season")) return "announcement";
  if (l.includes("video")) return "video";
  if (l.includes("thread")) return "thread";
  return "build_in_public";
}

/** Pull fenced ```text blocks out of a section body, in order.
 *  The `\r?` matters — these files are CRLF, and requiring a bare \n after the
 *  fence silently matched nothing at all. */
function fencedBlocks(section) {
  const out = [];
  const re = /```(?:text)?\r?\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(section))) out.push(m[1].trim());
  return out;
}

/** Body text for a section that has no fenced block: strip the heading, the
 *  horizontal rules and the bold labels, and keep whatever prose is left. */
function prosePlaceholder(section) {
  return section
    .split(/\r?\n/)
    .slice(1)
    .filter((line) => !/^\s*(-{3,}|\*\*[^*]+\*\*\s*)$/.test(line))
    .join("\n")
    .trim();
}

function parseCalendar(md) {
  const year = md.match(/\b(20\d{2})\b/)?.[1] ?? String(new Date().getFullYear());
  const posts = [];

  // Sections look like:  ## #1 — Mon 28 Jul · Season 2 announcement
  // Split on the heading so each chunk carries its own fenced blocks.
  // Refs are not always plain integers — the calendar has #4b and #4c, inserted
  // when a ship post needed a slot between two numbered ones.
  const parts = md.split(/\r?\n(?=##\s+#\d)/);
  for (const part of parts) {
    const heading = part.match(/^##\s+#(\d+[a-z]?)\s*[—-]\s*(.+?)\r?$/m);
    if (!heading) continue;
    const ref = `#${heading[1]}`;
    const rest = heading[2].trim();

    // "Mon 28 Jul · Season 2 announcement" — date before the ·, title after.
    const [datePart, ...titleParts] = rest.split("·");
    const slotDate = parseSlotDate(datePart, year);
    const title = (titleParts.join("·").trim() || rest)
      .replace(/\*\*/g, "")
      .replace(/\(SHIP POST[^)]*\)/i, "")
      .replace(/[—-]\s*POSTED\s*✅/i, "")
      .trim();

    const blocks = fencedBlocks(part);
    // Convention in the file: first block is the post copy, the block following
    // an "**Image prompt**" line is the image prompt.
    //
    // Six of the calendar's sections are prose placeholders with no fence at all
    // ("Post text as written previously"). Import that prose as the body rather
    // than an empty string — a blank draft loses the only note about what the
    // post was meant to be.
    const body = blocks[0] ?? prosePlaceholder(part);
    const imagePrompt = part.includes("Image prompt") ? (blocks[1] ?? null) : null;

    posts.push({
      ref,
      slotDate,
      slotKind: slotKindFor(rest, slotDate),
      // The calendar marks shipped posts inline; honour that so the importer
      // doesn't hand back a queue of "drafts" that are already on the timeline.
      status: /POSTED\s*✅/i.test(rest) ? "posted" : "drafted",
      format: formatFor(rest),
      title: title.slice(0, 200),
      hook: (body.split("\n")[0] ?? "").trim(),
      body,
      imagePrompt,
      sourceVersion: rest.match(/v(\d+\.\d+(?:\.\d+)?)/)?.[1] ?? null,
    });
  }
  return posts;
}

function parseTargets(md) {
  const targets = [];
  let room = "";
  for (const line of md.split("\n")) {
    const heading = line.match(/^##\s+(?:Room\s+\d+\s*[—-]\s*)?(.+)$/);
    if (heading) {
      room = heading[1].trim();
      continue;
    }
    // | `@handle` | Who they are | Confidence |
    const row = line.match(/^\|\s*`?@([A-Za-z0-9_]{1,15})`?\s*\|([^|]*)\|([^|]*)\|/);
    if (!row) continue;
    targets.push({
      handle: row[1],
      why: row[2].trim(),
      cadence: room.slice(0, 40),
      notes: row[3].trim() || null,
    });
  }
  return targets;
}

function parseTemplates(md) {
  const templates = [];
  const parts = md.split(/\n(?=###\s+)/);
  for (const part of parts) {
    const heading = part.match(/^###\s+([\d.]+)\s*(.+)$/m);
    if (!heading) continue;
    const blocks = fencedBlocks(part);
    if (!blocks.length) continue;
    templates.push({
      id: `tpl_${heading[1].replace(/\./g, "_")}`,
      name: heading[2].replace(/\*\*/g, "").trim().slice(0, 120),
      format: heading[2].toLowerCase().includes("bug") ? "bug_story" : "build_in_public",
      skeleton: blocks[0],
      notes: blocks.length > 1 ? `${blocks.length - 1} ready-to-use variant(s) in the source file.` : null,
    });
  }
  return templates;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function readIfPresent(name) {
  try {
    return await readFile(join(DIR, name), "utf8");
  } catch {
    console.warn(`  (skipped ${name} — not found)`);
    return null;
  }
}

const calendarMd = await readIfPresent("content-calendar.md");
const targetsMd = await readIfPresent("engagement-targets.md");
const libraryMd = await readIfPresent("post-library.md");

const posts = calendarMd ? parseCalendar(calendarMd) : [];
const targets = targetsMd ? parseTargets(targetsMd) : [];
const templates = libraryMd ? parseTemplates(libraryMd) : [];

console.log(`Parsed ${posts.length} posts, ${targets.length} targets, ${templates.length} templates from ${DIR}`);
for (const p of posts) {
  console.log(`  ${p.ref.padEnd(4)} ${(p.slotDate ?? "unscheduled").padEnd(12)} ${p.slotKind.padEnd(12)} ${p.title}`);
}

if (DRY) {
  console.log("\n--dry: nothing written.");
  process.exit(0);
}

// Imported lazily so --dry runs without `pg` at all. `pg` is a server-workspace
// dependency and this script lives at the repo root, so plain `import "pg"`
// resolves against the root node_modules and misses it — fall back to the
// workspace copy by path.
const pg = await import("pg")
  .catch(() => import(new URL("../server/node_modules/pg/lib/index.js", import.meta.url).href))
  .then((m) => m.default ?? m);

const url = new URL(process.env.DATABASE_URL);
url.searchParams.delete("channel_binding");
const pool = new pg.Pool({
  connectionString: url.toString(),
  ssl: url.hostname.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
});

let inserted = 0;
let updated = 0;

for (const p of posts) {
  const res = await pool.query(
    // Status is deliberately NOT refreshed on conflict: a re-import must never
    // knock a post you've already marked posted back to "drafted".
    `INSERT INTO x_posts (ref, slot_date, slot_kind, status, format, title, hook, body, image_prompt, source_version, posted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (ref) DO UPDATE SET
       slot_date = EXCLUDED.slot_date, slot_kind = EXCLUDED.slot_kind, format = EXCLUDED.format,
       title = EXCLUDED.title, hook = EXCLUDED.hook, body = EXCLUDED.body,
       image_prompt = EXCLUDED.image_prompt, source_version = EXCLUDED.source_version, updated_at = NOW()
     RETURNING (xmax = 0) AS inserted`,
    [
      p.ref, p.slotDate, p.slotKind, p.status, p.format, p.title, p.hook, p.body, p.imagePrompt,
      p.sourceVersion,
      // Already-posted entries need a posted_at for the signup attribution join;
      // the slot date is the best evidence the markdown carries.
      p.status === "posted" && p.slotDate ? `${p.slotDate}T12:00:00Z` : null,
    ],
  );
  if (res.rows[0]?.inserted) inserted += 1;
  else updated += 1;
}

for (const t of targets) {
  await pool.query(
    `INSERT INTO x_targets (handle, why, cadence, notes) VALUES ($1,$2,$3,$4)
     ON CONFLICT (handle) DO UPDATE SET why = $2, cadence = $3, notes = $4`,
    [t.handle, t.why, t.cadence, t.notes],
  );
}

for (const t of templates) {
  await pool.query(
    `INSERT INTO x_templates (id, name, format, skeleton, notes) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (id) DO UPDATE SET name = $2, format = $3, skeleton = $4, notes = $5`,
    [t.id, t.name, t.format, t.skeleton, t.notes],
  );
}

console.log(`\nPosts: ${inserted} inserted, ${updated} refreshed. Targets: ${targets.length}. Templates: ${templates.length}.`);
await pool.end();
