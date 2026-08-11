// District Deeds — persistence.
//
// Two things here are load-bearing and easy to break:
//
//  1. `boardBalance` is DERIVED from board_ledger, never stored. Same reasoning
//     as db/seasonVault.ts: a number in a row drifts away from what actually
//     moved; a sum of recorded movements cannot. A pending cash-out is a
//     negative row, so it reduces the balance the moment it is reserved.
//
//  2. `saveTable` writes state, version AND roll_nonce in one statement. If the
//     nonce could lag the state, a crash between them would let the same nonce
//     produce a second, different roll and the published fairness log would no
//     longer match the board.

import type { BoardState, BoardCurrencyId } from "@metricbase/shared";

import { getPool } from "./pool.js";

export interface BoardTableRow {
  id: string;
  name: string;
  currencyId: BoardCurrencyId;
  stakeUnits: number;
  seatCount: number;
  aiCount: number;
  aiDifficulty: string | null;
  status: string;
  hostPid: string;
  serverSeedHash: string;
  serverSeed: string | null;
  combinedClientSeed: string | null;
  rollNonce: number;
  bootId: string | null;
  resumeGraceUntil: number | null;
  turnSeat: number | null;
  turnDeadline: number | null;
  version: number;
  state: BoardState | null;
  potUnits: number;
  rakeUnits: number;
  riskScore: number;
  winnerPid: string | null;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
}

export interface BoardSeatRow {
  tableId: string;
  seatIndex: number;
  kind: "human" | "ai";
  pid: string | null;
  playerName: string;
  aiDifficulty: string | null;
  clientSeed: string;
  stakePaid: boolean;
  ready: boolean;
  connected: boolean;
  seenAt: number | null;
  status: string;
  ipHash: string | null;
  funderWallet: string | null;
  avatar: string | null;
}

const TABLE_COLS = `
  id, name, currency_id, stake_units, seat_count, ai_count, ai_difficulty, status, host_pid,
  server_seed_hash, server_seed, combined_client_seed, roll_nonce, boot_id,
  resume_grace_until, turn_seat, turn_deadline, version, state, pot_units,
  rake_units, risk_score, winner_pid, created_at, started_at, ended_at`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapTable(r: any): BoardTableRow {
  return {
    id: r.id,
    name: r.name ?? "",
    currencyId: r.currency_id,
    stakeUnits: Number(r.stake_units),
    seatCount: Number(r.seat_count),
    aiCount: Number(r.ai_count),
    aiDifficulty: r.ai_difficulty ?? null,
    status: r.status,
    hostPid: r.host_pid,
    serverSeedHash: r.server_seed_hash,
    serverSeed: r.server_seed ?? null,
    combinedClientSeed: r.combined_client_seed ?? null,
    rollNonce: Number(r.roll_nonce),
    bootId: r.boot_id ?? null,
    resumeGraceUntil: r.resume_grace_until === null ? null : Number(r.resume_grace_until),
    turnSeat: r.turn_seat === null ? null : Number(r.turn_seat),
    turnDeadline: r.turn_deadline === null ? null : Number(r.turn_deadline),
    version: Number(r.version),
    state: r.state && Object.keys(r.state).length > 0 ? (r.state as BoardState) : null,
    potUnits: Number(r.pot_units),
    rakeUnits: Number(r.rake_units),
    riskScore: Number(r.risk_score),
    winnerPid: r.winner_pid ?? null,
    createdAt: new Date(r.created_at).getTime(),
    startedAt: r.started_at ? new Date(r.started_at).getTime() : null,
    endedAt: r.ended_at ? new Date(r.ended_at).getTime() : null,
  };
}

