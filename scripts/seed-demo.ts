import { loadApprovedContent } from "../lib/evidence/content.ts";
import { buildDemoFixture, seedDemo } from "../lib/evidence/demo.ts";
import { buildClassFixture } from "../lib/evidence/class-fixture.ts";
import { getPool } from "../lib/db.ts";
import { provisionDemoAccounts } from "./provision-demo.ts";

let pool: ReturnType<typeof getPool> | undefined;
try {
  pool = getPool();
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--class"))
    throw new Error("Usage: npm run db:seed -- [--class]");
  const fixture = args.includes("--class")
    ? buildClassFixture(loadApprovedContent())
    : buildDemoFixture(loadApprovedContent());
  const result = await seedDemo(fixture, await provisionDemoAccounts());
  console.log(
    `Fictional accounts and synthetic fixture ready: ${fixture.enrollments.length} students, ${result.sessions} sessions, ${result.attempts} responses, ${result.evaluations} evaluations and ${result.interventions} displayed interventions. Invented histories, not measured outcomes.`,
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Synthetic seeding failed.",
  );
  process.exitCode = 1;
} finally {
  await pool?.end();
}
