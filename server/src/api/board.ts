// District Deeds — the /api/board surface.
//
// The board runs over HTTP long-poll rather than Colyseus, deliberately:
// reconnect tokens die with the process, and surviving a restart mid-game is
// the single hardest requirement here. A 45-second turn does not need a socket.
//
// Auth: `requireAuth` for everything (pid = authWallet, which is a wallet or
// `tg:<id>`), plus `isWalletIdentity` on anything that moves $BASE or SOL.
// Gold tables deliberately work for Telegram-only players — they are the
// audience with no wallet, and the whole point of a gold table is that it needs
// nothing on-chain.

import { createHmac } from "node:crypto";

import {
  BOARD_ENTRY_TERMS,
  BOARD_POLL_HOLD_MS,
  BOARD_SEAT_LIMITS,
  BOARD_STAKE_TIERS,
  boardTurnCap,
  toBaseUnits,
  type BoardAction,
  type BoardAiDifficulty,
  type BoardCurrencyId,
} from "@metricbase/shared";
import { Router, type Request, type Response } from "express";

import { type AuthenticatedRequest, requireAuth } from "../auth/requireAuth.js";
import { isWalletIdentity } from "../auth/telegramAuth.js";
import { cashOutGold, cashOutOnChain, depositOnChain, getBoardBalances } from "../board/bank.js";
import { activeBoardCurrencies, boardHouseWallet, boardMoneyEnabled } from "../board/config.js";
import {
  act,
  createTable,
  fairnessFor,
  invitePlayer,
  joinTable,
  leaveLobby,
  listOpenTables,
  myTables,
  pollTable,
  setClientSeed,
  setReady,
  startTable,
} from "../board/registry.js";
import { listInvites } from "../db/board.js";
import { ZoneRoom } from "../rooms/ZoneRoom.js";
import { getPool } from "../db/pool.js";

export const boardRouter = Router();

/**
 * Wrap an async route so a thrown error becomes a 500 instead of a hung
 * request. Express 4 does not catch rejected promises from a handler, so
 * without this a database error leaves the client waiting forever — which on a
 * money endpoint means a player staring at a spinner with no idea whether their
 * stake moved. Found exactly that way: a bad cast in the ledger insert hung
 * table creation until the socket timed out.
 */
function handler(
  fn: (req: Request, res: Response) => Promise<void> | void,
): (req: Request, res: Response) => void {
  return (req, res) => {
    void Promise.resolve(fn(req, res)).catch((error) => {
      console.error(`[board] ${req.method} ${req.path} failed:`, error);
      if (!res.headersSent) res.status(500).json({ error: "Something went wrong. Try again." });
    });
  };
}

/** HMAC of the join IP — never the IP itself. */
function ipHash(req: Request): string | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  const fwd = String(req.headers["x-forwarded-for"] ?? "").split(",")[0]?.trim();
  const ip = fwd || req.socket.remoteAddress || "";
  if (!ip) return null;
  return createHmac("sha256", secret).update(ip).digest("hex");
}

/** The display name behind a pid. Cached per request, not per call. */
async function nameFor(pid: string): Promise<string> {
  const pool = getPool();
  if (!pool) return pid.slice(0, 16);
  try {
    const res = await pool.query<{ name: string }>(
      "SELECT name FROM characters WHERE wallet_address = $1 LIMIT 1",
      [pid],
    );
    return res.rows[0]?.name ?? pid.slice(0, 16);
  } catch {
    return pid.slice(0, 16);
  }
}

async function pidForName(name: string): Promise<string | null> {
  const pool = getPool();
  if (!pool) return null;
  try {
    const res = await pool.query<{ wallet_address: string | null }>(
      "SELECT wallet_address FROM characters WHERE LOWER(name) = LOWER($1) LIMIT 1",
      [name],
    );
    return res.rows[0]?.wallet_address ?? null;
  } catch {
    return null;
  }
}

function moneyGuard(pid: string, currencyId: string): string | null {
  if (currencyId === "gold") return null;
  if (!boardMoneyEnabled()) return "Stake tables are closed right now.";
  if (!isWalletIdentity(pid)) {
    return "Stake tables need a connected Solana wallet. Gold tables are open to everyone.";
  }
  return null;
}

// ── config + bank ───────────────────────────────────────────────────────────

