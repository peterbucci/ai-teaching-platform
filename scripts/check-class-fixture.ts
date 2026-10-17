import assert from "node:assert/strict";
import { z } from "zod";
import { getPool } from "../lib/db.ts";
import { buildClassFixture } from "../lib/evidence/class-fixture.ts";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { DEMO_IDS, seedDemo } from "../lib/evidence/demo.ts";
import { validateSessionEvidence } from "../lib/evidence/rules.ts";

// Operator-only development check. Never resets data or invokes an AI provider.
const pool = getPool();
const base = process.env.CHECK_BASE_URL ?? process.env.AUTH_URL;
if (!base) throw new Error("Set AUTH_URL in ignored configuration");
async function login(prefix: string) {
  const response = await fetch(new URL("/api/auth/sign-in/email", base), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: new URL(base!).origin,
    },
    body: JSON.stringify({
      email: process.env[`${prefix}_EMAIL`],
      password: process.env[`${prefix}_PASSWORD`],
    }),
  });
  assert.equal(
    response.status,
    200,
    `${prefix} sign-in failed (check authentication cooldown)`,
  );
  return response.headers
    .getSetCookie()
    .map((c) => c.split(";", 1)[0])
    .join("; ");
}
async function snapshot() {
  // Fixed operator query includes live records, proving seed operations preserve them too.
  const result = await pool.query(`select jsonb_build_object(
    'profiles',(select jsonb_agg(to_jsonb(t) order by id) from profiles t),
    'enrollments',(select jsonb_agg(to_jsonb(t) order by class_id,student_id) from enrollments t),
    'sessions',(select jsonb_agg(to_jsonb(t) order by id) from sessions t),
    'attempts',(select jsonb_agg(to_jsonb(t) order by id) from attempts t),
    'evaluations',(select jsonb_agg(to_jsonb(t) order by id) from evaluations t),
    'interventions',(select jsonb_agg(to_jsonb(t) order by id) from interventions t)) as evidence`);
  return result.rows[0].evidence as unknown;
}
try {
  const content = loadApprovedContent();
  const fixture = buildClassFixture(content);
  const rows = await pool.query(
    "select id,auth_user_id from profiles where id=any($1::uuid[])",
    [[DEMO_IDS.teacher, DEMO_IDS.studentOne, DEMO_IDS.studentTwo]],
  );
  const ids = z
    .array(z.object({ id: z.uuid(), auth_user_id: z.string() }))
    .parse(rows.rows);
  const authId = (id: string) => {
    const match = ids.find((r) => r.id === id);
    if (!match) throw new Error("Run db:seed first");
    return match.auth_user_id;
  };
  const auth = {
    teacher: authId(DEMO_IDS.teacher),
    studentOne: authId(DEMO_IDS.studentOne),
    studentTwo: authId(DEMO_IDS.studentTwo),
  };
  const before = z
    .record(z.string(), z.array(z.record(z.string(), z.unknown())).nullable())
    .parse(await snapshot());
  await seedDemo(fixture, auth);
  const once = z
    .record(z.string(), z.array(z.record(z.string(), z.unknown())).nullable())
    .parse(await snapshot());
  // Every pre-existing row is still byte-equivalent after the expansion.
  for (const [table, records] of Object.entries(before))
    for (const record of records ?? []) {
      const stored = once[table]?.find((r) =>
        table === "enrollments"
          ? r.student_id === record.student_id && r.class_id === record.class_id
          : r.id === record.id,
      );
      assert.deepEqual(stored, record, `Changed existing ${table} record`);
    }
  await seedDemo(fixture, auth);
  assert.deepEqual(await snapshot(), once, "Second seed changed evidence");
  const bad = structuredClone(fixture);
  bad.sessions[0].attempts[0].response_text = "Conflicting invented response";
  await assert.rejects(seedDemo(bad, auth), /Conflicting attempt history/);
  assert.deepEqual(
    await snapshot(),
    once,
    "Conflicting seed did not roll back",
  );
  const teacher = await login("DEMO_TEACHER");
  const student = await login("DEMO_STUDENT_ONE");
  for (const expected of fixture.sessions) {
    const path = `/api/teacher/sessions/${expected.session.id}`;
    const response: Response = await fetch(new URL(path, base), {
      headers: { Cookie: teacher },
    });
    assert.equal(response.status, 200);
    const evidence = validateSessionEvidence(content, await response.json());
    assert.equal(evidence.session.data_origin, "synthetic_fixture");
    assert.deepEqual(
      evidence.attempts.map((a) => [
        a.id,
        a.response_text,
        a.current_evaluation_id,
        a.assistance,
      ]),
      expected.attempts.map((a) => [
        a.id,
        a.response_text,
        a.current_evaluation_id,
        a.assistance,
      ]),
    );
    assert.deepEqual(
      evidence.evaluations.map((e) => [
        e.id,
        e.result,
        e.applied_result,
        e.validation_status,
      ]),
      expected.evaluations.map((e) => [
        e.id,
        e.result,
        e.applied_result,
        e.validation_status,
      ]),
    );
    assert.ok(
      [403, 404].includes(
        (await fetch(new URL(path, base), { headers: { Cookie: student } }))
          .status,
      ),
    );
  }
  for (const cookie of [teacher, student])
    await fetch(new URL("/api/auth/sign-out", base), {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: new URL(base).origin,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
  console.log(
    JSON.stringify({
      status: "passed",
      students: fixture.enrollments.length,
      syntheticSessions: fixture.sessions.length,
      checks: [
        "seed twice unchanged",
        "existing live evidence preserved",
        "conflict rolled back",
        "teacher reconstructed every fixture",
        "student denied private teacher evidence",
      ],
      paidRequests: 0,
    }),
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Class fixture check failed",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
