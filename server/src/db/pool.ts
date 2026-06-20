import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function isDatabaseEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool(): pg.Pool | null {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!pool) {
    const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL);
    pool = new Pool({
      connectionString,
      ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
    });
  }

  return pool;
}

function normalizeDatabaseUrl(connectionString: string): string {
  const url = new URL(connectionString);
  url.searchParams.delete("channel_binding");
  if (url.hostname.includes("neon.tech") && !url.searchParams.has("uselibpqcompat")) {
    url.searchParams.set("uselibpqcompat", "true");
    url.searchParams.set("sslmode", "require");
  }
  return url.toString();
}

function needsSsl(connectionString?: string): boolean {
  if (!connectionString) return false;
  return (
    connectionString.includes("neon.tech") ||
    connectionString.includes("sslmode=require") ||
    connectionString.includes("supabase.co")
  );
}

export async function initDatabase(): Promise<boolean> {
  const db = getPool();
  if (!db) {
    console.log("Database disabled (DATABASE_URL not set). Characters won't persist.");
    return false;
  }

  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "schema.sql");
  const schema = await readFile(schemaPath, "utf8");
  await db.query(schema);
  console.log("Database ready.");
  return true;
}