import { Router } from "express";
import crypto from "node:crypto";
import { type XTasksResponse, type XTaskView } from "@metricbase/shared";
import { type AuthenticatedRequest, requireAuth } from "../auth/requireAuth.js";
import { adService } from "../ads/adService.js";
import { getXStatus } from "../db/xLink.js";
import { isTweetUrl, readTweet, taskCode } from "../auth/xVerify.js";
import {
  claimedTaskIds, createTask, getTask, listActiveTasks, listAllTasks, nameForWallet,
  recordClaim, setTaskActive, updateTask,
} from "../db/xTasks.js";

export const xTasksRouter = Router();

/** Active tasks + this player's per-task code and claimed status. */
xTasksRouter.get("/x/tasks", requireAuth, async (req, res) => {
  const wallet = (req as AuthenticatedRequest).authWallet;
  const admin = adService.isAdmin(wallet);
  const status = await getXStatus(wallet);
  const [tasks, claimed] = await Promise.all([
    admin ? listAllTasks() : listActiveTasks(),
    claimedTaskIds(wallet),
  ]);
  const views: XTaskView[] = tasks.map((t) => ({
    id: t.id, type: t.type, title: t.title, description: t.description,
    targetUrl: t.targetUrl, hashtag: t.hashtag, points: t.points,
    code: status.linked ? taskCode(wallet, t.id) : "",
    claimed: claimed.has(t.id),
    active: t.active,
  }));
  const payload: XTasksResponse = {
    linked: status.linked, handle: status.username, tasks: views, admin,
  };
  res.json(payload);
});

/** Verify a pasted proof tweet and award the task's points (once). */
xTasksRouter.post("/x/tasks/:id/claim", requireAuth, async (req, res) => {
  const wallet = (req as AuthenticatedRequest).authWallet;
  const taskId = String(req.params.id);
  const url = String((req.body as { url?: unknown })?.url ?? "").trim();

  const status = await getXStatus(wallet);
  if (!status.linked || !status.username) {
    res.status(409).json({ ok: false, error: "Connect your X account first." });
    return;
  }
  if (!isTweetUrl(url)) {
    res.status(400).json({ ok: false, error: "Paste the link to your reply/repost on X (an x.com/…/status/… URL)." });
    return;
  }
  const task = await getTask(taskId);
  if (!task || !task.active) {
    res.status(404).json({ ok: false, error: "That task is no longer available." });
    return;
  }

  const tweet = await readTweet(url);
  if (!tweet || !tweet.handle) {
    res.status(422).json({ ok: false, error: "Couldn't read that tweet yet — make sure your account is public and give it a few seconds." });
    return;
  }
  if (tweet.handle.toLowerCase() !== status.username.toLowerCase()) {
    res.status(422).json({ ok: false, error: `That tweet is by @${tweet.handle}, not your linked @${status.username}.` });
    return;
  }
  const code = taskCode(wallet, taskId);
  const haystack = `${tweet.text} ${tweet.html}`.toLowerCase();
  if (!haystack.includes(code.toLowerCase())) {
    res.status(422).json({ ok: false, error: `Your post is missing your code ${code}. Add it and try again.` });
    return;
  }
  if (task.hashtag && !haystack.includes(task.hashtag.toLowerCase())) {
    res.status(422).json({ ok: false, error: `Your post is missing ${task.hashtag}.` });
    return;
  }

  const name = await nameForWallet(wallet);
  if (!name) {
    res.status(404).json({ ok: false, error: "No character bonded to this account yet." });
    return;
  }
  const outcome = await recordClaim(taskId, wallet, name, url, task.points);
  if (!outcome.ok) {
    res.status(409).json({ ok: false, error: outcome.reason });
    return;
  }
  res.json({ ok: true, points: outcome.points });
});

// ── Admin: post + toggle campaigns ───────────────────────────────────────────
xTasksRouter.post("/x/tasks", requireAuth, async (req, res) => {
  const wallet = (req as AuthenticatedRequest).authWallet;
  if (!adService.isAdmin(wallet)) { res.status(403).json({ error: "Admins only." }); return; }
  const b = (req.body ?? {}) as Record<string, unknown>;
  const type = b.type === "quote" ? "quote" : "reply";
  const targetUrl = String(b.targetUrl ?? "").trim();
  const title = String(b.title ?? "").trim().slice(0, 120);
  if (!isTweetUrl(targetUrl) || !title) {
    res.status(400).json({ error: "A title and a valid target tweet URL are required." });
    return;
  }
  const points = Math.max(1, Math.min(500, Math.floor(Number(b.points) || 25)));
  const ok = await createTask({
    id: `xt_${crypto.randomBytes(6).toString("hex")}`,
    type, targetUrl, title,
    description: String(b.description ?? "").slice(0, 500),
    hashtag: String(b.hashtag ?? "").trim().slice(0, 40),
    points,
  });
  res.status(ok ? 200 : 500).json({ ok });
});

xTasksRouter.post("/x/tasks/:id", requireAuth, async (req, res) => {
  const wallet = (req as AuthenticatedRequest).authWallet;
  if (!adService.isAdmin(wallet)) { res.status(403).json({ error: "Admins only." }); return; }
  const id = String(req.params.id);
  if (!(await getTask(id))) { res.status(404).json({ error: "Task not found." }); return; }
  const b = (req.body ?? {}) as Record<string, unknown>;
  const targetUrl = String(b.targetUrl ?? "").trim();
  const title = String(b.title ?? "").trim().slice(0, 120);
  if (!isTweetUrl(targetUrl) || !title) {
    res.status(400).json({ error: "A title and a valid target tweet URL are required." });
    return;
  }
  const ok = await updateTask(id, {
    type: b.type === "quote" ? "quote" : "reply",
    targetUrl, title,
    description: String(b.description ?? "").slice(0, 500),
    hashtag: String(b.hashtag ?? "").trim().slice(0, 40),
    points: Math.max(1, Math.min(500, Math.floor(Number(b.points) || 25))),
  });
  res.status(ok ? 200 : 500).json({ ok });
});

xTasksRouter.post("/x/tasks/:id/active", requireAuth, async (req, res) => {
  const wallet = (req as AuthenticatedRequest).authWallet;
  if (!adService.isAdmin(wallet)) { res.status(403).json({ error: "Admins only." }); return; }
  await setTaskActive(String(req.params.id), Boolean((req.body as { active?: unknown })?.active));
  res.json({ ok: true });
});