function mapSeat(r: any): BoardSeatRow {
  return {
    tableId: r.table_id,
    seatIndex: Number(r.seat_index),
    kind: r.kind,
    pid: r.pid ?? null,
    playerName: r.player_name ?? "",
    aiDifficulty: r.ai_difficulty ?? null,
    clientSeed: r.client_seed ?? "",
    stakePaid: !!r.stake_paid,
    ready: !!r.ready,
    connected: !!r.connected,
    seenAt: r.seen_at === null ? null : Number(r.seen_at),
    status: r.status,
    ipHash: r.ip_hash ?? null,
    funderWallet: r.funder_wallet ?? null,
    avatar: r.avatar ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── tables ──────────────────────────────────────────────────────────────────

export async function insertTable(row: {
  id: string;
  name: string;
  currencyId: string;
  stakeUnits: number;
  seatCount: number;
  aiCount: number;
  aiDifficulty: string | null;
  hostPid: string;
  serverSeedHash: string;
  serverSeed: string;
  bootId: string;
}): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  const res = await pool.query(
    `INSERT INTO board_tables
       (id, name, currency_id, stake_units, seat_count, ai_count, ai_difficulty,
        host_pid, server_seed_hash, server_seed, boot_id, status)
     VALUES ($1,$2,$3,$4::bigint,$5,$6,$7,$8,$9,$10,$11::uuid,'lobby')
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [row.id, row.name, row.currencyId, Math.floor(row.stakeUnits), row.seatCount, row.aiCount,
     row.aiDifficulty, row.hostPid, row.serverSeedHash, row.serverSeed, row.bootId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function loadOpenTables(): Promise<BoardTableRow[]> {
  const pool = getPool();
  if (!pool) return [];
  const res = await pool.query(
    `SELECT ${TABLE_COLS} FROM board_tables
      WHERE status IN ('lobby','running','paused','settling','review')
      ORDER BY created_at ASC`,
  );
  return res.rows.map(mapTable);
}

export async function loadTable(id: string): Promise<BoardTableRow | null> {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query(`SELECT ${TABLE_COLS} FROM board_tables WHERE id = $1`, [id]);
  return res.rows[0] ? mapTable(res.rows[0]) : null;
}

/**
 * The hot write. State, version and nonce move together, deliberately — see the
 * header. `seq` numbers the events so the roll log is orderable without relying
 * on a timestamp.
 */
export async function saveTable(
  id: string,
  patch: {
    state: BoardState;
    version: number;
    rollNonce: number;
    turnSeat: number | null;
    turnDeadline: number | null;
    status?: string;
    bootId?: string;
    resumeGraceUntil?: number | null;
  },
  events: { seatIndex: number | null; kind: string; payload: unknown }[] = [],
): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE board_tables
          SET state = $2::jsonb, version = $3, roll_nonce = $4,
              turn_seat = $5, turn_deadline = $6,
              status = COALESCE($7, status),
              boot_id = COALESCE($8::uuid, boot_id),
              resume_grace_until = $9
        WHERE id = $1`,
      [id, JSON.stringify(patch.state), patch.version, patch.rollNonce,
       patch.turnSeat, patch.turnDeadline, patch.status ?? null,
       patch.bootId ?? null, patch.resumeGraceUntil ?? null],
    );
    if (events.length > 0) {
      const base = await client.query<{ n: string }>(
        "SELECT COALESCE(MAX(seq), 0)::text AS n FROM board_events WHERE table_id = $1",
        [id],
      );
      let seq = Number(base.rows[0]?.n ?? 0);
      for (const ev of events) {
        seq += 1;
        await client.query(
          `INSERT INTO board_events (table_id, seq, seat_index, kind, payload)
           VALUES ($1,$2,$3,$4,$5::jsonb) ON CONFLICT (table_id, seq) DO NOTHING`,
          [id, seq, ev.seatIndex, ev.kind, JSON.stringify(ev.payload ?? {})],
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.warn("[board] saveTable failed:", error);
    throw error;
  } finally {
    client.release();
  }
}

export async function setTableStatus(
  id: string,
  status: string,
  extra: { winnerPid?: string | null; potUnits?: number; rakeUnits?: number; riskScore?: number; revealSeed?: string | null } = {},
): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    // $2 is both assigned and compared, so it needs the same explicit cast on
    // both sides — see the note in appendLedgerIfFunded.
    `UPDATE board_tables
        SET status = $2::varchar,
            winner_pid = COALESCE($3::varchar, winner_pid),
            pot_units  = COALESCE($4::bigint, pot_units),
            rake_units = COALESCE($5::bigint, rake_units),
            risk_score = COALESCE($6::smallint, risk_score),
            server_seed = COALESCE($7::bpchar, server_seed),
            ended_at = CASE WHEN $2::varchar IN ('done','void') THEN NOW() ELSE ended_at END
      WHERE id = $1::varchar`,
    [id, status, extra.winnerPid ?? null, extra.potUnits ?? null, extra.rakeUnits ?? null,
     extra.riskScore ?? null, extra.revealSeed ?? null],
  );
}

export async function startTableRow(
  id: string,
  combinedClientSeed: string,
  turnDeadline: number,
  potUnits: number,
): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `UPDATE board_tables
        SET status = 'running', combined_client_seed = $2, started_at = NOW(),
            turn_seat = 0, turn_deadline = $3, pot_units = $4::bigint
      WHERE id = $1 AND status = 'lobby'`,
    [id, combinedClientSeed, turnDeadline, Math.floor(potUnits)],
  );
}

