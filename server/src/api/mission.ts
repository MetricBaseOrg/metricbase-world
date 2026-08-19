// Mission Center API — everything under /api/mission.
//
// Split from the page HTML deliberately: the page is a dumb shell that fetches
// these endpoints, so the same data is available to curl when something is on
// fire and the UI is the last thing you want to debug.

import { Router, type Request, type Response } from "express";
import { currentSeason, GAME_VERSION, type XTaskType } from "@metricbase/shared";
import { adService } from "../ads/adService.js";
import { liveTablesForOps, pauseTable, voidTable } from "../board/registry.js";
import { countLiveMoneyTables, listPendingBoardCashouts } from "../db/board.js";
import {
  BOOTSTRAP_EMAIL,
  clearAttempts,
  clearSessionCookie,
  clientIp,
  evictSession,
  evictSessionsForEmail,
  hashPassword,
  isRateLimited,
  readCookie,
  recordFailedAttempt,
  requireMissionAdmin,
  SESSION_COOKIE,
  startSession,
  validateNewPassword,
  verifyPassword,
  type MissionRequest,
} from "../auth/missionAuth.js";
import { readTweet } from "../auth/xVerify.js";
import { banWallet, deleteCharacterTraces, listBans, unbanWallet } from "../db/bans.js";
import { loadCharacterByName, loadCharacterByWallet } from "../db/characters.js";
import {
  audit,
  deleteSession,
  deleteSessionsFor,
  getAdminUser,
  listAudit,
  setAdminPassword,
} from "../db/missionAdmin.js";
import { createTask, listAllTasks, setTaskActive } from "../db/xTasks.js";
import {
  createTrade,
  deleteTrade,
  getTrade,
  listTrades,
  tradeStats,
  TRADE_DIRECTIONS,
  TRADE_KINDS,
  TRADE_STATUSES,
  updateTrade,
  type TradeDirection,
  type TradeKind,
  type TradeStatus,
  type XTradeInput,
} from "../db/xTrades.js";
import {
  createCrosspost,
  crosspostStats,
  deleteCrosspost,
  listCrossposts,
  PLATFORMS,
  updateCrosspost,
  type Platform,
  type XCrosspostInput,
} from "../db/xCrossposts.js";
import {
  createPost,
  deletePost,
  deleteTarget,
  getPost,
  listPosts,
  listReplyLog,
  listSnapshots,
  listTargets,
  listTemplates,
  markTargetEngaged,
  upsertReplyLog,
  setVerifiedHandle,
  updatePost,
  upsertMetrics,
  upsertSnapshot,
  upsertTarget,
  upsertTemplate,
  X_POST_STATUSES,
  X_SLOT_KINDS,
  type XPostInput,
  type XPostStatus,
  type XSlotKind,
} from "../db/xContent.js";
import { getStatsCached } from "./stats.js";
import { buildOps } from "../mission/ops.js";
import { readLogs, type LogLevel } from "../mission/logBuffer.js";
import { isRailwayConfigured, tailDeploymentLogs } from "../mission/railway.js";
import { captureShippedStories, checkCopy, evaluate } from "../mission/xEval.js";
import { kickPlayer } from "../social/presence.js";
import { distributeSeasonRewards } from "../season/payout.js";
import { ZoneRoom } from "../rooms/ZoneRoom.js";

export const missionRouter = Router();

const emailOf = (req: Request): string => (req as MissionRequest).missionUser.email;

/** Wraps an async handler so a rejected promise becomes a 500 instead of an
 *  unhandled rejection that takes the process down. */
function handler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response): void => {
    void fn(req, res).catch((error) => {
      console.error(`[mission] ${req.method} ${req.path} failed:`, error);
      if (!res.headersSent) res.status(500).json({ error: "Something failed. Check the logs tab." });
    });
  };
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

missionRouter.post(
  "/mission/login",
  handler(async (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    const ip = clientIp(req);

    if (isRateLimited(`ip:${ip}`, `email:${email}`)) {
      res.status(429).json({ error: "Too many attempts. Wait 15 minutes." });
      return;
    }
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    const user = await getAdminUser(email);
    // Always run a verification, even with no user, so a wrong email and a wrong
    // password take the same time and are indistinguishable from outside.
    const decoy = "scrypt$16384$00$00";
    const ok = await verifyPassword(password, user?.passwordHash ?? decoy);
    if (!user || !ok) {
      recordFailedAttempt(`ip:${ip}`, `email:${email}`);
      await audit(email || "unknown", "login_failed", { ip });
      res.status(401).json({ error: "Wrong email or password." });
      return;
    }

    clearAttempts(`ip:${ip}`, `email:${email}`);
    await startSession(req, res, user.email);
    await audit(user.email, "login", { ip });
    res.json({ ok: true, email: user.email, mustChangePassword: user.mustChangePassword });
  }),
);

