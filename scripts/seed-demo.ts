import { loadApprovedContent } from "../lib/evidence/content.ts";
import { buildDemoFixture, seedDemo } from "../lib/evidence/demo.ts";
import { getPool } from "../lib/db.ts";
import { provisionDemoAccounts } from "./provision-demo.ts";

let pool: ReturnType<typeof getPool> | undefined;
try {
  pool = getPool();
  const fixture = buildDemoFixture(loadApprovedContent());
  const result = await seedDemo(fixture, await provisionDemoAccounts());
  console.log(
    `Fictional accounts and synthetic fixture ready: ${result.sessions} sessions, ${result.attempts} responses, ${result.evaluations} evaluations and ${result.interventions} displayed interventions.`,
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Synthetic seeding failed.",
  );
  process.exitCode = 1;
} finally {
  await pool?.end();
}
