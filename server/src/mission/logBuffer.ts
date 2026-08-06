// In-process log capture for Mission Center. Patches console so every existing
// `console.log("[bans] ...")` in the codebase becomes queryable without touching
// a single call site.
//
// This is the log source that ALWAYS works — locally, before the Railway token
// exists, and when the Railway API is down. The Railway tail in railway.ts is
// richer (it survives restarts) but optional; this one is the floor.

export type LogLevel = "log" | "warn" | "error";

export interface LogLine {
  at: number;
  level: LogLevel;
  message: string;
}

const CAPACITY = 2000;
const MAX_LINE = 4000;

const ring: LogLine[] = [];
let installed = false;

function push(level: LogLevel, args: unknown[]): void {
  let message: string;
  try {
    message = args
      .map((a) => {
        if (typeof a === "string") return a;
        if (a instanceof Error) return `${a.name}: ${a.message}`;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(" ");
  } catch {
    message = "<unserializable log line>";
  }
  if (message.length > MAX_LINE) message = `${message.slice(0, MAX_LINE)}… (truncated)`;
  ring.push({ at: Date.now(), level, message });
  if (ring.length > CAPACITY) ring.splice(0, ring.length - CAPACITY);
}

/** Call once, as early in boot as possible. Idempotent. */
export function installLogCapture(): void {
  if (installed) return;
  installed = true;
  for (const level of ["log", "warn", "error"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      push(level, args);
      original(...args);
    };
  }
}

export interface LogQuery {
  level?: LogLevel | "all";
  search?: string;
  limit?: number;
}

export function readLogs({ level = "all", search = "", limit = 300 }: LogQuery = {}): LogLine[] {
  const needle = search.trim().toLowerCase();
  const out: LogLine[] = [];
  // Walk backwards so `limit` keeps the NEWEST matches, not the oldest.
  for (let i = ring.length - 1; i >= 0 && out.length < limit; i -= 1) {
    const line = ring[i];
    if (level !== "all" && line.level !== level) continue;
    if (needle && !line.message.toLowerCase().includes(needle)) continue;
    out.push(line);
  }
  return out.reverse();
}

/** Error count in the trailing window — feeds the Ops health strip. */
export function countErrorsSince(sinceMs: number): number {
  const cutoff = Date.now() - sinceMs;
  let n = 0;
  for (let i = ring.length - 1; i >= 0; i -= 1) {
    if (ring[i].at < cutoff) break;
    if (ring[i].level === "error") n += 1;
  }
  return n;
}
