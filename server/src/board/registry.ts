// District Deeds — the live table registry.
//
// Process-global, in the shape of social/partyRegistry.ts: an in-memory Map of
// live tables, mutated through a small set of functions that each return
// { ok, error? }. The difference is that a table is DURABLE — every committed
// action is written to Postgres before the caller is told it succeeded.
//
// ─── THE RULE THAT KEEPS A DEPLOY FROM COSTING SOMEONE THEIR STAKE ──────────
// `disconnectedAt` lives ONLY in this process's memory. It is never written to
// Postgres and never read back. `board_seats.connected` is persisted, but it
// is presentation only. A forfeit clock can therefore only ever be started by
// a live process that watched a live player go quiet — never by a process that
// merely found an old row on boot.
//
// Two independent guards enforce that: the rule above, and `resumeGraceUntil`,
// which short-circuits the whole sweep for ten minutes after a restart.
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from "node:crypto";

import {
  BOARD_AUTOPLAY_STRIKES_FORFEIT,
  BOARD_AUTOPLAY_STRIKES_IDLE,
  BOARD_SEAT_LIMITS,
  BOARD_STAKE_TIERS,
  BOARD_SUBTURN_SECONDS,
  BOARD_TURN_SECONDS,
  boardAllowsAi,
  type BoardAction,
  type BoardAiDifficulty,
  type BoardCurrencyId,
  type BoardState,
  type BoardStatePayload,
  type BoardTableStatus,
  type BoardTableSummary,
} from "@metricbase/shared";

import {
  addInvite,
  appendLedger,
  avatarForWallet,
  clearInvite,
  deleteSeat,
  insertTable,
  loadAllSeats,
  loadEvents,
  loadOpenTables,
  loadSeats,
  loadTable,
  saveTable,
  setTableStatus,
  startTableRow,
  upsertSeat,
  type BoardSeatRow,
  type BoardTableRow,
} from "../db/board.js";
import { sendToPlayer } from "../social/presence.js";
import { aiTradeResponses, aiView, chooseAction } from "./ai.js";
import { escrowStake, houseCanCover, refundStake, settlePot } from "./bank.js";
import { tableRiskScore, type TradeLogEntry } from "./collusion.js";
import { BOOT_AT, BOOT_ID, boardTimings, isBoardCurrencyActive } from "./config.js";
import { combineClientSeeds, commit, makeRandom, newSeed } from "./fairRoll.js";
import { applyAction, autoAction, forfeitSeat, newGame } from "./rules.js";

export interface BoardMutation {
  ok: boolean;
  error?: string;
  tableId?: string;
}

interface Waiter {
  resolve: (payload: BoardStatePayload | null) => void;
  since: number;
  pid: string;
  timer: NodeJS.Timeout;
}

interface LiveTable {
  row: BoardTableRow;
  seats: BoardSeatRow[];
  state: BoardState | null;
  version: number;
  rollNonce: number;
  turnDeadline: number | null;
  resumeGraceUntil: number | null;
  /** IN-MEMORY ONLY — see the header. Seat index → when WE observed silence. */
  disconnectedAt: Map<number, number>;
  lastSeen: Map<number, number>;
  waiters: Waiter[];
  /** Humanising pause before an AI moves, so the board stays readable. */
  aiReadyAt: number;
  trades: TradeLogEntry[];
  unopposedAuctions: number;
  linkageFlags: number;
  saving: boolean;
}

const tables = new Map<string, LiveTable>();
let sweepTimer: NodeJS.Timeout | null = null;

const MAX_ACTIONS_PER_TICK = 40;

// ── helpers ─────────────────────────────────────────────────────────────────