missionRouter.post(
  "/mission/logout",
  handler(async (req, res) => {
    const id = readCookie(req, SESSION_COOKIE);
    if (id) {
      await deleteSession(id);
      evictSession(id);
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  }),
);

/** The page calls this on load to decide between the login screen, the forced
 *  change screen, and the console. 401 here means "show login". */
missionRouter.get(
  "/mission/me",
  requireMissionAdmin,
  handler(async (req, res) => {
    const user = (req as MissionRequest).missionUser;
    res.json({ email: user.email, mustChangePassword: user.mustChangePassword, version: GAME_VERSION });
  }),
);

missionRouter.post(
  "/mission/password",
  requireMissionAdmin,
  handler(async (req, res) => {
    const user = (req as MissionRequest).missionUser;
    const current = String(req.body?.current ?? "");
    const next = String(req.body?.next ?? "");

    if (!(await verifyPassword(current, user.passwordHash))) {
      await audit(user.email, "password_change_failed", {});
      res.status(401).json({ error: "Current password is wrong." });
      return;
    }
    const problem = validateNewPassword(next);
    if (problem) {
      res.status(400).json({ error: problem });
      return;
    }
    if (next === current) {
      res.status(400).json({ error: "That's the same password." });
      return;
    }

    await setAdminPassword(user.email, await hashPassword(next));
    // Every other device is signed out; this one keeps its session. Evict the
    // whole cache for this email too, or the deleted sessions would keep working
    // until their cached copies expired.
    await deleteSessionsFor(user.email, readCookie(req, SESSION_COOKIE) ?? undefined);
    evictSessionsForEmail(user.email);
    await audit(user.email, "password_changed", {});
    res.json({ ok: true });
  }),
);

// ---------------------------------------------------------------------------
// Ops
// ---------------------------------------------------------------------------

// ── District Deeds ─────────────────────────────────────────────────────────
// A deploy restarts every live table. They survive it (see board/registry.ts),
// but players sit through a ten-minute amnesty, so this is the pre-deploy check.

missionRouter.get(
  "/mission/board-tables",
  requireMissionAdmin,
  handler(async (_req, res) => {
    res.json({
      tables: liveTablesForOps(),
      pendingCashouts: await listPendingBoardCashouts(),
      liveMoneyTables: await countLiveMoneyTables(),
    });
  }),
);

missionRouter.post(
  "/mission/board-tables/:id/pause",
  requireMissionAdmin,
  handler(async (req, res) => {
    const result = await pauseTable(String(req.params.id), req.body?.paused !== false);
    res.status(result.ok ? 200 : 400).json(result);
  }),
);

missionRouter.post(
  "/mission/board-tables/:id/void",
  requireMissionAdmin,
  handler(async (req, res) => {
    // Refunds every stake and reveals the seed. The right to do this is stated
    // in BOARD_ENTRY_TERMS, which players see before they pay in.
    const result = await voidTable(String(req.params.id), String(req.body?.reason ?? "ops"));
    res.status(result.ok ? 200 : 400).json(result);
  }),
);

missionRouter.get(
  "/mission/ops",
  requireMissionAdmin,
  handler(async (_req, res) => {
    res.json(await buildOps());
  }),
);

missionRouter.get(
  "/mission/logs",
  requireMissionAdmin,
  handler(async (req, res) => {
    const level = String(req.query.level ?? "all");
    const search = String(req.query.search ?? "");
    const source = String(req.query.source ?? "local");

    if (source === "railway" && isRailwayConfigured()) {
      const lines = await tailDeploymentLogs(300, search);
      res.json({
        source: "railway",
        lines: lines
          .filter((l) => level === "all" || l.severity.startsWith(level))
          .map((l) => ({ at: l.at, level: l.severity, message: l.message })),
      });
      return;
    }
    res.json({
      source: "local",
      lines: readLogs({
        level: (["log", "warn", "error"].includes(level) ? level : "all") as LogLevel | "all",
        search,
        limit: 300,
      }),
    });
  }),
);

// ---------------------------------------------------------------------------
// Game vitals — the SAME cached build /stats serves, never a second pass.
// ---------------------------------------------------------------------------

missionRouter.get(
  "/mission/game",
  requireMissionAdmin,
  handler(async (_req, res) => {
    const stats = await getStatsCached();
    res.json({ ...stats, players: { ...stats.players, online: ZoneRoom.onlinePlayerCount() } });
  }),
);

// ---------------------------------------------------------------------------
// Admin actions
// ---------------------------------------------------------------------------

missionRouter.get(
  "/mission/bans",
  requireMissionAdmin,
  handler(async (_req, res) => {
    res.json({ bans: await listBans() });
  }),
);

missionRouter.post(
  "/mission/bans",
  requireMissionAdmin,
  handler(async (req, res) => {
    const nameOrWallet = String(req.body?.target ?? "").trim();
    const reason = String(req.body?.reason ?? "").trim();
    const deleteCharacter = req.body?.deleteCharacter === true;
    if (!nameOrWallet) {
      res.status(400).json({ error: "A character name or wallet is required." });
      return;
    }

    // Accept either identifier: wallets are the durable key, but names are what
    // a report actually contains.
    const target =
      (await loadCharacterByName(nameOrWallet)) ?? (await loadCharacterByWallet(nameOrWallet));
    if (!target) {
      res.status(404).json({ error: `No character matching "${nameOrWallet}".` });
      return;
    }
    const wallet = target.walletAddress;
    if (!wallet) {
      res.status(400).json({ error: `"${target.name}" has no bonded wallet — nothing durable to ban.` });
      return;
    }
    if (adService.isAdmin(wallet)) {
      res.status(400).json({ error: "You can't ban an admin account." });
      return;
    }

    await banWallet(wallet, target.name, reason || `Banned via Mission Center ${new Date().toISOString().slice(0, 10)}`);
    const kicked = kickPlayer(target.name);
    const deleted = deleteCharacter ? await deleteCharacterTraces(wallet, target.name) : 0;
    await audit(emailOf(req), "ban", { wallet, name: target.name, reason, kicked, deleted });
    res.json({
      ok: true,
      message: `${target.name} banned${kicked ? " and kicked" : ""}${deleted ? ", character deleted" : ""}.`,
    });
  }),
);

missionRouter.delete(
  "/mission/bans/:wallet",
  requireMissionAdmin,
  handler(async (req, res) => {
    const wallet = String(req.params.wallet);
    await unbanWallet(wallet);
    await audit(emailOf(req), "unban", { wallet });
    res.json({ ok: true });
  }),
);

missionRouter.post(
  "/mission/season/payout",
  requireMissionAdmin,
  handler(async (req, res) => {
    const requested = Number(req.body?.seasonNumber);
    const seasonNumber =
      Number.isInteger(requested) && requested > 0 ? requested : currentSeason().number - 1;
    const execute = req.body?.execute === true;
    // Executing moves real $BASE, so it needs an explicit typed confirmation on
    // top of the flag — a stray `execute: true` shouldn't be able to pay a season out.
    if (execute && String(req.body?.confirm ?? "") !== `PAY SEASON ${seasonNumber}`) {
      res.status(400).json({ error: `Type "PAY SEASON ${seasonNumber}" to confirm.` });
      return;
    }
    const report = await distributeSeasonRewards(seasonNumber, execute);
    await audit(emailOf(req), execute ? "season_payout_execute" : "season_payout_dryrun", {
      seasonNumber,
      error: report.error ?? null,
    });
    res.json({ ok: !report.error, report });
  }),
);

missionRouter.get(
  "/mission/audit",
  requireMissionAdmin,
  handler(async (req, res) => {
    res.json({ entries: await listAudit(Number(req.query.limit) || 100) });
  }),
);

// X earn-tasks (the in-game reply/quote campaigns), moved out of the game client.
missionRouter.get(
  "/mission/xtasks",
  requireMissionAdmin,
  handler(async (_req, res) => {
    res.json({ tasks: await listAllTasks() });
  }),
);

missionRouter.post(
  "/mission/xtasks",
  requireMissionAdmin,
  handler(async (req, res) => {
    const id = String(req.body?.id ?? "").trim() || `xt_${Date.now().toString(36)}`;
    const type: XTaskType = String(req.body?.type) === "quote" ? "quote" : "reply";
    const targetUrl = String(req.body?.targetUrl ?? "").trim();
    const title = String(req.body?.title ?? "").trim();
    const description = String(req.body?.description ?? "").trim();
    const hashtag = String(req.body?.hashtag ?? "").trim();
    const points = Math.max(1, Math.round(Number(req.body?.points) || 25));
    if (!targetUrl || !title) {
      res.status(400).json({ error: "A target tweet URL and a title are required." });
      return;
    }
    const ok = await createTask({ id, type, targetUrl, title, description, hashtag, points });
    await audit(emailOf(req), "xtask_create", { id, targetUrl, points });
    res.json({ ok, error: ok ? undefined : "Create failed — the id may already exist." });
  }),
);

missionRouter.post(
  "/mission/xtasks/:id/active",
  requireMissionAdmin,
  handler(async (req, res) => {
    const active = req.body?.active === true;
    await setTaskActive(String(req.params.id), active);
    await audit(emailOf(req), "xtask_active", { id: req.params.id, active });
    res.json({ ok: true });
  }),
);

// ---------------------------------------------------------------------------
// X growth system
// ---------------------------------------------------------------------------

missionRouter.get(
  "/mission/x",
  requireMissionAdmin,
  handler(async (_req, res) => {
    const [posts, targets, templates, snapshots] = await Promise.all([
      listPosts(),
      listTargets(),
      listTemplates(),
      listSnapshots(),
    ]);
    res.json({ posts, targets, templates, snapshots, statuses: X_POST_STATUSES, slotKinds: X_SLOT_KINDS });
  }),
);

missionRouter.get(
  "/mission/x/evaluation",
  requireMissionAdmin,
  handler(async (_req, res) => {
    res.json(await evaluate());
  }),
);

function readPostInput(body: Record<string, unknown>): XPostInput {
  const input: XPostInput = {};
  const str = (k: string): string | null => {
    const v = body[k];
    return v == null ? null : String(v);
  };
  if ("slotDate" in body) input.slotDate = str("slotDate") || null;
  if ("slotKind" in body && X_SLOT_KINDS.includes(String(body.slotKind) as XSlotKind)) {
    input.slotKind = String(body.slotKind) as XSlotKind;
  }
  if ("status" in body && X_POST_STATUSES.includes(String(body.status) as XPostStatus)) {
    input.status = String(body.status) as XPostStatus;
  }
  if ("format" in body) input.format = str("format");
  if ("title" in body) input.title = String(body.title ?? "").slice(0, 200);
  if ("hook" in body) input.hook = String(body.hook ?? "");
  if ("body" in body) input.body = String(body.body ?? "");
  if ("imagePrompt" in body) input.imagePrompt = str("imagePrompt");
  if ("tweetUrl" in body) input.tweetUrl = str("tweetUrl");
  // threadOf links a follow-up to its parent post; sourceVersion tags a
  // shipped-story post. Both columns already exist and createPost/updatePost
  // already write them — they were simply never accepted here, so the composer
  // could not build a thread. A null/absent threadOf leaves the post standalone.
  if ("threadOf" in body) {
    const n = Number(body.threadOf);
    input.threadOf = Number.isFinite(n) && n > 0 ? n : null;
  }
  if ("sourceVersion" in body) input.sourceVersion = str("sourceVersion");
  return input;
}

missionRouter.post(
  "/mission/x/posts",
  requireMissionAdmin,
  handler(async (req, res) => {
    const post = await createPost(readPostInput(req.body ?? {}));
    await audit(emailOf(req), "x_post_create", { id: post.id });
    res.json({ post });
  }),
);

missionRouter.patch(
  "/mission/x/posts/:id",
  requireMissionAdmin,
  handler(async (req, res) => {
    const id = Number(req.params.id);
    const post = await updatePost(id, readPostInput(req.body ?? {}));
    if (!post) {
      res.status(404).json({ error: "No such post." });
      return;
    }
    await audit(emailOf(req), "x_post_update", { id, fields: Object.keys(req.body ?? {}) });
    res.json({ post });
  }),
);

missionRouter.delete(
  "/mission/x/posts/:id",
  requireMissionAdmin,
  handler(async (req, res) => {
    const id = Number(req.params.id);
    await deletePost(id);
    await audit(emailOf(req), "x_post_delete", { id });
    res.json({ ok: true });
  }),
);

missionRouter.post(
  "/mission/x/posts/:id/metrics",
  requireMissionAdmin,
  handler(async (req, res) => {
    const id = Number(req.params.id);
    if (!(await getPost(id))) {
      res.status(404).json({ error: "No such post." });
      return;
    }
    await upsertMetrics(id, {
      impressions: Number(req.body?.impressions) || 0,
      likes: Number(req.body?.likes) || 0,
      replies: Number(req.body?.replies) || 0,
      reposts: Number(req.body?.reposts) || 0,
      bookmarks: Number(req.body?.bookmarks) || 0,
      profileClicks: Number(req.body?.profileClicks) || 0,
      linkClicks: Number(req.body?.linkClicks) || 0,
      // Left undefined rather than coerced to 0 when the field is blank: empty
      // means "not recorded", and upsertMetrics keeps whatever was stored. The
      // `|| 0` every other field uses would write a zero on every save.
      verifiedImpressions:
        req.body?.verifiedImpressions === undefined || req.body?.verifiedImpressions === ""
          ? undefined
          : Number(req.body.verifiedImpressions) || 0,
    });
    await audit(emailOf(req), "x_metrics", { id, impressions: Number(req.body?.impressions) || 0 });
    res.json({ post: await getPost(id) });
  }),
);

/** Confirm a posted tweet exists and belongs to the expected account, using the
 *  free publish.twitter.com oEmbed endpoint — the same one the in-game X tasks
 *  verify against. Also returns the LIVE text so drift from the planned copy is
 *  visible. */
missionRouter.post(
  "/mission/x/posts/:id/verify",
  requireMissionAdmin,
  handler(async (req, res) => {
    const id = Number(req.params.id);
    const post = await getPost(id);
    if (!post) {
      res.status(404).json({ error: "No such post." });
      return;
    }
    const url = String(req.body?.tweetUrl ?? post.tweetUrl ?? "").trim();
    if (!url) {
      res.status(400).json({ error: "Paste the tweet URL first." });
      return;
    }
    const info = await readTweet(url);
    if (!info) {
      res.status(422).json({ error: "Couldn't read that tweet — check the URL is public and correct." });
      return;
    }
    await updatePost(id, { tweetUrl: url, status: "posted" });
    await setVerifiedHandle(id, info.handle);
    await audit(emailOf(req), "x_post_verify", { id, handle: info.handle });
    res.json({ post: await getPost(id), liveText: info.text, handle: info.handle });
  }),
);

missionRouter.post(
  "/mission/x/check",
  requireMissionAdmin,
  handler(async (req, res) => {
    res.json({ warnings: checkCopy(String(req.body?.text ?? "")) });
  }),
);

missionRouter.post(
  "/mission/x/capture",
  requireMissionAdmin,
  handler(async (req, res) => {
    const created = await captureShippedStories();
    await audit(emailOf(req), "x_capture", { created });
    res.json({ created });
  }),
);

missionRouter.post(
  "/mission/x/snapshots",
  requireMissionAdmin,
  handler(async (req, res) => {
    const day = String(req.body?.day ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      res.status(400).json({ error: "Use a YYYY-MM-DD date." });
      return;
    }
    await upsertSnapshot({
      day,
      followers: Number(req.body?.followers) || 0,
      following: Number(req.body?.following) || 0,
      posts: Number(req.body?.posts) || 0,
      note: req.body?.note ? String(req.body.note) : null,
    });
    await audit(emailOf(req), "x_snapshot", { day });
    res.json({ snapshots: await listSnapshots() });
  }),
);

missionRouter.post(
  "/mission/x/targets",
  requireMissionAdmin,
  handler(async (req, res) => {
    const handle = String(req.body?.handle ?? "").trim();
    if (!handle) {
      res.status(400).json({ error: "A handle is required." });
      return;
    }
    await upsertTarget({
      handle,
      why: String(req.body?.why ?? ""),
      cadence: String(req.body?.cadence ?? ""),
      notes: req.body?.notes ? String(req.body.notes) : null,
    });
    res.json({ targets: await listTargets() });
  }),
);

missionRouter.post(
  "/mission/x/targets/:handle/engaged",
  requireMissionAdmin,
  handler(async (req, res) => {
    await markTargetEngaged(String(req.params.handle));
    res.json({ targets: await listTargets() });
  }),
);

missionRouter.delete(
  "/mission/x/targets/:handle",
  requireMissionAdmin,
  handler(async (req, res) => {
    await deleteTarget(String(req.params.handle));
    res.json({ targets: await listTargets() });
  }),
);

// Save a template. `upsertTemplate` existed in the data layer with no route, so
// templates could only ever be written by the import script — the composer had
// no way to add or edit one. The id is slugged from the name when absent so the
// operator only has to type a name.
missionRouter.post(
  "/mission/x/templates",
  requireMissionAdmin,
  handler(async (req, res) => {
    const name = String(req.body?.name ?? "").trim();
    if (!name) {
      res.status(400).json({ error: "A template name is required." });
      return;
    }
    const rawId = String(req.body?.id ?? "").trim();
    const id = (rawId || `tpl_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`).slice(0, 64);
    await upsertTemplate({
      id,
      name: name.slice(0, 120),
      format: String(req.body?.format ?? ""),
      skeleton: String(req.body?.skeleton ?? ""),
      notes: req.body?.notes ? String(req.body.notes) : null,
    });
    await audit(emailOf(req), "x_template_upsert", { id });
    res.json({ templates: await listTemplates() });
  }),
);

// ── Trading ledger ─────────────────────────────────────────────────────────

/** The one instrument that must never appear in the ledger: the operator issues
 *  $BASE, so a call on it is manipulation in substance. Matches "BASE" or
 *  "$BASE" as a whole word, case-insensitive; other tickers containing those
 *  letters (e.g. "COINBASE") would be a false positive, but none are traded
 *  here and the safe default is to refuse. */
function namesBase(instrument: string): boolean {
  return /(^|[^a-z])\$?base([^a-z]|$)/i.test(instrument.trim());
}

const num = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

function readTradeInput(body: Record<string, unknown>): XTradeInput {
  const input: XTradeInput = {};
  const str = (k: string): string | undefined => (k in body ? String(body[k] ?? "") : undefined);
  if ("openedAt" in body) input.openedAt = String(body.openedAt ?? "").slice(0, 10);
  if ("closedAt" in body) input.closedAt = body.closedAt ? String(body.closedAt).slice(0, 10) : null;
  if ("instrument" in body) input.instrument = String(body.instrument ?? "").slice(0, 40);
  if ("direction" in body && TRADE_DIRECTIONS.includes(String(body.direction) as TradeDirection)) {
    input.direction = String(body.direction) as TradeDirection;
  }
  if ("entry" in body) input.entry = num(body.entry) ?? 0;
  if ("stop" in body) input.stop = num(body.stop) ?? null;
  if ("exit" in body) input.exit = num(body.exit) ?? null;
  if ("thesis" in body) input.thesis = str("thesis");
  if ("invalidation" in body) input.invalidation = str("invalidation");
  if ("status" in body && TRADE_STATUSES.includes(String(body.status) as TradeStatus)) {
    input.status = String(body.status) as TradeStatus;
  }
  if ("kind" in body && TRADE_KINDS.includes(String(body.kind) as TradeKind)) {
    input.kind = String(body.kind) as TradeKind;
  }
  if ("postId" in body) input.postId = num(body.postId) ?? null;
  if ("note" in body) input.note = str("note");
  return input;
}

missionRouter.get(
  "/mission/x/trades",
  requireMissionAdmin,
  handler(async (_req, res) => {
    const [trades, stats] = await Promise.all([listTrades(), tradeStats()]);
    res.json({ trades, stats, directions: TRADE_DIRECTIONS, statuses: TRADE_STATUSES, kinds: TRADE_KINDS });
  }),
);

missionRouter.post(
  "/mission/x/trades",
  requireMissionAdmin,
  handler(async (req, res) => {
    const input = readTradeInput(req.body ?? {});
    if (!input.instrument) {
      res.status(400).json({ error: "An instrument is required." });
      return;
    }
    if (namesBase(input.instrument)) {
      res.status(400).json({ error: "You issue $BASE — a call on it can't be logged." });
      return;
    }
    const trade = await createTrade(input);
    await audit(emailOf(req), "x_trade_create", { id: trade.id, instrument: trade.instrument });
    res.json({ trade });
  }),
);

missionRouter.patch(
  "/mission/x/trades/:id",
  requireMissionAdmin,
  handler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await getTrade(id);
    if (!existing) {
      res.status(404).json({ error: "No such trade." });
      return;
    }
    const input = readTradeInput(req.body ?? {});
    if (input.instrument !== undefined && namesBase(input.instrument)) {
      res.status(400).json({ error: "You issue $BASE — a call on it can't be logged." });
      return;
    }
    // A trade can't be closed without an exit — the close ratio and R depend on
    // it, and "closed" with no exit is how a losing call quietly disappears.
    const nextStatus = input.status ?? existing.status;
    const nextExit = input.exit !== undefined ? input.exit : existing.exit;
    if (nextStatus === "closed" && (nextExit === null || nextExit === undefined)) {
      res.status(400).json({ error: "Enter an exit before closing — every close is posted." });
      return;
    }
    // Closing stamps the date if the client didn't send one.
    if (nextStatus === "closed" && existing.status !== "closed" && input.closedAt === undefined) {
      input.closedAt = new Date().toISOString().slice(0, 10);
    }
    const trade = await updateTrade(id, input);
    await audit(emailOf(req), "x_trade_update", { id, status: nextStatus });
    res.json({ trade });
  }),
);