// ── seats ───────────────────────────────────────────────────────────────────

export async function loadSeats(tableId: string): Promise<BoardSeatRow[]> {
  const pool = getPool();
  if (!pool) return [];
  const res = await pool.query(
    `SELECT * FROM board_seats WHERE table_id = $1 ORDER BY seat_index ASC`,
    [tableId],
  );
  return res.rows.map(mapSeat);
}

export async function loadAllSeats(tableIds: string[]): Promise<BoardSeatRow[]> {
  const pool = getPool();
  if (!pool || tableIds.length === 0) return [];
  const res = await pool.query(
    `SELECT * FROM board_seats WHERE table_id = ANY($1::varchar[]) ORDER BY table_id, seat_index ASC`,
    [tableIds],
  );
  return res.rows.map(mapSeat);
}

export async function upsertSeat(seat: {
  tableId: string;
  seatIndex: number;
  kind: "human" | "ai";
  pid: string | null;
  playerName: string;
  aiDifficulty?: string | null;
  clientSeed?: string;
  stakePaid?: boolean;
  ready?: boolean;
  connected?: boolean;
  seenAt?: number | null;
  status?: string;
  ipHash?: string | null;
  funderWallet?: string | null;
  avatar?: string | null;
}): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `INSERT INTO board_seats
       (table_id, seat_index, kind, pid, player_name, ai_difficulty, client_seed,
        stake_paid, ready, connected, seen_at, status, ip_hash, funder_wallet, avatar)
     VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,''),COALESCE($8,false),COALESCE($9,false),
             COALESCE($10,false),$11,COALESCE($12,'active'),$13,$14,$15)
     ON CONFLICT (table_id, seat_index) DO UPDATE SET
       kind = EXCLUDED.kind, pid = EXCLUDED.pid, player_name = EXCLUDED.player_name,
       ai_difficulty = EXCLUDED.ai_difficulty,
       client_seed = COALESCE(NULLIF(EXCLUDED.client_seed,''), board_seats.client_seed),
       stake_paid = EXCLUDED.stake_paid, ready = EXCLUDED.ready,
       connected = EXCLUDED.connected, seen_at = EXCLUDED.seen_at,
       status = EXCLUDED.status,
       ip_hash = COALESCE(EXCLUDED.ip_hash, board_seats.ip_hash),
       funder_wallet = COALESCE(EXCLUDED.funder_wallet, board_seats.funder_wallet),
       avatar = COALESCE(EXCLUDED.avatar, board_seats.avatar)`,
    [seat.tableId, seat.seatIndex, seat.kind, seat.pid, seat.playerName.slice(0, 16),
     seat.aiDifficulty ?? null, seat.clientSeed ?? "", seat.stakePaid ?? false,
     seat.ready ?? false, seat.connected ?? false, seat.seenAt ?? null,
     seat.status ?? "active", seat.ipHash ?? null, seat.funderWallet ?? null, seat.avatar ?? null],
  );
}

