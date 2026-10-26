import { loadApprovedContent } from "../lib/evidence/content.ts";
import { buildShowcaseFixture } from "../lib/evidence/showcase-fixture.ts";
import { seedDemo } from "../lib/evidence/demo.ts";
import { getPool } from "../lib/db.ts";
import { provisionDemoAccounts } from "./provision-demo.ts";

// Run only against a NEW, isolated, private showcase Compose database.
// No truncates/deletes; standard seeder rejects conflicting existing records.
const pool = getPool();
try {
  if (process.env.LEARNING_PULSE_SHOWCASE !== "1") {
    throw new Error(
      "Set LEARNING_PULSE_SHOWCASE=1 in your local, ignored showcase env file",
    );
  }
  const check = await pool.query<{ name: string }>(
    "SELECT current_database() AS name",
  );
  if (check.rows[0]?.name !== "learning_pulse_showcase") {
    throw new Error(
      "Refusing showcase seed: expected isolated learning_pulse_showcase database",
    );
  }
  const fixture = buildShowcaseFixture(loadApprovedContent());
  const accountIds = await provisionDemoAccounts({
    teacher: fixture.profiles[0].display_name,
    studentOne: fixture.profiles[1].display_name,
    studentTwo: fixture.profiles[2].display_name,
  });
  const result = await seedDemo(fixture, accountIds);
  console.log(
    JSON.stringify(
      {
        showcase: true,
        fictional_students: fixture.enrollments.length,
        sessions: result.sessions,
        answers: result.attempts,
        evaluations: result.evaluations,
        displayed_interventions: result.interventions,
        provenance:
          "fictional sample histories; not real student work or live model judgments",
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Showcase seed failed",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
