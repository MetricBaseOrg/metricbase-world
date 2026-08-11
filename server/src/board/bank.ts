// District Deeds — the table bank. The ONLY place real value moves.
//
// Everything in server/src/board/ except this file deals in ⌬, an abstract
// board unit worth nothing. This file is the boundary: gold, $BASE and SOL come
// in here, and leave here, and nowhere else.
//
// Money discipline is copied from db/seasonVault.ts, NOT from the older
// deposit-then-refund-on-failure shape, which can pay twice when a send fails
// ambiguously:
//
//   in    : verify on-chain → append a ledger row keyed on the signature
//   stake : debit conditionally on the derived balance, in one statement
//   out   : reserve a pending negative row → send → stamp settled;
//           mark failed ONLY when the transfer definitively did not happen
//
// A pot NEVER pays out on-chain directly. Settlement credits the winner's board
// bank and stops there; cashing out is a separate, explicit action. That means
// a settlement can't half-fail with money in flight, and there is exactly one
// outbound code path to get right instead of two.

import {
  boardRakeSplit,
  toBaseUnits,
  type BoardCurrencyId,
} from "@metricbase/shared";

import {
  appendLedger,
  appendLedgerIfFunded,
  boardBalance,
  boardBalances,
  isSignatureUsed,
  stampLedger,
} from "../db/board.js";
import { creditTreasuryGold } from "../economy/treasury.js";
import { getHouseBalanceUi, sendPayout } from "../solana/housePayout.js";
import { verifyPeerSolTransfer } from "../solana/verifyPeerSolTransfer.js";
import { verifyPeerTokenTransfer } from "../solana/verifyPeerTokenTransfer.js";
import { ZoneRoom } from "../rooms/ZoneRoom.js";
import { boardHouseWallet, boardMoneyEnabled } from "./config.js";

export type BankResult<T = void> =
  | ({ ok: true } & (T extends void ? Record<string, never> : T))
  | { ok: false; error: string; retryable?: boolean };

/** BASE follows TOKEN_MINT the same way every other $BASE path does. */
function resolveMint(currencyId: BoardCurrencyId): string | null {
  if (currencyId === "gold" || currencyId === "sol") return null;
  return process.env.TOKEN_MINT ?? null;
}

export async function getBoardBalances(pid: string): Promise<Record<string, number>> {
  return boardBalances(pid);
}

// ── in: gold ────────────────────────────────────────────────────────────────
// The gold funding transaction lives in db/board.ts because it has to touch
// `characters.gold` in the same transaction as the ledger row. See
// fundBoardBankFromCharacter and ZoneRoom.handleBoardBankFund.

// ── in: on-chain ────────────────────────────────────────────────────────────

/**
 * Credit a verified on-chain transfer into the player's board bank.
 *
 * Two rules inherited from every other verified-inbound path here:
 *  - "not found yet" is RETRYABLE, never invalid. A real payment must never be
 *    dropped because the RPC hadn't indexed it.
 *  - Credit what ACTUALLY moved, not what was asked for.
 */
export async function depositOnChain(args: {
  pid: string;
  playerName: string;
  wallet: string;
  currencyId: BoardCurrencyId;
  signature: string;
  minUiAmount: number;
}): Promise<BankResult<{ credited: number }>> {
  if (args.currencyId === "gold") return { ok: false, error: "Gold is funded from inside the world." };
  if (!boardMoneyEnabled()) return { ok: false, error: "Stake tables are closed right now." };

  const house = boardHouseWallet();
  if (!house) return { ok: false, error: "Stake tables are closed right now." };

  if (await isSignatureUsed(args.signature)) {
    return { ok: false, error: "That transfer has already been credited." };
  }

  let uiAmount: number | null = null;
  if (args.currencyId === "sol") {
    const res = await verifyPeerSolTransfer(args.signature, {
      fromWallet: args.wallet,
      toWallet: house,
      minUiAmount: args.minUiAmount,
    });
    if (!res.ok) return { ok: false, error: res.error ?? "Couldn't verify that transfer.", retryable: res.retryable };
    uiAmount = res.uiAmount ?? args.minUiAmount;
  } else {
    const mint = resolveMint(args.currencyId);
    if (!mint) return { ok: false, error: "Stake tables are closed right now." };
    const res = await verifyPeerTokenTransfer(args.signature, {
      fromWallet: args.wallet,
      toWallet: house,
      mint,
      minUiAmount: args.minUiAmount,
    });
    if (!res.ok) return { ok: false, error: res.error ?? "Couldn't verify that transfer.", retryable: res.retryable };
    uiAmount = res.uiAmount ?? args.minUiAmount;
  }

  const units = toBaseUnits(uiAmount, args.currencyId);
  if (!Number.isFinite(units) || units <= 0) return { ok: false, error: "That transfer was empty." };

  const id = await appendLedger({
    pid: args.pid,
    playerName: args.playerName,
    currencyId: args.currencyId,
    kind: "deposit",
    delta: units,
    requestId: `dep:${args.signature}`,
    signature: args.signature,
  });
  if (id === null) {
    // Someone else recorded it between our check and our insert. Reporting
    // success here would be a lie either way round, so say what happened.
    return { ok: false, error: "That transfer has already been credited." };
  }
  return { ok: true, credited: units };
}

