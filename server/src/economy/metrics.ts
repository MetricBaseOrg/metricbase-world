import { getPool } from "../db/pool.js";

// Lifetime + per-day counters for in-game economy activity (gathered, crafted,
// sold, gold minted/burned, market volume, …). Increments accumulate in memory
// and flush to the DB periodically to avoid a write per gameplay event.

const totals = new Map<string, number>();
const unflushedTotals = new Map<string, number>();
// day (YYYY-MM-DD) -> metric -> unflushed delta
const unflushedDaily = new Map<string, Map<string, number>>();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function initMetrics(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    const res = await pool.query<{ metric: string; value: string }>("SELECT metric, value FROM economy_metrics");
    for (const r of res.rows) totals.set(r.metric, Number(r.value));
  } catch (error) {
    console.warn("[metrics] init failed:", error);
  }
  setInterval(() => void flush(), 15_000);
}

/** Increment a metric's lifetime + today's counters (accumulated, flushed later). */
export function bumpMetric(metric: string, amount = 1): void {
  if (!amount) return;
  totals.set(metric, (totals.get(metric) ?? 0) + amount);
  unflushedTotals.set(metric, (unflushedTotals.get(metric) ?? 0) + amount);
  const day = today();
  let d = unflushedDaily.get(day);
  if (!d) unflushedDaily.set(day, (d = new Map()));
  d.set(metric, (d.get(metric) ?? 0) + amount);
}

/** Record gold entering circulation (minted) or leaving it (burned/sink). */
export function mintGold(amount: number): void {
  bumpMetric("gold.minted", amount);
}
export function burnGold(amount: number): void {
  bumpMetric("gold.burned", amount);
}

async function flush(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  if (!unflushedTotals.size && !unflushedDaily.size) return;
  const totalEntries = [...unflushedTotals];
  const dailyEntries: [string, string, number][] = [];
  for (const [day, mm] of unflushedDaily) for (const [m, v] of mm) dailyEntries.push([day, m, v]);
  unflushedTotals.clear();
  unflushedDaily.clear();
  try {
    for (const [metric, value] of totalEntries) {
      await pool.query(
        `INSERT INTO economy_metrics (metric, value) VALUES ($1,$2)
         ON CONFLICT (metric) DO UPDATE SET value = economy_metrics.value + EXCLUDED.value`,
        [metric, value],
      );
    }
    for (const [day, metric, value] of dailyEntries) {
      await pool.query(
        `INSERT INTO economy_daily (day, metric, value) VALUES ($1,$2,$3)
         ON CONFLICT (day, metric) DO UPDATE SET value = economy_daily.value + EXCLUDED.value`,
        [day, metric, value],
      );
    }
  } catch (error) {
    console.warn("[metrics] flush failed:", error);
  }
}

export function getMetricTotals(): Record<string, number> {
  return Object.fromEntries(totals);
}

/** Per-day series for the given metrics over the last `days` days (incl. today). */
export async function getDailySeries(days = 14): Promise<{ day: string; metric: string; value: number }[]> {
  const pool = getPool();
  const rows: { day: string; metric: string; value: number }[] = [];
  if (pool) {
    try {
      const res = await pool.query<{ day: Date; metric: string; value: string }>(
        `SELECT day, metric, value FROM economy_daily WHERE day >= (CURRENT_DATE - $1::int) ORDER BY day`,
        [days - 1],
      );
      for (const r of res.rows) {
        const day = r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10);
        rows.push({ day, metric: r.metric, value: Number(r.value) });
      }
    } catch {
      /* table may be empty */
    }
  }
  // Fold in today's unflushed deltas so the chart is live.
  const day = today();
  const d = unflushedDaily.get(day);
  if (d) {
    for (const [metric, value] of d) {
      const existing = rows.find((x) => x.day === day && x.metric === metric);
      if (existing) existing.value += value;
      else rows.push({ day, metric, value });
    }
  }
  return rows;
}