function newTableId(): string {
  return `bd_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

/** How long the seat on the clock has, given what it is being asked to decide. */
function deadlineFor(state: BoardState | null, now: number): number | null {
  if (!state || state.phase.kind === "done") return null;
  const seconds =
    state.phase.kind === "auction" || state.phase.kind === "awaitDebt"
      ? BOARD_SUBTURN_SECONDS
      : BOARD_TURN_SECONDS;
  return now + seconds * 1000;
}

/** Whose decision the table is waiting on. */
function actorOf(state: BoardState | null): number | null {
  if (!state || state.phase.kind === "done") return null;
  if (state.phase.kind === "auction") return state.phase.auction.currentBidder;
  if (state.phase.kind === "awaitDebt") return state.phase.debtor;
  return state.turn;
}

function seatOfPid(t: LiveTable, pid: string): BoardSeatRow | undefined {
  return t.seats.find((s) => s.pid === pid);
}

function summaryOf(t: LiveTable): BoardTableSummary {
  return {
    id: t.row.id,
    name: t.row.name,
    currencyId: t.row.currencyId,
    stake: t.row.stakeUnits,
    seatCount: t.row.seatCount,
    aiCount: t.row.aiCount,
    filled: t.seats.filter((s) => s.pid !== null || s.kind === "ai").length,
    status: t.row.status as BoardTableStatus,
    hostName: t.seats.find((s) => s.pid === t.row.hostPid)?.playerName ?? "",
    createdAt: t.row.createdAt,
  };
}

export function buildStatePayload(t: LiveTable, pid: string | null): BoardStatePayload {
  const mySeat = pid ? (seatOfPid(t, pid)?.seatIndex ?? null) : null;
  const now = Date.now();
  const ended = t.row.status === "done" || t.row.status === "void";
  return {
    table: summaryOf(t),
    version: t.version,
    serverBootId: BOOT_ID,
    mySeat,
    state: t.state,
    turnDeadline: t.turnDeadline,
    resumeGraceUntil: t.resumeGraceUntil && t.resumeGraceUntil > now ? t.resumeGraceUntil : null,
    seats: t.seats.map((s) => ({
      index: s.seatIndex,
      name: s.playerName,
      kind: s.kind,
      avatar: (s.avatar as "boy" | "girl" | null) ?? "boy",
      ready: s.ready,
      connected: s.kind === "ai" ? true : (t.lastSeen.get(s.seatIndex) ?? 0) > now - boardTimings().pollTimeoutMs,
      idle: (t.state?.seats[s.seatIndex]?.autoPlayStrikes ?? 0) >= BOARD_AUTOPLAY_STRIKES_IDLE,
      stakePaid: s.stakePaid,
    })),
    // The seed is withheld until the table is over. Serving it to a seated
    // player mid-game would let them compute every remaining roll.
    serverSeedHash: t.row.serverSeedHash,
    serverSeed: ended ? t.row.serverSeed : null,
    combinedClientSeed: t.row.combinedClientSeed,
    potUnits: t.row.potUnits,
    prizeUnits: Math.max(0, t.row.potUnits - t.row.rakeUnits),
    rakeUnits: t.row.rakeUnits,
  };
}

function wake(t: LiveTable): void {
  const waiting = t.waiters.splice(0, t.waiters.length);
  for (const w of waiting) {
    clearTimeout(w.timer);
    try {
      w.resolve(buildStatePayload(t, w.pid));
    } catch {
      /* the response is already gone */
    }
  }
}

async function persist(
  t: LiveTable,
  events: { seatIndex: number | null; kind: string; payload: unknown }[] = [],
): Promise<void> {
  if (!t.state) return;
  t.saving = true;
  try {
    await saveTable(
      t.row.id,
      {
        state: t.state,
        version: t.version,
        rollNonce: t.rollNonce,
        turnSeat: actorOf(t.state),
        turnDeadline: t.turnDeadline,
        bootId: BOOT_ID,
        resumeGraceUntil: t.resumeGraceUntil,
      },
      events,
    );
  } finally {
    t.saving = false;
  }
}

// ── lifecycle ───────────────────────────────────────────────────────────────

/**
 * Load every unfinished table on boot and hand out a restart amnesty.
 *
 * Called from index.ts alongside the other registry initialisers. A table whose
 * boot_id is not ours was interrupted by a restart, and NOBODY at it may be put
 * on a forfeit clock for the next ten minutes.
 */
export async function initBoardRegistry(): Promise<void> {
  try {
    const rows = await loadOpenTables();
    const seats = await loadAllSeats(rows.map((r) => r.id));
    for (const row of rows) {
      const mine = seats.filter((s) => s.tableId === row.id);
      const interrupted = row.bootId !== BOOT_ID;
      const t: LiveTable = {
        row,
        seats: mine,
        state: row.state,
        version: row.version,
        rollNonce: row.rollNonce,
        turnDeadline: row.turnDeadline,
        resumeGraceUntil: interrupted ? BOOT_AT + boardTimings().restartGraceMs : row.resumeGraceUntil,
        disconnectedAt: new Map(),
        lastSeen: new Map(),
        waiters: [],
        aiReadyAt: 0,
        trades: [],
        unopposedAuctions: 0,
        linkageFlags: 0,
        saving: false,
      };
      if (interrupted && t.state) {
        // Push the decision clock out past the amnesty so the seat on the clock
        // doesn't lose its turn to a timeout it never saw.
        t.turnDeadline = (t.resumeGraceUntil ?? BOOT_AT) + BOARD_TURN_SECONDS * 1000;
        t.row.bootId = BOOT_ID;
        await persist(t, [
          { seatIndex: null, kind: "resume", payload: { prevBootId: row.bootId, bootAt: BOOT_AT } },
        ]);
      }
      // Without this the seed chain is broken for the rest of the table's life.
      if (row.serverSeed) pendingSeeds.set(row.id, row.serverSeed);
      tables.set(row.id, t);
    }
    if (rows.length > 0) {
      console.log(`[board] resumed ${rows.length} table(s); restart amnesty ${Math.round(boardTimings().restartGraceMs / 1000)}s`);
    }
  } catch (error) {
    console.warn("[board] registry init failed:", error);
  }
  if (!sweepTimer) {
    // ONE sweep for every table. A timer per table across 90-minute games is a
    // leak waiting to happen, and a single sweep survives a resume trivially.
    sweepTimer = setInterval(() => void sweep(), 1000);
    sweepTimer.unref?.();
  }
}

/** Flush everything and wake every waiter so clients see the new boot id. */
export async function flushAllBoardTables(): Promise<void> {
  for (const t of tables.values()) {
    try {
      if (t.state) await persist(t);
    } catch {
      /* shutting down anyway */
    }
    wake(t);
  }
}

// ── lobby ───────────────────────────────────────────────────────────────────

export async function createTable(args: {
  pid: string;
  playerName: string;
  name: string;
  currencyId: BoardCurrencyId;
  stake: number;
  seatCount: number;
  aiCount: number;
  aiDifficulty: BoardAiDifficulty;
}): Promise<BoardMutation> {
  const { currencyId } = args;
  if (!isBoardCurrencyActive(currencyId)) return { ok: false, error: "That currency isn't open right now." };
  if (!BOARD_STAKE_TIERS[currencyId]?.includes(args.stake)) {
    return { ok: false, error: "Pick one of the listed stakes." };
  }
  const limits = BOARD_SEAT_LIMITS[currencyId];
  if (args.seatCount < limits.min || args.seatCount > limits.max) {
    return { ok: false, error: `${currencyId === "gold" ? "Gold" : "Stake"} tables take ${limits.min}–${limits.max} players.` };
  }
  if (args.aiCount > 0 && !boardAllowsAi(currencyId)) {
    return { ok: false, error: "Practice opponents only sit at gold tables." };
  }
  if (args.aiCount < 0 || args.aiCount > args.seatCount - 1) {
    return { ok: false, error: "You need at least one seat for yourself." };
  }

  const id = newTableId();
  const seed = newSeed();
  const created = await insertTable({
    id,
    name: args.name.slice(0, 40),
    currencyId,
    stakeUnits: args.stake,
    seatCount: args.seatCount,
    aiCount: args.aiCount,
    aiDifficulty: args.aiCount > 0 ? args.aiDifficulty : null,
    hostPid: args.pid,
    serverSeedHash: commit(seed),
    serverSeed: seed,
    bootId: BOOT_ID,
  });
  if (!created) return { ok: false, error: "Couldn't open that table." };

  const row = await loadTable(id);
  if (!row) return { ok: false, error: "Couldn't open that table." };
  pendingSeeds.set(id, seed);

  const t: LiveTable = {
    row,
    seats: [],
    state: null,
    version: 0,
    rollNonce: 0,
    turnDeadline: null,
    resumeGraceUntil: null,
    disconnectedAt: new Map(),
    lastSeen: new Map(),
    waiters: [],
    aiReadyAt: 0,
    trades: [],
    unopposedAuctions: 0,
    linkageFlags: 0,
    saving: false,
  };
  tables.set(id, t);

  // AI seats fill from the back so the host is always seat 0.
  for (let i = 0; i < args.aiCount; i++) {
    const seatIndex = args.seatCount - 1 - i;
    await upsertSeat({
      tableId: id,
      seatIndex,
      kind: "ai",
      pid: null,
      playerName: aiName(i),
      aiDifficulty: args.aiDifficulty,
      stakePaid: true,
      ready: true,
      // Alternate the heroes so a table of practice opponents isn't four of
      // the same character.
      avatar: i % 2 === 0 ? "girl" : "boy",
    });
  }
  t.seats = await loadSeats(id);

  const joined = await joinTable({ pid: args.pid, playerName: args.playerName, tableId: id });
  if (!joined.ok) {
    // The host couldn't take their own seat — usually an empty table bank. Undo
    // the whole thing rather than leaving an orphan lobby with AI seats and
    // nobody in it, which is exactly what the first version did.
    await setTableStatus(id, "void");
    pendingSeeds.delete(id);
    tables.delete(id);
    return joined;
  }
  return { ok: true, tableId: id };
}

/**
 * Server seeds for live tables, mirrored from `board_tables.server_seed`.
 *
 * The seed IS persisted, and it has to be: it is the HMAC key for every roll,
 * so a restart that loses it produces a table whose remaining rolls no longer
 * belong to the published commitment — and whose reveal can never be verified.
 * The first version kept it in memory only, and a restart silently broke the
 * fairness guarantee it existed to provide.
 *
 * It is never SERVED while a table is live (`buildStatePayload` and
 * `fairnessFor` both gate on the table having ended), so no player can predict
 * a roll. An operator with database access could read it, which is a real but
 * much smaller exposure: the commitment was published before play, so they
 * still cannot CHANGE a roll without it being detectable — only foresee one.
 */
const pendingSeeds = new Map<string, string>();

function aiName(i: number): string {
  return ["Kestrel", "Marlow", "Pike", "Verity", "Ansel"][i] ?? `Rival ${i + 1}`;
}

export async function joinTable(args: {
  pid: string;
  playerName: string;
  tableId: string;
  ipHash?: string | null;
}): Promise<BoardMutation> {
  const t = tables.get(args.tableId);
  if (!t) return { ok: false, error: "That table is gone." };
  if (t.row.status !== "lobby") return { ok: false, error: "That table has already started." };
  if (seatOfPid(t, args.pid)) return { ok: true, tableId: t.row.id };

  const taken = new Set(t.seats.map((s) => s.seatIndex));
  let seatIndex = -1;
  for (let i = 0; i < t.row.seatCount; i++) {
    if (!taken.has(i)) {
      seatIndex = i;
      break;
    }
  }
  if (seatIndex < 0) return { ok: false, error: "That table is full." };

  // Seat-linkage checks apply to stake tables only. A shared household will hit
  // them, and that is the correct trade-off: the alternative is two seats at one
  // pot that are really one person.
  if (t.row.currencyId !== "gold" && args.ipHash) {
    const clash = t.seats.some((s) => s.ipHash && s.ipHash === args.ipHash);
    if (clash) {
      return { ok: false, error: "Two seats at a stake table can't share a network." };
    }
  }

  const staked = await escrowStake({
    pid: args.pid,
    playerName: args.playerName,
    tableId: t.row.id,
    currencyId: t.row.currencyId,
    stakeUnits: t.row.stakeUnits,
  });
  if (!staked.ok) return { ok: false, error: staked.error };

  await upsertSeat({
    tableId: t.row.id,
    seatIndex,
    kind: "human",
    pid: args.pid,
    playerName: args.playerName,
    avatar: await avatarForWallet(args.pid),
    stakePaid: true,
    ready: false,
    connected: true,
    seenAt: Date.now(),
    ipHash: args.ipHash ?? null,
  });
  t.seats = await loadSeats(t.row.id);
  t.lastSeen.set(seatIndex, Date.now());
  await clearInvite(t.row.id, args.pid);
  wake(t);
  return { ok: true, tableId: t.row.id };
}

export async function leaveLobby(pid: string, tableId: string): Promise<BoardMutation> {
  const t = tables.get(tableId);
  if (!t) return { ok: false, error: "That table is gone." };
  if (t.row.status !== "lobby") return { ok: false, error: "You can't leave once the table has started." };
  const seat = seatOfPid(t, pid);
  if (!seat) return { ok: false, error: "You aren't at that table." };

  await refundStake({
    pid,
    playerName: seat.playerName,
    tableId,
    currencyId: t.row.currencyId,
    stakeUnits: t.row.stakeUnits,
    reason: "leave",
  });
  await deleteSeat(tableId, seat.seatIndex);
  t.seats = await loadSeats(tableId);

  // Host left and nobody else is seated: close the table rather than leave an
  // empty lobby lying around.
  if (t.seats.filter((s) => s.kind === "human").length === 0) {
    await setTableStatus(tableId, "void");
    t.row.status = "void";
    pendingSeeds.delete(tableId);
    tables.delete(tableId);
    return { ok: true };
  }
  wake(t);
  return { ok: true };
}

export async function setClientSeed(pid: string, tableId: string, seed: string): Promise<BoardMutation> {
  const t = tables.get(tableId);
  if (!t) return { ok: false, error: "That table is gone." };
  if (t.row.status !== "lobby") return { ok: false, error: "Seeds are locked once the table starts." };
  const seat = seatOfPid(t, pid);
  if (!seat) return { ok: false, error: "You aren't at that table." };
  const clean = seed.replace(/[^\w-]/g, "").slice(0, 64);
  if (clean.length < 4) return { ok: false, error: "Use at least 4 characters." };
  await upsertSeat({ ...seat, clientSeed: clean, kind: seat.kind, pid: seat.pid });
  t.seats = await loadSeats(tableId);
  wake(t);
  return { ok: true };
}

export async function setReady(pid: string, tableId: string, ready: boolean): Promise<BoardMutation> {
  const t = tables.get(tableId);
  if (!t) return { ok: false, error: "That table is gone." };
  const seat = seatOfPid(t, pid);
  if (!seat) return { ok: false, error: "You aren't at that table." };
  await upsertSeat({ ...seat, ready, kind: seat.kind, pid: seat.pid });
  t.seats = await loadSeats(tableId);
  wake(t);
  return { ok: true };
}

export async function invitePlayer(
  pid: string,
  tableId: string,
  toPid: string,
  toName: string,
): Promise<BoardMutation> {
  const t = tables.get(tableId);
  if (!t) return { ok: false, error: "That table is gone." };
  if (t.row.status !== "lobby") return { ok: false, error: "That table has already started." };
  const from = seatOfPid(t, pid);
  if (!from) return { ok: false, error: "You aren't at that table." };

  // Persisted, because presence can't reach a player who is only on /board:
  // social/presence.ts is populated in ZoneRoom.onJoin and a board player has
  // no room at all. The push below is a nicety for someone currently in-world.
  await addInvite(tableId, toPid, from.playerName);
  sendToPlayer(toName, "boardInvite", { tableId, fromName: from.playerName, table: summaryOf(t) });
  return { ok: true };
}

export async function startTable(pid: string, tableId: string): Promise<BoardMutation> {
  const t = tables.get(tableId);
  if (!t) return { ok: false, error: "That table is gone." };
  if (t.row.hostPid !== pid) return { ok: false, error: "Only the host can start the table." };
  if (t.row.status !== "lobby") return { ok: false, error: "That table has already started." };

  const humans = t.seats.filter((s) => s.kind === "human");
  const ais = t.seats.filter((s) => s.kind === "ai");
  if (humans.length + ais.length < t.row.seatCount) return { ok: false, error: "The table isn't full yet." };
  if (humans.some((s) => !s.ready)) return { ok: false, error: "Everyone has to be ready." };
  if (humans.some((s) => !s.stakePaid)) return { ok: false, error: "Someone hasn't paid in yet." };

  // Belt and braces on the rule the DB also enforces.
  if (ais.length > 0 && !boardAllowsAi(t.row.currencyId)) {
    return { ok: false, error: "Practice opponents only sit at gold tables." };
  }

  const pot = t.row.stakeUnits * humans.length;
  if (!(await houseCanCover(t.row.currencyId, pot))) {
    return { ok: false, error: "Stake tables are paused right now. Your stake is safe in your table bank." };
  }

  const seed = pendingSeeds.get(tableId);
  if (!seed) return { ok: false, error: "This table lost its seed and can't start. Leave to get your stake back." };

  const seeds = t.seats.map((s) => s.clientSeed || `seat${s.seatIndex}`);
  const combined = combineClientSeeds(seeds);

  const ordered = [...t.seats].sort((a, b) => a.seatIndex - b.seatIndex);
  const rand = makeRandom(seed, tableId, combined, 0, -1);
  const state = newGame(
    ordered.map((s) => ({
      name: s.playerName,
      kind: s.kind,
      aiDifficulty: (s.aiDifficulty as BoardAiDifficulty | null) ?? undefined,
    })),
    rand,
  );

  const now = Date.now();
  t.state = state;
  t.rollNonce = rand.nonce;
  t.version += 1;
  t.turnDeadline = deadlineFor(state, now);
  t.row.status = "running";
  t.row.combinedClientSeed = combined;
  t.row.potUnits = pot;

  await startTableRow(tableId, combined, t.turnDeadline ?? now, pot);
  await persist(t, [{ seatIndex: null, kind: "start", payload: { seeds, combined, pot } }]);
  wake(t);
  return { ok: true, tableId };
}

// ── play ────────────────────────────────────────────────────────────────────

export async function act(pid: string, tableId: string, action: BoardAction): Promise<BoardMutation> {
  const t = tables.get(tableId);
  if (!t) return { ok: false, error: "That table is gone." };
  if (!t.state) return { ok: false, error: "That table hasn't started." };
  if (t.row.status === "paused") return { ok: false, error: "This table is paused." };
  const seat = seatOfPid(t, pid);
  if (!seat) return { ok: false, error: "You aren't at that table." };

  t.lastSeen.set(seat.seatIndex, Date.now());
  t.disconnectedAt.delete(seat.seatIndex);

  const before = t.state.trades.length;
  const rand = makeRandom(
    pendingSeeds.get(tableId) ?? "",
    tableId,
    t.row.combinedClientSeed ?? "",
    t.rollNonce,
    seat.seatIndex,
  );
  const res = applyAction(t.state, seat.seatIndex, action, rand);
  if (!res.ok) return { ok: false, error: res.error };

  // A real move clears the idle strikes.
  t.state.seats[seat.seatIndex].autoPlayStrikes = 0;
  t.rollNonce = rand.nonce;

  const events = eventsFrom(t, rand.rolls, action, seat.seatIndex, before);
  await commitTurn(t, events);
  return { ok: true };
}

function eventsFrom(
  t: LiveTable,
  rolls: { nonce: number; d1: number; d2: number; seat: number }[],
  action: BoardAction,
  seatIndex: number,
  tradesBefore: number,
): { seatIndex: number | null; kind: string; payload: unknown }[] {
  const events: { seatIndex: number | null; kind: string; payload: unknown }[] = [];
  for (const r of rolls) {
    events.push({ seatIndex: r.seat, kind: "roll", payload: { nonce: r.nonce, d1: r.d1, d2: r.d2 } });
  }
  if (action.type === "respondTrade" && action.accept && t.state) {
    // Log both valuations so a reviewer can see what actually moved.
    events.push({ seatIndex, kind: "trade", payload: { tradeId: action.tradeId } });
  }
  if (action.type === "proposeTrade" && t.state && t.state.trades.length > tradesBefore) {
    events.push({
      seatIndex,
      kind: "offer",
      payload: {
        to: action.to,
        giveDeeds: action.giveDeeds,
        giveCash: action.giveCash,
        takeDeeds: action.takeDeeds,
        takeCash: action.takeCash,
      },
    });
  }
  return events;
}

/** Recompute the clock, persist, wake pollers, and settle if the table ended. */
async function commitTurn(
  t: LiveTable,
  events: { seatIndex: number | null; kind: string; payload: unknown }[],
): Promise<void> {
  const now = Date.now();
  t.version += 1;
  t.turnDeadline = deadlineFor(t.state, now);
  await persist(t, events);
  wake(t);
  if (t.state?.phase.kind === "done") await finishTable(t);
}

async function finishTable(t: LiveTable): Promise<void> {
  if (t.row.status !== "running" && t.row.status !== "paused") return;
  const state = t.state;
  if (!state || state.phase.kind !== "done") return;

  t.row.status = "settling";
  await setTableStatus(t.row.id, "settling");

  const winnerSeat = state.phase.winner;
  const seatRow = winnerSeat === null ? undefined : t.seats.find((s) => s.seatIndex === winnerSeat);

  const risk = tableRiskScore({
    seatCount: t.row.seatCount,
    trades: t.trades,
    bankruptcies: state.seats.filter((s) => s.status === "bankrupt").map((s) => ({ seat: s.index, turn: state.turnCount })),
    unopposedAuctions: t.unopposedAuctions,
    linkageFlags: t.linkageFlags,
    totalTurns: state.turnCount,
  });

  const seed = pendingSeeds.get(t.row.id) ?? null;

  // An AI won, or nobody did: the pot goes back to the humans who paid it. A
  // house-controlled opponent must never take a player's stake.
  if (!seatRow || seatRow.kind === "ai" || !seatRow.pid) {
    for (const s of t.seats) {
      if (s.kind !== "human" || !s.pid || !s.stakePaid) continue;
      await refundStake({
        pid: s.pid,
        playerName: s.playerName,
        tableId: t.row.id,
        currencyId: t.row.currencyId,
        stakeUnits: t.row.stakeUnits,
        reason: "nohuman",
      });
    }
    await setTableStatus(t.row.id, "done", { winnerPid: null, riskScore: risk, revealSeed: seed });
    t.row.status = "done";
    t.row.serverSeed = seed;
    pendingSeeds.delete(t.row.id);
    wake(t);
    return;
  }

  // High-risk tables hold for a human to look at before any money moves. The
  // right to do this is stated in BOARD_ENTRY_TERMS, shown before anyone pays.
  if (risk > 0 && t.row.currencyId !== "gold" && risk >= 60) {
    await setTableStatus(t.row.id, "review", { winnerPid: seatRow.pid, riskScore: risk, revealSeed: seed });
    t.row.status = "review";
    t.row.serverSeed = seed;
    pendingSeeds.delete(t.row.id);
    wake(t);
    console.warn(`[board] table ${t.row.id} held for review (risk ${risk})`);
    return;
  }

  const { rake, prize } = await settlePot({
    tableId: t.row.id,
    currencyId: t.row.currencyId,
    winnerPid: seatRow.pid,
    winnerName: seatRow.playerName,
    potUnits: t.row.potUnits,
    humanCount: t.seats.filter((s) => s.kind === "human" && s.stakePaid).length,
  });

  await setTableStatus(t.row.id, "done", {
    winnerPid: seatRow.pid,
    rakeUnits: rake,
    riskScore: risk,
    revealSeed: seed,
  });
  t.row.status = "done";
  t.row.rakeUnits = rake;
  t.row.serverSeed = seed;
  pendingSeeds.delete(t.row.id);
  wake(t);
  console.log(`[board] table ${t.row.id} settled: ${seatRow.playerName} took ${prize} (rake ${rake} ${t.row.currencyId})`);
}

// ── the sweep ───────────────────────────────────────────────────────────────

async function sweep(): Promise<void> {
  const now = Date.now();
  for (const t of tables.values()) {
    if (t.saving) continue;
    if (t.row.status !== "running") continue;
    if (!t.state || t.state.phase.kind === "done") continue;

    try {
      await sweepTable(t, now);
    } catch (error) {
      console.warn(`[board] sweep failed for ${t.row.id}:`, error);
    }
  }
}

async function sweepTable(t: LiveTable, now: number): Promise<void> {
  const state = t.state;
  if (!state) return;

  // The post-restart amnesty suppresses CLOCKS — forfeits and turn timeouts —
  // and nothing else. It must not freeze the table itself: an earlier version
  // returned here outright, so after every deploy the practice opponents sat
  // motionless for ten minutes and the game looked dead.
  const inAmnesty = !!(t.resumeGraceUntil && now < t.resumeGraceUntil);

  // Disconnect detection. GUARD 2: `disconnectedAt` is set ONLY here, by a
  // process that watched a live seat go quiet, and is never persisted.
  if (!inAmnesty) for (const seat of t.seats) {
    if (seat.kind === "ai") continue;
    const seatState = state.seats[seat.seatIndex];
    if (!seatState || seatState.status !== "active") continue;
    const seen = t.lastSeen.get(seat.seatIndex) ?? 0;
    if (seen > now - boardTimings().pollTimeoutMs) {
      t.disconnectedAt.delete(seat.seatIndex);
      continue;
    }
    if (!t.disconnectedAt.has(seat.seatIndex)) {
      t.disconnectedAt.set(seat.seatIndex, now);
      continue;
    }
    const since = t.disconnectedAt.get(seat.seatIndex) ?? now;
    if (now - since >= boardTimings().disconnectGraceMs) {
      forfeitSeat(state, seat.seatIndex);
      t.disconnectedAt.delete(seat.seatIndex);
      await commitTurn(t, [
        { seatIndex: seat.seatIndex, kind: "forfeit", payload: { reason: "disconnected" } },
      ]);
      return;
    }
  }

  const actor = actorOf(state);
  if (actor === null) return;
  const seatRow = t.seats.find((s) => s.seatIndex === actor);
  if (!seatRow) return;

  // AI turn.
  if (seatRow.kind === "ai") {
    const { aiThinkMinMs, aiThinkMaxMs } = boardTimings();
    if (t.aiReadyAt === 0 && aiThinkMaxMs > 0) {
      t.aiReadyAt = now + aiThinkMinMs + Math.random() * (aiThinkMaxMs - aiThinkMinMs);
      return;
    }
    if (now < t.aiReadyAt) return;
    t.aiReadyAt = 0;
    await runAiTurn(t, actor);
    return;
  }

  // Human on the clock. Never during the amnesty — they did not see the clock
  // that was running while the server was down.
  if (!inAmnesty && t.turnDeadline !== null && now >= t.turnDeadline) {
    const action = autoAction(state, actor);
    if (!action) return;
    const rand = makeRandom(
      pendingSeeds.get(t.row.id) ?? "",
      t.row.id,
      t.row.combinedClientSeed ?? "",
      t.rollNonce,
      actor,
    );
    const res = applyAction(state, actor, action, rand);
    t.rollNonce = rand.nonce;
    if (res.ok) {
      const seatState = state.seats[actor];
      seatState.autoPlayStrikes += 1;
      const events = rand.rolls.map((r) => ({
        seatIndex: r.seat,
        kind: "roll",
        payload: { nonce: r.nonce, d1: r.d1, d2: r.d2 },
      }));
      events.push({ seatIndex: actor, kind: "autoplay", payload: { action: action.type } } as never);
      if (seatState.autoPlayStrikes >= BOARD_AUTOPLAY_STRIKES_FORFEIT) {
        forfeitSeat(state, actor);
        events.push({ seatIndex: actor, kind: "forfeit", payload: { reason: "idle" } } as never);
      }
      await commitTurn(t, events);
    } else {
      // The published auto-play is always legal; if it isn't, the clock must
      // not be allowed to spin on it every second.
      t.turnDeadline = deadlineFor(state, now);
      console.warn(`[board] auto-play rejected on ${t.row.id}: ${res.error}`);
    }
  }
}

async function runAiTurn(t: LiveTable, seatIndex: number): Promise<void> {
  const state = t.state;
  if (!state) return;
  const difficulty = (t.seats.find((s) => s.seatIndex === seatIndex)?.aiDifficulty as BoardAiDifficulty) ?? "normal";

  const allRolls: { nonce: number; d1: number; d2: number; seat: number }[] = [];
  let acted = 0;

  // Loop until the AI hands the turn on. Bounded, because a rules bug must
  // degrade into a stuck table an operator can see, not a pinned CPU.
  while (acted < MAX_ACTIONS_PER_TICK) {
    if (state.phase.kind === "done") break;
    if (actorOf(state) !== seatIndex) break;

    let action = chooseAction(aiView(state), seatIndex, difficulty) ?? autoAction(state, seatIndex);
    if (!action) break;

    const rand = makeRandom(
      pendingSeeds.get(t.row.id) ?? "",
      t.row.id,
      t.row.combinedClientSeed ?? "",
      t.rollNonce,
      seatIndex,
    );
    let res = applyAction(state, seatIndex, action, rand);
    t.rollNonce = rand.nonce;
    allRolls.push(...rand.rolls);

    if (!res.ok) {
      const fallback = autoAction(state, seatIndex);
      if (!fallback) break;
      const rand2 = makeRandom(
        pendingSeeds.get(t.row.id) ?? "",
        t.row.id,
        t.row.combinedClientSeed ?? "",
        t.rollNonce,
        seatIndex,
      );
      res = applyAction(state, seatIndex, fallback, rand2);
      t.rollNonce = rand2.nonce;
      allRolls.push(...rand2.rolls);
      if (!res.ok) {
        console.warn(`[board] AI stuck on ${t.row.id}: ${res.error}`);
        break;
      }
      action = fallback;
    }

    // An offer aimed at another AI has to be answered here, or it just expires
    // at end of turn and no group is ever assembled.
    for (const resp of aiTradeResponses(aiView(state))) {
      const r3 = makeRandom(
        pendingSeeds.get(t.row.id) ?? "",
        t.row.id,
        t.row.combinedClientSeed ?? "",
        t.rollNonce,
        resp.seat,
      );
      applyAction(state, resp.seat, { type: "respondTrade", tradeId: resp.tradeId, accept: resp.accept }, r3);
      t.rollNonce = r3.nonce;
    }

    acted += 1;
    if (action.type === "endTurn") break;
  }

  const events = allRolls.map((r) => ({
    seatIndex: r.seat,
    kind: "roll",
    payload: { nonce: r.nonce, d1: r.d1, d2: r.d2 },
  }));
  await commitTurn(t, events);
}

// ── polling ─────────────────────────────────────────────────────────────────

/**
 * Long-poll one table. Returns immediately when the caller is behind, otherwise
 * parks for up to BOARD_POLL_HOLD_MS.
 *
 * Polling is also the heartbeat: touching `lastSeen` here is what tells the
 * sweep a seat is still there.
 */
export function pollTable(
  pid: string,
  tableId: string,
  since: number,
  holdMs: number,
): Promise<BoardStatePayload | null> {
  const t = tables.get(tableId);
  if (!t) return Promise.resolve(null);

  const seat = seatOfPid(t, pid);
  if (seat) {
    t.lastSeen.set(seat.seatIndex, Date.now());
    t.disconnectedAt.delete(seat.seatIndex);
  }

  if (t.version > since) return Promise.resolve(buildStatePayload(t, pid));

  return new Promise((resolve) => {
    const waiter: Waiter = {
      resolve,
      since,
      pid,
      timer: setTimeout(() => {
        const idx = t.waiters.indexOf(waiter);
        if (idx >= 0) t.waiters.splice(idx, 1);
        resolve(buildStatePayload(t, pid));
      }, holdMs),
    };
    t.waiters.push(waiter);
  });
}

export function getTable(tableId: string): LiveTable | undefined {
  return tables.get(tableId);
}

/**
 * Everything worth showing in the lobby: tables you can still sit at, tables
 * already running (which you can watch), and any table you hold a seat at.
 *
 * Running tables are listed deliberately. With a handful of players online, a
 * lobby that only ever shows empty chairs reads as a dead feature — a game in
 * progress is the strongest evidence that the thing is worth trying.
 */
export function listOpenTables(pid: string): BoardTableSummary[] {
  const out: BoardTableSummary[] = [];
  for (const t of tables.values()) {
    const seated = !!seatOfPid(t, pid);
    if (t.row.status === "lobby" || t.row.status === "running" || seated) out.push(summaryOf(t));
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export function myTables(pid: string): BoardTableSummary[] {
  const out: BoardTableSummary[] = [];
  for (const t of tables.values()) if (seatOfPid(t, pid)) out.push(summaryOf(t));
  return out;
}

// ── ops ─────────────────────────────────────────────────────────────────────

export function liveTablesForOps(): {
  id: string;
  currencyId: string;
  stake: number;
  seats: number;
  status: string;
  turnSeat: number | null;
  pot: number;
  risk: number;
  startedAt: number | null;
}[] {
  return [...tables.values()].map((t) => ({
    id: t.row.id,
    currencyId: t.row.currencyId,
    stake: t.row.stakeUnits,
    seats: t.seats.length,
    status: t.row.status,
    turnSeat: actorOf(t.state),
    pot: t.row.potUnits,
    risk: t.row.riskScore,
    startedAt: t.row.startedAt,
  }));
}

export async function pauseTable(tableId: string, paused: boolean): Promise<BoardMutation> {
  const t = tables.get(tableId);
  if (!t) return { ok: false, error: "No such table." };
  if (paused && t.row.status !== "running") return { ok: false, error: "That table isn't running." };
  if (!paused && t.row.status !== "paused") return { ok: false, error: "That table isn't paused." };
  t.row.status = paused ? "paused" : "running";
  if (!paused) t.turnDeadline = deadlineFor(t.state, Date.now());
  await setTableStatus(tableId, t.row.status);
  t.version += 1;
  wake(t);
  return { ok: true };
}

/** Refund every stake and close the table. The reveal happens too. */
export async function voidTable(tableId: string, reason: string): Promise<BoardMutation> {
  const t = tables.get(tableId);
  if (!t) return { ok: false, error: "No such table." };
  for (const s of t.seats) {
    if (s.kind !== "human" || !s.pid || !s.stakePaid) continue;
    await refundStake({
      pid: s.pid,
      playerName: s.playerName,
      tableId,
      currencyId: t.row.currencyId,
      stakeUnits: t.row.stakeUnits,
      reason: `void:${reason}`,
    });
  }
  await setTableStatus(tableId, "void", { revealSeed: pendingSeeds.get(tableId) ?? null });
  t.row.status = "void";
  t.row.serverSeed = pendingSeeds.get(tableId) ?? null;
  pendingSeeds.delete(tableId);
  t.version += 1;
  wake(t);
  tables.delete(tableId);
  return { ok: true };
}

/** Everything the fairness endpoint publishes. */
export async function fairnessFor(tableId: string): Promise<{
  tableId: string;
  serverSeedHash: string;
  serverSeed: string | null;
  combinedClientSeed: string | null;
  clientSeeds: { seat: number; name: string; seed: string }[];
  rolls: { nonce: number; d1: number; d2: number; seat: number }[];
} | null> {
  const t = tables.get(tableId);
  const row = t?.row ?? (await loadTable(tableId));
  if (!row) return null;
  const seats = t?.seats ?? (await loadSeats(tableId));
  const events = await loadEvents(tableId, "roll");
  const ended = row.status === "done" || row.status === "void" || row.status === "review";
  return {
    tableId,
    serverSeedHash: row.serverSeedHash,
    serverSeed: ended ? row.serverSeed : null,
    combinedClientSeed: row.combinedClientSeed,
    clientSeeds: seats.map((s) => ({ seat: s.seatIndex, name: s.playerName, seed: s.clientSeed })),
    rolls: events.map((e) => ({
      nonce: Number(e.payload.nonce ?? 0),
      d1: Number(e.payload.d1 ?? 0),
      d2: Number(e.payload.d2 ?? 0),
      seat: e.seatIndex ?? -1,
    })),
  };
}

/** Unused today but kept beside its ledger twin so the pair stays obvious. */
export { appendLedger as appendBoardLedger };
