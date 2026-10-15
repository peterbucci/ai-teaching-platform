import "server-only";
import pg from "pg";
import type { PoolClient } from "pg";
import { z } from "zod";

const configSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().positive().max(65535),
  user: z.string().min(1),
  database: z.string().min(1),
  password: z.string().min(1),
});

export class DatabaseConfigurationError extends Error {
  constructor() {
    super("The local database is not configured.");
    this.name = "DatabaseConfigurationError";
  }
}

let pool: pg.Pool | undefined;

/** One server-only pool, shared by the application and authentication library. */
export function getPool(): pg.Pool {
  if (pool) return pool;
  const config = configSchema.safeParse({
    host: process.env.PGHOST || "127.0.0.1",
    port: process.env.PGPORT || "5432",
    user: process.env.PGUSER || "learning_app",
    database: process.env.PGDATABASE || "learning_platform",
    password: process.env.PGPASSWORD,
  });
  if (!config.success) throw new DatabaseConfigurationError();
  pool = new pg.Pool({
    ...config.data,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
  // An idle socket failure must not crash the process or log credentials.
  pool.on("error", () => console.error("An idle database connection failed."));
  return pool;
}

export async function inTransaction<T>(
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Evidence JSON contracts use ISO strings; Better Auth uses normal pg Date values.
// Normalize only rows crossing the evidence boundary, without changing global pg parsers.
export function evidenceRow(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(evidenceRow);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, evidenceRow(item)]),
    );
  }
  return value;
}