// ── stakes ──────────────────────────────────────────────────────────────────

/** Take a seat's stake into the pot. One statement, so two concurrent joins
 *  can't both pass the balance check. */
export async function escrowStake(args: {
  pid: string;
  playerName: string;
  tableId: string;
  currencyId: BoardCurrencyId;
  stakeUnits: number;
}): Promise<BankResult> {
  const id = await appendLedgerIfFunded({
    pid: args.pid,
    playerName: args.playerName,
    currencyId: args.currencyId,
    kind: "stake_in",
    delta: -Math.floor(args.stakeUnits),
    tableId: args.tableId,
    requestId: `stake:${args.tableId}:${args.pid}`,
  });
  if (id === null) {
    const have = await boardBalance(args.pid, args.currencyId);
    if (have < args.stakeUnits) return { ok: false, error: "Your table bank is short for that stake." };
    return { ok: false, error: "You've already paid into this table." };
  }
  return { ok: true } as BankResult;
}

/** Give a stake back — leaving a lobby, or an ops void. Idempotent per table. */
export async function refundStake(args: {
  pid: string;
  playerName: string;
  tableId: string;
  currencyId: BoardCurrencyId;
  stakeUnits: number;
  reason: string;
}): Promise<BankResult> {
  const id = await appendLedger({
    pid: args.pid,
    playerName: args.playerName,
    currencyId: args.currencyId,
    kind: "refund",
    delta: Math.floor(args.stakeUnits),
    tableId: args.tableId,
    requestId: `refund:${args.reason}:${args.tableId}:${args.pid}`,
  });
  if (id === null) return { ok: false, error: "Already refunded." };
  return { ok: true } as BankResult;
}

/**
 * Settle a finished table: rake to the house, prize to the winner's bank.
 *
 * Nothing goes on-chain here. The winner's prize is a ledger credit they cash
 * out separately, so a settlement cannot leave money in flight.
 */
export async function settlePot(args: {
  tableId: string;
  currencyId: BoardCurrencyId;
  winnerPid: string;
  winnerName: string;
  potUnits: number;
  /** How many humans actually paid into this pot. */
  humanCount: number;
}): Promise<{ rake: number; prize: number }> {
  // No rake on a practice table. With one human the pot IS that player's own
  // stake, so raking it means the best possible outcome of a practice game is
  // losing 5% — which is a strange thing to charge someone for playing against
  // a bot. The rake exists as a sink on real competition between players.
  const { rake, prize } =
    args.humanCount >= 2
      ? boardRakeSplit(Math.floor(args.potUnits))
      : { rake: 0, prize: Math.floor(args.potUnits) };

  if (prize > 0) {
    await appendLedger({
      pid: args.winnerPid,
      playerName: args.winnerName,
      currencyId: args.currencyId,
      kind: "prize_out",
      delta: prize,
      tableId: args.tableId,
      requestId: `prize:${args.tableId}`,
    });
  }

  if (rake > 0) {
    if (args.currencyId === "gold") {
      // Gold taken as rake leaves circulation for good — book it as a sink the
      // same way every other gold sink is booked.
      creditTreasuryGold("board_rake", rake);
    }
    // For $BASE and SOL the rake is simply never sent: it is already sitting in
    // the house wallet, and no ledger row means nobody is owed it.
  }

  return { rake, prize };
}

