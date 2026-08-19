// The public trading ledger. See schema.sql `x_trades` for the design rules.
//
// The whole value of this table is that it is honest: every call recorded, every
// close posted, R computed the same way every time. So the discipline lives in
// code — currency is unrepresentable, R is derived not stored, and $BASE is
// refused (that check is at the API layer, closest to the request).

import { getPool } from "./pool.js";

export type TradeDirection = "long" | "short";
export type TradeStatus = "open" | "closed" | "scratched";
export type TradeKind = "call" | "postmortem";

export const TRADE_DIRECTIONS: TradeDirection[] = ["long", "short"];
export const TRADE_STATUSES: TradeStatus[] = ["open", "closed", "scratched"];
export const TRADE_KINDS: TradeKind[] = ["call", "postmortem"];

export interface XTrade {
  id: number;
  openedAt: string; // YYYY-MM-DD
  closedAt: string | null;
  instrument: string;
  direction: TradeDirection;
  entry: number;
  stop: number | null;
  exit: number | null;
  thesis: string;
  invalidation: string;
  status: TradeStatus;
  kind: TradeKind;
  postId: number | null;
  note: string;
  /** Derived, never stored. R = reward taken ÷ risk taken. null when it can't
   *  be computed (no exit yet, or no stop to measure risk against). */
  r: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface XTradeInput {
  openedAt?: string;
  closedAt?: string | null;
  instrument?: string;
  direction?: TradeDirection;
  entry?: number;
  stop?: number | null;
  exit?: number | null;
  thesis?: string;
  invalidation?: string;
  status?: TradeStatus;
  kind?: TradeKind;
  postId?: number | null;
  note?: string;
}

/**
 * R-multiple: how many units of risk the result returned.
 *
 *   risk   = |entry − stop|          (the 1R you put up)
 *   reward = exit − entry            for a long
 *          = entry − exit            for a short
 *   R      = reward ÷ risk
 *
 * A long stopped out (exit = stop) returns exactly −1R, which is the sanity
 * check in the plan. Returns null when there's no exit or no stop distance.
 */
export function computeR(t: {
  direction: string;
  entry: number | null;
  stop: number | null;
  exit: number | null;
}): number | null {
  if (t.entry == null || t.stop == null || t.exit == null) return null;
  const risk = Math.abs(t.entry - t.stop);
  if (risk === 0) return null;
  const reward = t.direction === "short" ? t.entry - t.exit : t.exit - t.entry;
  return reward / risk;
}

function toDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

function mapTrade(r: Record<string, unknown>): XTrade {
  const entry = r.entry == null ? 0 : Number(r.entry);
  const stop = r.stop == null ? null : Number(r.stop);
  const exit = r.exit == null ? null : Number(r.exit);
  const direction = ((r.direction as string) ?? "long") as TradeDirection;
  return {
    id: Number(r.id),
    openedAt: toDate(r.opened_at) ?? "",
    closedAt: toDate(r.closed_at),
    instrument: (r.instrument as string) ?? "",
    direction,
    entry,
    stop,
    exit,
    thesis: (r.thesis as string) ?? "",
    invalidation: (r.invalidation as string) ?? "",
    status: ((r.status as string) ?? "open") as TradeStatus,
    kind: ((r.kind as string) ?? "call") as TradeKind,
    postId: r.post_id == null ? null : Number(r.post_id),
    note: (r.note as string) ?? "",
    r: computeR({ direction, entry, stop, exit }),
    createdAt: new Date(r.created_at as string).getTime(),
    updatedAt: new Date(r.updated_at as string).getTime(),
  };
}

const TRADE_COLUMNS =
  "id, opened_at, closed_at, instrument, direction, entry, stop, exit, thesis, invalidation, status, kind, post_id, note, created_at, updated_at";

export async function listTrades(): Promise<XTrade[]> {
  const pool = getPool();
  if (!pool) return [];
  const res = await pool.query(
    `SELECT ${TRADE_COLUMNS} FROM x_trades ORDER BY opened_at DESC, id DESC`,
  );
  return res.rows.map(mapTrade);
}

export async function getTrade(id: number): Promise<XTrade | null> {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query(`SELECT ${TRADE_COLUMNS} FROM x_trades WHERE id = $1`, [id]);
  return res.rows[0] ? mapTrade(res.rows[0]) : null;
}

export async function createTrade(input: XTradeInput): Promise<XTrade> {
  const pool = getPool();
  if (!pool) throw new Error("Database is not configured.");
  const res = await pool.query(
    `INSERT INTO x_trades
       (opened_at, closed_at, instrument, direction, entry, stop, exit, thesis, invalidation, status, kind, post_id, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [
      input.openedAt ?? new Date().toISOString().slice(0, 10),
      input.closedAt ?? null,
      input.instrument ?? "",
      input.direction ?? "long",
      input.entry ?? 0,
      input.stop ?? null,
      input.exit ?? null,
      input.thesis ?? "",
      input.invalidation ?? "",
      input.status ?? "open",
      input.kind ?? "call",
      input.postId ?? null,
      input.note ?? "",
    ],
  );
  const created = await getTrade(Number(res.rows[0].id));
  if (!created) throw new Error("Trade vanished after insert.");
  return created;
}

/** Partial update — only keys present in `input` are written. */
export async function updateTrade(id: number, input: XTradeInput): Promise<XTrade | null> {
  const pool = getPool();
  if (!pool) throw new Error("Database is not configured.");
  const columns: Record<keyof XTradeInput, string> = {
    openedAt: "opened_at",
    closedAt: "closed_at",
    instrument: "instrument",
    direction: "direction",
    entry: "entry",
    stop: "stop",
    exit: "exit",
    thesis: "thesis",
    invalidation: "invalidation",
    status: "status",
    kind: "kind",
    postId: "post_id",
    note: "note",
  };
  const sets: string[] = [];
  const values: unknown[] = [id];
  for (const [key, column] of Object.entries(columns) as [keyof XTradeInput, string][]) {
    if (!(key in input)) continue;
    values.push(input[key] ?? null);
    sets.push(`${column} = $${values.length}`);
  }
  if (!sets.length) return getTrade(id);
  sets.push("updated_at = NOW()");
  const res = await pool.query(
    `UPDATE x_trades SET ${sets.join(", ")} WHERE id = $1 RETURNING id`,
    values,
  );
  if (!res.rows[0]) return null;
  return getTrade(id);
}

export async function deleteTrade(id: number): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query("DELETE FROM x_trades WHERE id = $1", [id]);
}

export interface TradeStats {
  opened: number;
  closed: number;
  open: number;
  scratched: number;
  /** closed ÷ (opened calls) — the headline accountability number. Postmortems
   *  and scratches are excluded from both sides; only real calls count. 1 when
   *  there are no open calls. */
  closeRatio: number;
  openCalls: number;
  wins: number;
  losses: number;
  winRate: number | null;
  avgR: number | null;
  totalR: number | null;
}

/** Aggregate the ledger for the summary tiles. "Calls" = kind 'call'; a
 *  post-mortem is a write-up, not an open obligation, so it never counts against
 *  the close ratio. */
export async function tradeStats(): Promise<TradeStats> {
  const trades = (await listTrades()).filter((t) => t.kind === "call");
  const closed = trades.filter((t) => t.status === "closed");
  const open = trades.filter((t) => t.status === "open");
  const scratched = trades.filter((t) => t.status === "scratched");
  const rs = closed.map((t) => t.r).filter((r): r is number => r != null);
  const wins = rs.filter((r) => r > 0).length;
  const losses = rs.filter((r) => r <= 0).length;
  const totalR = rs.length ? rs.reduce((a, r) => a + r, 0) : null;
  // opened-calls basis excludes scratches: a scratch was never a live call.
  const openedCalls = closed.length + open.length;
  return {
    opened: openedCalls,
    closed: closed.length,
    open: open.length,
    scratched: scratched.length,
    closeRatio: openedCalls ? closed.length / openedCalls : 1,
    openCalls: open.length,
    wins,
    losses,
    winRate: rs.length ? wins / rs.length : null,
    avgR: totalR == null ? null : totalR / rs.length,
    totalR,
  };
}