missionRouter.delete(
  "/mission/x/trades/:id",
  requireMissionAdmin,
  handler(async (req, res) => {
    await deleteTrade(Number(req.params.id));
    await audit(emailOf(req), "x_trade_delete", { id: Number(req.params.id) });
    res.json({ trades: await listTrades(), stats: await tradeStats() });
  }),
);

// ── Cross-platform tracking ──────────────────────────────────────────────────

function readCrosspostInput(body: Record<string, unknown>): XCrosspostInput {
  const input: XCrosspostInput = {};
  if ("postId" in body) input.postId = num(body.postId) ?? null;
  if ("platform" in body && PLATFORMS.includes(String(body.platform) as Platform)) {
    input.platform = String(body.platform) as Platform;
  }
  if ("url" in body) input.url = String(body.url ?? "");
  if ("publishedAt" in body) input.publishedAt = body.publishedAt ? String(body.publishedAt).slice(0, 10) : null;
  if ("views" in body) input.views = num(body.views) ?? null;
  if ("profileVisits" in body) input.profileVisits = num(body.profileVisits) ?? null;
  if ("note" in body) input.note = String(body.note ?? "");
  return input;
}

missionRouter.get(
  "/mission/x/crossposts",
  requireMissionAdmin,
  handler(async (_req, res) => {
    const [crossposts, stats] = await Promise.all([listCrossposts(), crosspostStats()]);
    res.json({ crossposts, stats, platforms: PLATFORMS });
  }),
);

