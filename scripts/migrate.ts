import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getPool } from "../lib/db.ts";

const pool = getPool();

try {
  const directory = resolve(process.cwd(), "database/migrations");
  const files = (await readdir(directory))
    .filter((file) => /^\d+_[a-z0-9_]+\.sql$/.test(file))
    .sort();
  if (files.length === 0) throw new Error("No database migrations found.");

  const client = await pool.connect();
  try {
    await client.query("begin");
    // Startup processes may overlap. Hold one connection/transaction while
    // checking and applying migrations so only one process can initialize.
    await client.query(
      "select pg_advisory_xact_lock(hashtext('ai-teaching-platform-migrations'))",
    );
    await client.query(`
      create table if not exists public.schema_migrations (
        name text primary key,
        sha256 text not null,
        applied_at timestamptz not null default clock_timestamp()
      )
    `);

    let applied = 0;
    for (const file of files) {
      const sql = (await readFile(resolve(directory, file), "utf8")).replace(
        /\r\n/g,
        "\n",
      );
      const sha256 = createHash("sha256").update(sql).digest("hex");
      const existing = await client.query<{ sha256: unknown }>(
        "select sha256 from public.schema_migrations where name = $1",
        [file],
      );
      if (existing.rows.length > 0) {
        if (existing.rows[0].sha256 !== sha256) {
          throw new Error(
            `Applied migration ${file} changed. Add a new migration instead.`,
          );
        }
        continue;
      }
      await client.query(sql);
      await client.query(
        "insert into public.schema_migrations (name, sha256) values ($1, $2)",
        [file, sha256],
      );
      applied += 1;
    }
    await client.query("commit");
    console.log(
      `Database migrations ready: ${applied} applied, ${files.length} total.`,
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Database migration failed.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
