#!/usr/bin/env node
// Backfill a verified Season 1 season-post so a late claimant can be paid.
//
// WHY THIS EXISTS: the in-game post verifier (ZoneRoom.handleSeasonPostVerify)
// always records against currentSeason(), so once S1 ended a player can no
// longer self-serve an S1 post. This runs the SAME validation the game does
// (linked-handle match, per-player code, required tag, URL not reused) and
// writes the row with season_id='S1'. It never pays — after it succeeds, use
// the Season payout panel: Preview, then Execute (idempotent, pays only the
// newly-eligible player).
//
// USAGE (from repo root):
//   node server/scripts/backfill-s1-post.mjs "<PLAYER_NAME>" "<POST_URL>"
// Add --commit to actually write; without it the script only validates.
//
// Preconditions the player must have done FIRST:
//   1. Connected their X account in-game (sets characters.x_user_id).
//   2. Posted a public tweet from that handle containing their code + tag.

import fs from "node:fs";
import pg from "pg";
import { readTweet, isTweetUrl, taskCode } from "../dist/auth/xVerify.js";
import { getXStatus } from "../dist/db/xLink.js";
import { SEASON_POST_REQUIRED_TAG } from "@metricbase/shared";

const SEASON_ID = "S1";
const [, , playerName, postUrl, ...rest] = process.argv;
const COMMIT = rest.includes("--commit");
const seasonPostTaskId = (seasonId) => `season-reward:${seasonId}`;

if (!playerName || !postUrl) {
  console.error('Usage: node server/scripts/backfill-s1-post.mjs "<PLAYER_NAME>" "<POST_URL>" [--commit]');
  process.exit(2);
}

// Load .env into process.env so the imported helpers (getXStatus → getPool)
// find DATABASE_URL — they read process.env, not our local pg.Client.
const env = fs.readFileSync(new URL("../../.env", import.meta.url), "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const url = process.env.DATABASE_URL || "";
const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await db.connect();

const die = async (msg) => { console.error("❌ " + msg); await db.end(); process.exit(1); };
const ok = (msg) => console.log("✅ " + msg);

// 1. Player exists, has points in S1, and a payable wallet. Read standings from
//    the frozen season_final ledger (season_state resets once the player starts
//    the next season, so it can't be trusted for an ended season) and fall back
//    to the live board only if this season was never snapshotted.
const src = (await db.query(`SELECT 1 FROM season_final WHERE season_id=$1 LIMIT 1`, [SEASON_ID])).rowCount
  ? "season_final" : "season_state";
const pc = await db.query(
  `SELECT s.points, c.wallet_address, c.payout_wallet, c.x_user_id
     FROM ${src} s JOIN characters c ON c.name = s.player_name
    WHERE s.season_id = $1 AND s.player_name = $2`, [SEASON_ID, playerName]);
if (pc.rowCount === 0) await die(`No S1 standings row for "${playerName}" in ${src}.`);
const { points, wallet_address, payout_wallet, x_user_id } = pc.rows[0];
const wallet = payout_wallet || wallet_address;
if (!(points > 0)) await die(`"${playerName}" has ${points} points — not eligible.`);
if (!wallet || wallet.startsWith("tg:")) await die(`"${playerName}" has no payable wallet (${wallet}).`);
if (!x_user_id) await die(`"${playerName}" has NOT linked X yet — they must connect X in-game first.`);
ok(`${playerName}: ${points} pts · wallet ${wallet}`);

// 2. Identity wallet is what taskCode + getXStatus are keyed on (NOT payout wallet).
const identity = wallet_address;
const xStatus = await getXStatus(identity);
if (!xStatus.linked || !xStatus.username) await die("getXStatus says X is not linked for this identity.");
ok(`Linked X handle: @${xStatus.username}`);

// 3. Already posted / URL reused?
if ((await db.query(`SELECT 1 FROM season_post WHERE season_id=$1 AND player_name=$2`, [SEASON_ID, playerName])).rowCount)
  await die("This player already has a verified S1 post — nothing to do.");
if ((await db.query(`SELECT 1 FROM season_post WHERE season_id=$1 AND post_url=$2`, [SEASON_ID, postUrl])).rowCount)
  await die("That post URL is already used for S1.");

// 4. URL shape.
if (!isTweetUrl(postUrl)) await die("Not an x.com/…/status/… URL.");

// 5. Read the tweet and validate authorship + code + tag (same as the game).
const tweet = await readTweet(postUrl);
if (!tweet || !tweet.handle) await die("Couldn't read that post (private, deleted, or not yet indexed). Try again shortly.");
if (tweet.handle.toLowerCase() !== xStatus.username.toLowerCase())
  await die(`Post is by @${tweet.handle}, not the linked @${xStatus.username}.`);
const code = taskCode(identity, seasonPostTaskId(SEASON_ID));
const hay = `${tweet.text} ${tweet.html}`.toLowerCase();
if (!hay.includes(code.toLowerCase())) await die(`Post is missing the player's code ${code}.`);
if (!hay.includes(SEASON_POST_REQUIRED_TAG.toLowerCase())) await die(`Post is missing ${SEASON_POST_REQUIRED_TAG}.`);
ok(`Post verified: @${tweet.handle}, code ${code}, tag ${SEASON_POST_REQUIRED_TAG} present.`);

if (!COMMIT) {
  console.log("\n🔎 DRY RUN — all checks passed. Re-run with --commit to write the S1 post row.");
  await db.end(); process.exit(0);
}

// 6. Write, mirroring recordSeasonPost (wallet stored = payable wallet used by payout).
const ins = await db.query(
  `INSERT INTO season_post (season_id, player_name, wallet, x_username, post_url)
   VALUES ($1,$2,$3,$4,$5) ON CONFLICT (season_id, player_name) DO NOTHING
   RETURNING player_name`, [SEASON_ID, playerName, wallet, xStatus.username, postUrl]);
if (!ins.rowCount) await die("Insert hit a conflict — someone recorded it first.");
ok(`Recorded S1 post for ${playerName}. Now open the Season payout panel → Preview → Execute.`);
await db.end();
