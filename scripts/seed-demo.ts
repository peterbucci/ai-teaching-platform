import { loadApprovedContent } from "../lib/evidence/content.ts";
import { buildDemoFixture, seedDemo } from "../lib/evidence/demo.ts";
import { createAdminClient } from "../lib/supabase/admin.ts";

try {
  const fixture = buildDemoFixture(loadApprovedContent());
  const result = await seedDemo(createAdminClient(), fixture, {
    teacher: process.env.DEMO_TEACHER_AUTH_ID?.trim() || undefined,
    studentOne: process.env.DEMO_STUDENT_ONE_AUTH_ID?.trim() || undefined,
    studentTwo: process.env.DEMO_STUDENT_TWO_AUTH_ID?.trim() || undefined,
  });
  console.log(
    `Synthetic fixture verified: ${result.sessions} sessions, ${result.attempts} responses, ${result.evaluations} evaluations and ${result.interventions} displayed interventions. No Auth accounts were created.`,
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Synthetic seeding failed.",
  );
  process.exitCode = 1;
}