boardRouter.get("/board/config", requireAuth, handler((req, res) => {
  const pid = (req as AuthenticatedRequest).authWallet;
  res.json({
    currencies: activeBoardCurrencies(),
    stakeTiers: BOARD_STAKE_TIERS,
    seatLimits: BOARD_SEAT_LIMITS,
    moneyEnabled: boardMoneyEnabled(),
    houseWallet: boardHouseWallet(),
    // The client signs its own deposit transfer, so it needs a working RPC —
    // same shape the in-world payment flows use.
    rpcUrl: process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com",
    mint: process.env.TOKEN_MINT ?? null,
    hasWallet: isWalletIdentity(pid),
    turnCapPerSeat: boardTurnCap(1),
    terms: BOARD_ENTRY_TERMS,
  });
}));

boardRouter.get("/board/bank", requireAuth, handler(async (req, res) => {
  const pid = (req as AuthenticatedRequest).authWallet;
  res.json({ balances: await getBoardBalances(pid) });
}));

boardRouter.post("/board/bank/deposit", requireAuth, handler(async (req, res) => {
  const pid = (req as AuthenticatedRequest).authWallet;
  const { currencyId, signature, minUiAmount } = req.body ?? {};
  const guard = moneyGuard(pid, String(currencyId));
  if (guard) {
    res.status(403).json({ error: guard });
    return;
  }
  if (typeof signature !== "string" || signature.length < 32) {
    res.status(400).json({ error: "Missing transfer signature." });
    return;
  }
  const result = await depositOnChain({
    pid,
    playerName: await nameFor(pid),
    wallet: pid,
    currencyId: currencyId as BoardCurrencyId,
    signature,
    minUiAmount: Number(minUiAmount) || 0,
  });
  if (!result.ok) {
    // 202 means "keep trying" — the transfer may simply not be indexed yet, and
    // a real payment must never be dropped because we asked too early.
    res.status(result.retryable ? 202 : 400).json({ error: result.error, retryable: result.retryable });
    return;
  }
  res.json({ ok: true, credited: result.credited, balances: await getBoardBalances(pid) });
}));

boardRouter.post("/board/bank/fund-gold", requireAuth, handler(async (req, res) => {
  const pid = (req as AuthenticatedRequest).authWallet;
  const amount = Math.floor(Number(req.body?.amount));
  const requestId = String(req.body?.requestId ?? "").slice(0, 60);
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "Enter an amount above zero." });
    return;
  }
  if (!requestId) {
    res.status(400).json({ error: "Try that again." });
    return;
  }
  const name = await nameFor(pid);
  // Routed through ZoneRoom because it is authoritative over live gold: a
  // player standing in the world holds their balance in memory, and writing
  // characters.gold from here would be overwritten on their next persist.
  const result = await ZoneRoom.fundBoardBankGlobal(pid, name, amount, `fund:${pid}:${requestId}`);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ok: true, moved: result.credited, balances: await getBoardBalances(pid) });
}));

boardRouter.post("/board/bank/cashout", requireAuth, handler(async (req, res) => {
  const pid = (req as AuthenticatedRequest).authWallet;
  const { currencyId, amount } = req.body ?? {};
  const name = await nameFor(pid);

  if (currencyId === "gold") {
    const result = await cashOutGold({
      pid,
      playerName: name,
      amount: Number(amount),
      // One in-flight cash-out per player per minute-bucket: a double-submit
      // from an impatient click lands on the same key and does nothing.
      requestId: `cash:gold:${pid}:${Math.floor(Date.now() / 60000)}`,
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ ok: true, paid: result.paid, balances: await getBoardBalances(pid) });
    return;
  }

  const guard = moneyGuard(pid, String(currencyId));
  if (guard) {
    res.status(403).json({ error: guard });
    return;
  }
  const result = await cashOutOnChain({
    pid,
    playerName: name,
    wallet: pid,
    currencyId: currencyId as BoardCurrencyId,
    units: toBaseUnits(Number(amount), String(currencyId)),
    requestId: `cash:${currencyId}:${pid}:${Math.floor(Date.now() / 60000)}`,
  });
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ok: true, signature: result.signature, balances: await getBoardBalances(pid) });
}));

// ── lobby ───────────────────────────────────────────────────────────────────

boardRouter.get("/board/tables", requireAuth, handler(async (req, res) => {
  const pid = (req as AuthenticatedRequest).authWallet;
  res.json({
    open: listOpenTables(pid),
    mine: myTables(pid),
    invites: await listInvites(pid),
  });
}));