export async function deleteSeat(tableId: string, seatIndex: number): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query("DELETE FROM board_seats WHERE table_id = $1 AND seat_index = $2", [tableId, seatIndex]);
}

// ── the bank ledger ─────────────────────────────────────────────────────────

/** Which hero art a character uses, from their saved appearance. */
export async function avatarForWallet(pid: string): Promise<"boy" | "girl"> {
  const pool = getPool();
  if (!pool) return "boy";
  try {
    const res = await pool.query<{ appearance: { gender?: string } | null }>(
      "SELECT appearance FROM characters WHERE wallet_address = $1 LIMIT 1",
      [pid],
    );
    return res.rows[0]?.appearance?.gender === "female" ? "girl" : "boy";
  } catch {
    return "boy";
  }
}

/** Balance = SUM(delta) over everything that did not definitively fail. */
export async function boardBalance(pid: string, currencyId: string): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;
  try {
    const res = await pool.query<{ b: string }>(
      `SELECT COALESCE(SUM(delta), 0)::text AS b
         FROM board_ledger
        WHERE pid = $1 AND currency_id = $2 AND status <> 'failed'`,
      [pid, currencyId],
    );
    return Math.max(0, Number(res.rows[0]?.b ?? 0));
  } catch (error) {
    console.warn("[board] balance read failed:", error);
    // Fail CLOSED: a zero balance refuses a stake rather than authorising one
    // against a balance we could not read.
    return 0;
  }
}

export async function boardBalances(pid: string): Promise<Record<string, number>> {
  const pool = getPool();
  if (!pool) return {};
  try {
    const res = await pool.query<{ currency_id: string; b: string }>(
      `SELECT currency_id, COALESCE(SUM(delta), 0)::text AS b
         FROM board_ledger
        WHERE pid = $1 AND status <> 'failed'
        GROUP BY currency_id`,
      [pid],
    );
    const out: Record<string, number> = {};
    for (const row of res.rows) out[row.currency_id] = Math.max(0, Number(row.b));
    return out;
  } catch (error) {
    console.warn("[board] balances read failed:", error);
    return {};
  }
}

export interface LedgerWrite {
  pid: string;
  playerName?: string;
  currencyId: string;
  kind: string;
  delta: number;
  tableId?: string | null;
  requestId: string;
  signature?: string | null;
  status?: "settled" | "pending" | "failed";
}

/**
 * Append one ledger row. Returns the row id, or null when `requestId` was
 * already used — the idempotent "nothing happened" case.
 *
 * A null return is NOT success. Callers that are crediting a player must treat
 * it as "already done", and callers that are debiting must not proceed as if
 * they had taken the money.
 */
export async function appendLedger(entry: LedgerWrite): Promise<number | null> {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query<{ id: string }>(
    `INSERT INTO board_ledger
       (pid, player_name, currency_id, kind, delta, table_id, request_id, signature, status)
     VALUES ($1,$2,$3,$4,$5::bigint,$6,$7,$8,COALESCE($9,'settled'))
     ON CONFLICT (request_id) DO NOTHING
     RETURNING id`,
    [entry.pid, (entry.playerName ?? "").slice(0, 16), entry.currencyId, entry.kind,
     Math.floor(entry.delta), entry.tableId ?? null, entry.requestId,
     entry.signature ?? null, entry.status ?? "settled"],
  );
  const id = res.rows[0]?.id;
  return id === undefined ? null : Number(id);
}

