/** Dedicated acceptance fixture, never an application route. No model transport is invoked. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
assert.match(
  process.env.ACCEPTANCE_PROJECT || "",
  /^lp-accept-recovery-01a1714f$/,
);
assert.ok(
  !process.env.OPENAI_API_KEY?.trim(),
  "Provider credentials must be disabled.",
);
const { getPool } = await import("/app/lib/db.ts");
const { evidenceAccess, submitAnswer, recordEvaluation, readSession } =
  await import("/app/lib/evidence/store.ts");
const { startTutoring, applyTutoring } =
  await import("/app/lib/tutoring/store.ts");
const { loadApprovedContent } = await import("/app/lib/evidence/content.ts");
const { buildDemoFixture, DEMO_IDS } =
  await import("/app/lib/evidence/demo.ts");
const pool = getPool();
try {
  const existing = await pool.query(
    "SELECT id FROM sessions WHERE student_id=$1 AND assignment_id=$2 AND data_origin='live_demo'",
    [DEMO_IDS.studentTwo, DEMO_IDS.assignmentId],
  );
  assert.equal(
    existing.rowCount,
    0,
    "Do not modify existing fictional student work; prepare a separate reviewed fixture if already present.",
  );
  const actorRows = await pool.query(
    "SELECT id,auth_user_id FROM profiles WHERE id=$1",
    [DEMO_IDS.studentTwo],
  );
  assert.equal(actorRows.rowCount, 1);
  const access = evidenceAccess({
    profileId: actorRows.rows[0].id,
    userId: actorRows.rows[0].auth_user_id,
  });
  const view = await startTutoring(access, DEMO_IDS.assignmentId);
  assert.equal(view.session.status, "active");
  assert.equal(view.attempts.length, 1);
  const attempt = view.attempts[0];
  assert.equal(attempt.response_text, null);
  const source = buildDemoFixture(loadApprovedContent()).sessions.find(
    (item) => item.session.id === DEMO_IDS.correctSession,
  );
  assert.ok(source);
  const original = source.attempts[0];
  assert.equal(attempt.prompt_text, original.question.prompt_text);
  await submitAnswer(access, view.session.id, {
    attempt_id: attempt.id,
    submission_key: randomUUID(),
    response_text: original.response_text,
  });
  const result = structuredClone(source.evaluations[0].result);
  assert.ok(result);
  result.evidence_quotes = result.evidence_quotes.map((quote) => ({
    ...quote,
    response_id: attempt.id,
  }));
  result.misconception_candidates = [];
  const accepted = await recordEvaluation(access, view.session.id, {
    id: randomUUID(),
    attempt_id: attempt.id,
    validation_status: "accepted",
    evaluator: {
      type: "synthetic_fixture",
      model: null,
      version: "independent-browser-acceptance-result-v1",
    },
    supersedes_id: null,
    result,
    applied_result: null,
    failure_reason: null,
  });
  await applyTutoring(access, view.session.id, accepted.id);
  const saved = await readSession(access, view.session.id, "student");
  assert.equal(saved.session.status, "completed");
  assert.equal(saved.evaluations.length, 1);
  assert.equal(saved.attempts[0].response_text, original.response_text);
  assert.equal(saved.evaluations[0].evaluator.type, "synthetic_fixture");
  assert.equal(saved.interventions.length, 0);
  console.log(
    JSON.stringify(
      {
        project: process.env.ACCEPTANCE_PROJECT,
        fictional_only: true,
        actual_model_calls: 0,
        provenance:
          "Fresh ordinary tutoring-service session (live_demo navigation category), original fictional correct response and explicitly synthetic_fixture accepted evaluation. Historical seeded records unchanged.",
        assignment_id: DEMO_IDS.assignmentId,
        student_id: DEMO_IDS.studentTwo,
        session_id: saved.session.id,
        attempt_id: attempt.id,
        evaluation_id: accepted.id,
        status: saved.session.status,
        response_text: original.response_text,
        correctness: saved.evaluations[0].result.per_concept_results,
        url: `/study/assignments/${DEMO_IDS.assignmentId}?tab=study&session=${saved.session.id}`,
      },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