// ── out: gold ───────────────────────────────────────────────────────────────

/**
 * Cash gold out of the board bank back into the world.
 *
 * Reserve → credit → stamp. `creditPlayerGlobal` is the only safe way to pay
 * gold from outside a room: it pays an online session by pid, and falls back to
 * `pending_gold` when the player is offline. Writing `pending_gold` directly
 * would be clobbered by its in-memory mirror in zones/assetMarket.ts.
 */
export async function cashOutGold(args: {
  pid: string;
  playerName: string;
  amount: number;
  requestId: string;
}): Promise<BankResult<{ paid: number }>> {
  const amount = Math.floor(args.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter an amount above zero." };

  const id = await appendLedgerIfFunded({
    pid: args.pid,
    playerName: args.playerName,
    currencyId: "gold",
    kind: "cashout",
    delta: -amount,
    requestId: args.requestId,
    status: "pending",
  });
  if (id === null) {
    const have = await boardBalance(args.pid, "gold");
    if (have < amount) return { ok: false, error: "Your table bank doesn't have that much." };
    return { ok: false, error: "That cash-out already went through." };
  }

  try {
    ZoneRoom.creditPlayerGlobal(args.playerName, amount);
  } catch (error) {
    // The credit is synchronous and in-process, so this is close to impossible
    // — but a thrown error means we do NOT know whether it landed, and an
    // ambiguous reservation must stay pending rather than be released.
    console.warn("[board] gold cash-out credit failed:", error);
    return { ok: false, error: "That didn't complete. It's been flagged for review." };
  }

  await stampLedger(id, "settled");
  return { ok: true, paid: amount };
}

// ── out: on-chain ───────────────────────────────────────────────────────────

/**
 * Cash $BASE or SOL out of the board bank.
 *
 * `failed` is written ONLY when sendPayout reports a transfer it knows did not
 * happen. Anything ambiguous — an RPC timeout after submitting, say — stays
 * `pending` forever and surfaces via listPendingBoardCashouts. Releasing an
 * ambiguous reservation is how you pay twice.
 */
export async function cashOutOnChain(args: {
  pid: string;
  playerName: string;
  wallet: string;
  currencyId: BoardCurrencyId;
  units: number;
  requestId: string;
}): Promise<BankResult<{ signature: string }>> {
  if (args.currencyId === "gold") return { ok: false, error: "Use the gold cash-out for gold." };
  const units = Math.floor(args.units);
  if (!Number.isFinite(units) || units <= 0) return { ok: false, error: "Enter an amount above zero." };

  const id = await appendLedgerIfFunded({
    pid: args.pid,
    playerName: args.playerName,
    currencyId: args.currencyId,
    kind: "cashout",
    delta: -units,
    requestId: args.requestId,
    status: "pending",
  });
  if (id === null) {
    const have = await boardBalance(args.pid, args.currencyId);
    if (have < units) return { ok: false, error: "Your table bank doesn't have that much." };
    return { ok: false, error: "That cash-out is already in progress." };
  }

  const payout = await sendPayout(args.wallet, args.currencyId, units, resolveMint(args.currencyId));
  if (!payout.ok) {
    await stampLedger(id, "failed");
    return { ok: false, error: payout.error ?? "That transfer didn't go through." };
  }
  await stampLedger(id, "settled", payout.signature ?? undefined);
  return { ok: true, signature: payout.signature ?? "" };
}

// ── solvency ────────────────────────────────────────────────────────────────

/**
 * Can the house cover this pot?
 *
 * Fails CLOSED when the balance read fails — unlike a single hand, a pot is
 * large enough that guessing is not acceptable. A table that cannot be paid
 * must not be allowed to start.
 */
export async function houseCanCover(currencyId: BoardCurrencyId, potUnits: number): Promise<boolean> {
  if (currencyId === "gold") return true; // gold prizes are ledger credits, not sends
  const house = boardHouseWallet();
  if (!house) return false;
  const ui = await getHouseBalanceUi(house, currencyId, resolveMint(currencyId));
  if (ui === null) return false;
  return toBaseUnits(ui, currencyId) >= Math.floor(potUnits);
}