/** Debit only if the derived balance covers it, in ONE statement so two
 *  concurrent requests cannot both pass the check. */
export async function appendLedgerIfFunded(entry: LedgerWrite): Promise<number | null> {
  const pool = getPool();
  if (!pool) return null;
  if (entry.delta >= 0) return appendLedger(entry);
  const need = -Math.floor(entry.delta);
  // Every parameter is cast explicitly. $1 and $3 appear both as inserted
  // values and inside the balance subquery's comparisons, and without the casts
  // Postgres deduces text in one place and varchar in the other, then refuses
  // the whole statement ("inconsistent types deduced for parameter $1").
  const res = await pool.query<{ id: string }>(
    `INSERT INTO board_ledger
       (pid, player_name, currency_id, kind, delta, table_id, request_id, signature, status)
     SELECT $1::varchar,$2::varchar,$3::varchar,$4::varchar,$5::bigint,$6::varchar,$7::varchar,$8::varchar,
            COALESCE($9::varchar,'settled')
      WHERE (SELECT COALESCE(SUM(delta),0) FROM board_ledger
              WHERE pid = $1::varchar AND currency_id = $3::varchar AND status <> 'failed') >= $10::bigint
     ON CONFLICT (request_id) DO NOTHING
     RETURNING id`,
    [entry.pid, (entry.playerName ?? "").slice(0, 16), entry.currencyId, entry.kind,
     Math.floor(entry.delta), entry.tableId ?? null, entry.requestId,
     entry.signature ?? null, entry.status ?? "settled", need],
  );
  const id = res.rows[0]?.id;
  return id === undefined ? null : Number(id);
}

export async function stampLedger(id: number, status: "settled" | "failed", signature?: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    "UPDATE board_ledger SET status = $2, signature = COALESCE($3, signature) WHERE id = $1",
    [id, status, signature ?? null],
  );
}

export async function isSignatureUsed(signature: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) return true; // fail CLOSED — refuse rather than risk a double credit
  try {
    const res = await pool.query("SELECT 1 FROM board_ledger WHERE signature = $1 LIMIT 1", [signature]);
    return (res.rowCount ?? 0) > 0;
  } catch (error) {
    console.warn("[board] signature check failed:", error);
    return true;
  }
}

/** Rows stuck pending for more than 5 minutes — an ops signal, never auto-resolved. */
export async function listPendingBoardCashouts(): Promise<
  { id: number; pid: string; currencyId: string; delta: number; createdAt: number }[]
> {
  const pool = getPool();
  if (!pool) return [];
  const res = await pool.query(
    `SELECT id, pid, currency_id, delta, created_at FROM board_ledger
      WHERE status = 'pending' AND created_at < NOW() - INTERVAL '5 minutes'
      ORDER BY created_at ASC LIMIT 100`,
  );
  return res.rows.map((r) => ({
    id: Number(r.id),
    pid: r.pid,
    currencyId: r.currency_id,
    delta: Number(r.delta),
    createdAt: new Date(r.created_at).getTime(),
  }));
}

/** Total owed back to players — the board's slice of treasury liability. */
export async function sumBoardLiability(currencyId: string): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;
  try {
    const res = await pool.query<{ b: string }>(
      `SELECT COALESCE(SUM(delta), 0)::text AS b FROM board_ledger
        WHERE currency_id = $1 AND status <> 'failed'`,
      [currencyId],
    );
    return Math.max(0, Number(res.rows[0]?.b ?? 0));
  } catch {
    return 0;
  }
}

// ── the gold funding transaction ────────────────────────────────────────────

export type FundResult = { ok: true; credited: number } | { ok: false; error: string };

/**
 * Move gold from a character into their board bank, atomically.
 *
 * The ledger insert and the `characters.gold` debit are ONE transaction, and
 * the debit is conditional on the row still having the gold. A replayed
 * requestId credits nothing; an underfunded character debits nothing. There is
 * no ordering of these two statements that mints gold.
 *
 * The caller (ZoneRoom) must flush its in-memory gold to the row first, and
 * apply the same decrement to its map afterwards — see handleBoardBankFund.
 */