missionRouter.post(
  "/mission/x/crossposts",
  requireMissionAdmin,
  handler(async (req, res) => {
    const input = readCrosspostInput(req.body ?? {});
    const crosspost = await createCrosspost(input);
    await audit(emailOf(req), "x_crosspost_create", { id: crosspost.id, platform: crosspost.platform });
    res.json({ crossposts: await listCrossposts(), stats: await crosspostStats() });
  }),
);

missionRouter.patch(
  "/mission/x/crossposts/:id",
  requireMissionAdmin,
  handler(async (req, res) => {
    const updated = await updateCrosspost(Number(req.params.id), readCrosspostInput(req.body ?? {}));
    if (!updated) {
      res.status(404).json({ error: "No such crosspost." });
      return;
    }
    res.json({ crossposts: await listCrossposts(), stats: await crosspostStats() });
  }),
);

missionRouter.delete(
  "/mission/x/crossposts/:id",
  requireMissionAdmin,
  handler(async (req, res) => {
    await deleteCrosspost(Number(req.params.id));
    res.json({ crossposts: await listCrossposts(), stats: await crosspostStats() });
  }),
);

// ── Reply log ────────────────────────────────────────────────────────────────

missionRouter.get(
  "/mission/x/replies",
  requireMissionAdmin,
  handler(async (_req, res) => {
    res.json({ replies: await listReplyLog() });
  }),
);

missionRouter.post(
  "/mission/x/replies",
  requireMissionAdmin,
  handler(async (req, res) => {
    const day = String(req.body?.day ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      res.status(400).json({ error: "A valid day (YYYY-MM-DD) is required." });
      return;
    }
    await upsertReplyLog({
      day,
      count: Number(req.body?.count) || 0,
      rooms: String(req.body?.rooms ?? ""),
      note: String(req.body?.note ?? ""),
    });
    res.json({ replies: await listReplyLog() });
  }),
);

export { BOOTSTRAP_EMAIL };