boardRouter.post("/board/tables", requireAuth, handler(async (req, res) => {
  const pid = (req as AuthenticatedRequest).authWallet;
  const { currencyId, stake, seatCount, aiCount, aiDifficulty, name } = req.body ?? {};
  const guard = moneyGuard(pid, String(currencyId));
  if (guard) {
    res.status(403).json({ error: guard });
    return;
  }
  const result = await createTable({
    pid,
    playerName: await nameFor(pid),
    name: String(name ?? "").slice(0, 40),
    currencyId: currencyId as BoardCurrencyId,
    stake: Number(stake),
    seatCount: Number(seatCount),
    aiCount: Number(aiCount) || 0,
    aiDifficulty: (aiDifficulty as BoardAiDifficulty) ?? "normal",
  });
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ok: true, tableId: result.tableId });
}));

boardRouter.post("/board/tables/:id/join", requireAuth, handler(async (req, res) => {
  const pid = (req as AuthenticatedRequest).authWallet;
  const result = await joinTable({
    pid,
    playerName: await nameFor(pid),
    tableId: String(req.params.id),
    ipHash: ipHash(req),
  });
  res.status(result.ok ? 200 : 400).json(result.ok ? { ok: true } : { error: result.error });
}));

boardRouter.post("/board/tables/:id/leave", requireAuth, handler(async (req, res) => {
  const pid = (req as AuthenticatedRequest).authWallet;
  const result = await leaveLobby(pid, String(req.params.id));
  res.status(result.ok ? 200 : 400).json(result.ok ? { ok: true } : { error: result.error });
}));

boardRouter.post("/board/tables/:id/seed", requireAuth, handler(async (req, res) => {
  const pid = (req as AuthenticatedRequest).authWallet;
  const result = await setClientSeed(pid, String(req.params.id), String(req.body?.clientSeed ?? ""));
  res.status(result.ok ? 200 : 400).json(result.ok ? { ok: true } : { error: result.error });
}));

boardRouter.post("/board/tables/:id/ready", requireAuth, handler(async (req, res) => {
  const pid = (req as AuthenticatedRequest).authWallet;
  const result = await setReady(pid, String(req.params.id), req.body?.ready !== false);
  res.status(result.ok ? 200 : 400).json(result.ok ? { ok: true } : { error: result.error });
}));

boardRouter.post("/board/tables/:id/invite", requireAuth, handler(async (req, res) => {
  const pid = (req as AuthenticatedRequest).authWallet;
  const toName = String(req.body?.toName ?? "").slice(0, 16);
  const toPid = await pidForName(toName);
  if (!toPid) {
    res.status(404).json({ error: "No player by that name." });
    return;
  }
  const result = await invitePlayer(pid, String(req.params.id), toPid, toName);
  res.status(result.ok ? 200 : 400).json(result.ok ? { ok: true } : { error: result.error });
}));

boardRouter.post("/board/tables/:id/start", requireAuth, handler(async (req, res) => {
  const pid = (req as AuthenticatedRequest).authWallet;
  const result = await startTable(pid, String(req.params.id));
  res.status(result.ok ? 200 : 400).json(result.ok ? { ok: true } : { error: result.error });
}));

// ── play ────────────────────────────────────────────────────────────────────

boardRouter.get("/board/tables/:id/state", requireAuth, handler(async (req, res) => {
  const pid = (req as AuthenticatedRequest).authWallet;
  const since = Number(req.query.since ?? 0) || 0;
  const payload = await pollTable(pid, String(req.params.id), since, BOARD_POLL_HOLD_MS);
  if (!payload) {
    res.status(404).json({ error: "That table is gone." });
    return;
  }
  res.json(payload);
}));

boardRouter.post("/board/tables/:id/action", requireAuth, handler(async (req, res) => {
  const pid = (req as AuthenticatedRequest).authWallet;
  const action = req.body?.action as BoardAction | undefined;
  if (!action || typeof action.type !== "string") {
    res.status(400).json({ error: "Missing action." });
    return;
  }
  const result = await act(pid, String(req.params.id), action);
  res.status(result.ok ? 200 : 400).json(result.ok ? { ok: true } : { error: result.error });
}));

boardRouter.get("/board/tables/:id/fairness", requireAuth, handler(async (req, res) => {
  const data = await fairnessFor(String(req.params.id));
  if (!data) {
    res.status(404).json({ error: "That table is gone." });
    return;
  }
  res.json(data);
}));