export async function fundBoardBankFromCharacter(args: {
  pid: string;
  playerName: string;
  amount: number;
  requestId: string;
}): Promise<FundResult> {
  const pool = getPool();
  if (!pool) return { ok: false, error: "The bank is offline right now." };
  const amount = Math.floor(args.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter an amount above zero." };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ins = await client.query<{ id: string }>(
      `INSERT INTO board_ledger (pid, player_name, currency_id, kind, delta, request_id)
       VALUES ($1,$2,'gold','fund_in',$3::bigint,$4)
       ON CONFLICT (request_id) DO NOTHING
       RETURNING id`,
      [args.pid, args.playerName.slice(0, 16), amount, args.requestId],
    );
    if ((ins.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return { ok: false, error: "That transfer already went through." };
    }
    // Match on wallet identity, falling back to name for walletless rows (which
    // is how saveCharacter keys them — see db/characters.ts).
    const upd = await client.query(
      `UPDATE characters SET gold = gold - $2
        WHERE (wallet_address = $1 OR (wallet_address IS NULL AND name = $3))
          AND gold >= $2`,
      [args.pid, amount, args.playerName],
    );
    if ((upd.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return { ok: false, error: "You don't have that much gold." };
    }
    await client.query("COMMIT");
    return { ok: true, credited: amount };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.warn("[board] fund failed:", error);
    return { ok: false, error: "That didn't go through. Try again." };
  } finally {
    client.release();
  }
}

// ── invites ─────────────────────────────────────────────────────────────────

export async function addInvite(tableId: string, toPid: string, fromName: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `INSERT INTO board_invites (table_id, to_pid, from_name) VALUES ($1,$2,$3)
     ON CONFLICT (table_id, to_pid) DO NOTHING`,
    [tableId, toPid, fromName.slice(0, 16)],
  );
}

export async function listInvites(toPid: string): Promise<{ tableId: string; fromName: string }[]> {
  const pool = getPool();
  if (!pool) return [];
  const res = await pool.query(
    `SELECT i.table_id, i.from_name FROM board_invites i
       JOIN board_tables t ON t.id = i.table_id
      WHERE i.to_pid = $1 AND t.status = 'lobby'
      ORDER BY i.created_at DESC LIMIT 20`,
    [toPid],
  );
  return res.rows.map((r) => ({ tableId: r.table_id, fromName: r.from_name }));
}

export async function clearInvite(tableId: string, toPid: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query("DELETE FROM board_invites WHERE table_id = $1 AND to_pid = $2", [tableId, toPid]);
}

// ── events / fairness ───────────────────────────────────────────────────────

export async function loadEvents(
  tableId: string,
  kind?: string,
): Promise<{ seq: number; seatIndex: number | null; kind: string; payload: Record<string, unknown> }[]> {
  const pool = getPool();
  if (!pool) return [];
  const res = kind
    ? await pool.query(
        "SELECT seq, seat_index, kind, payload FROM board_events WHERE table_id = $1 AND kind = $2 ORDER BY seq ASC",
        [tableId, kind],
      )
    : await pool.query(
        "SELECT seq, seat_index, kind, payload FROM board_events WHERE table_id = $1 ORDER BY seq ASC",
        [tableId],
      );
  return res.rows.map((r) => ({
    seq: Number(r.seq),
    seatIndex: r.seat_index === null ? null : Number(r.seat_index),
    kind: r.kind,
    payload: r.payload ?? {},
  }));
}

/** Money tables in flight — the pre-deploy check surfaced in Mission Center. */
export async function countLiveMoneyTables(): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;
  try {
    const res = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM board_tables
        WHERE status IN ('lobby','running','paused','settling') AND currency_id <> 'gold'`,
    );
    return Number(res.rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}
