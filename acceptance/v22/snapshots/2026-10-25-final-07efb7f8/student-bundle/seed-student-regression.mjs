/** Verification fixture only. Adapted from prior seed-student-result.mjs
 * SHA256 027d415c4a2053cb50de521d81e97f4a13d3bc7e8fcae3fd78156d3dfd1e50c5.
 * Every run creates new fictional accounts; no existing student session is reused.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
assert.equal(process.env.ACCEPTANCE_PROJECT, "lp-v22-final-01a173d6");
assert.equal(process.env.AUTH_URL, "http://localhost:3396");
assert.equal(process.env.PGHOST, "db");
assert.equal(process.env.PGDATABASE, "learning_platform");
assert.equal(
  process.env.ACCEPTANCE_SOURCE_SHA,
  "07efb7f821339538800f150f57b298eb2e606be3",
);
assert.equal(
  process.env.ACCEPTANCE_SOURCE_TREE,
  "948b9a6005a056c97f10d181c589b5352d6221f3",
);
if (process.env.ACCEPTANCE_FIXTURE_OUTPUT) {
  assert.match(
    process.env.ACCEPTANCE_FIXTURE_OUTPUT,
    /^\/tmp\/acceptance-[a-zA-Z0-9-]+\.json$/,
  );
  assert.equal(
    existsSync(process.env.ACCEPTANCE_FIXTURE_OUTPUT),
    false,
    "Choose a fresh fixture output path; no existing evidence is overwritten.",
  );
}
for (const key of ["OPENAI_API_KEY", "OPENAI_MODEL"])
  assert.equal(process.env[key]?.trim() || "", "");
const { getPool } = await import("/app/lib/db.ts");
const { evidenceAccess, submitAnswer, recordEvaluation, readSession } =
  await import("/app/lib/evidence/store.ts");
const { startTutoring, applyTutoring } =
  await import("/app/lib/tutoring/store.ts");
const { loadApprovedContent } = await import("/app/lib/evidence/content.ts");
const { buildDemoFixture, DEMO_IDS } =
  await import("/app/lib/evidence/demo.ts");
const pool = getPool();
const runId = randomUUID();
try {
  const credential = await pool.query(
    `SELECT a.password FROM auth_account a JOIN profiles p ON p.auth_user_id=a."userId" WHERE p.id=$1 AND a."providerId"='credential'`,
    [DEMO_IDS.studentTwo],
  );
  assert.equal(credential.rowCount, 1);
  assert.ok(credential.rows[0].password);
  const assignment = await pool.query(
    "SELECT class_id,teacher_approved_at FROM assignments WHERE id=$1",
    [DEMO_IDS.assignmentId],
  );
  assert.ok(
    assignment.rows[0]?.teacher_approved_at,
    "Explicitly activate the fictional curated assignment before this fixture.",
  );
  const template = buildDemoFixture(loadApprovedContent()).sessions.find(
    (item) => item.session.id === DEMO_IDS.correctSession,
  );
  assert.ok(template?.evaluations[0].result);
  const fixtures = {};
  for (const kind of ["accepted", "long", "recovery"]) {
    const profileId = randomUUID();
    const userId = `acceptance-regression-${profileId}`;
    const email = `${userId}@example.invalid`;
    await pool.query("INSERT INTO auth_user(id,name,email) VALUES($1,$2,$3)", [
      userId,
      `Fictional acceptance ${kind}`,
      email,
    ]);
    await pool.query(
      `INSERT INTO auth_account(id,"accountId","providerId","userId",password) VALUES($1,$2,'credential',$2,$3)`,
      [randomUUID(), userId, credential.rows[0].password],
    );
    await pool.query(
      "INSERT INTO profiles(id,auth_user_id,display_name) VALUES($1,$2,$3)",
      [profileId, userId, `Fictional acceptance ${kind}`],
    );
    await pool.query(
      "INSERT INTO enrollments(class_id,student_id) VALUES($1,$2)",
      [assignment.rows[0].class_id, profileId],
    );
    const access = evidenceAccess({ profileId, userId });
    const view = await startTutoring(access, DEMO_IDS.assignmentId);
    assert.equal(view.attempts.length, 1);
    const attempt = view.attempts[0];
    assert.equal(attempt.response_text, null);
    let accepted = null;
    let responseText = null;
    if (kind !== "recovery") {
      responseText = template.attempts[0].response_text;
      if (kind === "long")
        responseText +=
          "\n\n" +
          Array.from(
            { length: 24 },
            (_, index) =>
              `Fictional long-response paragraph ${index + 1}. I am keeping the two intervals separate: the transmitter puts the packet's bits onto the link, and those bits then travel along the physical medium. Packet length and transmission rate describe the first interval. Cable length and propagation speed describe the second. This repeated authored text exercises long-response navigation; it is not an additional independent assessment.`,
          ).join("\n\n");
      assert.ok(responseText.length < 16000);
      await submitAnswer(access, view.session.id, {
        attempt_id: attempt.id,
        submission_key: randomUUID(),
        response_text: responseText,
      });
      const result = structuredClone(template.evaluations[0].result);
      result.evidence_quotes = result.evidence_quotes.map((quote) => ({
        ...quote,
        response_id: attempt.id,
      }));
      result.misconception_candidates = [];
      result.reasoning_observed =
        "Explicit synthetic regression fixture. Exercises stored feedback visibility, not model quality.";
      accepted = await recordEvaluation(access, view.session.id, {
        id: randomUUID(),
        attempt_id: attempt.id,
        validation_status: "accepted",
        evaluator: {
          type: "synthetic_fixture",
          model: null,
          version: "independent-browser-regression-v2",
        },
        supersedes_id: null,
        result,
        applied_result: null,
        failure_reason: null,
      });
      await applyTutoring(access, view.session.id, accepted.id);
    }
    const saved = await readSession(access, view.session.id, "student");
    assert.equal(
      saved.session.status,
      kind === "recovery" ? "active" : "completed",
    );
    assert.equal(saved.attempts[0].response_text, responseText);
    if (accepted)
      assert.equal(saved.evaluations[0].evaluator.type, "synthetic_fixture");
    fixtures[kind] = {
      email,
      student_id: profileId,
      session_id: saved.session.id,
      attempt_id: attempt.id,
      evaluation_id: accepted?.id ?? null,
      response_text: responseText,
      status: saved.session.status,
      correctness: accepted?.result?.per_concept_results ?? [],
      url: `/study/assignments/${DEMO_IDS.assignmentId}?tab=study&session=${saved.session.id}`,
    };
  }
  const report = {
    project: process.env.ACCEPTANCE_PROJECT,
    source_sha: process.env.ACCEPTANCE_SOURCE_SHA,
    source_tree: process.env.ACCEPTANCE_SOURCE_TREE,
    harness_sha256: createHash("sha256")
      .update(readFileSync(new URL(import.meta.url)))
      .digest("hex"),
    run_id: runId,
    fictional_only: true,
    actual_model_calls: 0,
    password_environment_key: "DEMO_STUDENT_TWO_PASSWORD",
    assignment_id: DEMO_IDS.assignmentId,
    provenance:
      "Three newly created fictional students and fresh ordinary tutoring-service sessions; accepted evaluations explicitly synthetic_fixture. Existing demo accounts and sessions untouched. Long case is one long original response, not a fabricated multi-turn model conversation.",
    fixtures,
  };
  if (process.env.ACCEPTANCE_FIXTURE_OUTPUT) {
    assert.match(
      process.env.ACCEPTANCE_FIXTURE_OUTPUT,
      /^\/tmp\/acceptance-[a-zA-Z0-9-]+\.json$/,
    );
    writeFileSync(
      process.env.ACCEPTANCE_FIXTURE_OUTPUT,
      JSON.stringify(report, null, 2),
      { flag: "wx" },
    );
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await pool.end();
}
