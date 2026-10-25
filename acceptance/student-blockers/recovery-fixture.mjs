/** Operator-only fixtures; run in the isolated acceptance app, never a production route. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
assert.equal(process.env.ALLOW_DISPOSABLE_STUDENT_FIXTURES, "1");
assert.equal(process.env.ACCEPTANCE_PROJECT, "lp-accept-pr113");
assert.equal(process.env.OPENAI_API_KEY?.trim() || "", "");
assert.equal(process.env.OPENAI_MODEL?.trim() || "", "");
assert.equal(process.env.PGHOST, "db");
assert.equal(process.cwd(), "/app");
const [mode, id, attemptId] = process.argv.slice(2);
assert.ok(["create", "expire", "evaluate"].includes(mode));
const { getPool } = await import("/app/lib/db.ts");
const {
  evidenceAccess,
  startSession,
  presentQuestion,
  readSession,
  recordEvaluation,
} = await import("/app/lib/evidence/store.ts");
const { applyTutoring } = await import("/app/lib/tutoring/store.ts");
const { loadApprovedContent, getCuratedQuestion } =
  await import("/app/lib/evidence/content.ts");
const { DEMO_IDS } = await import("/app/lib/evidence/demo.ts");
const pool = getPool();
try {
  const actor = await pool.query(
    "SELECT p.id,p.auth_user_id,u.email FROM profiles p JOIN auth_user u ON u.id=p.auth_user_id WHERE p.id=$1",
    [DEMO_IDS.studentTwo],
  );
  assert.equal(actor.rowCount, 1);
  assert.match(actor.rows[0].email, /^acceptance-[a-z0-9-]+@example\.invalid$/);
  const access = evidenceAccess({
    profileId: actor.rows[0].id,
    userId: actor.rows[0].auth_user_id,
  });
  if (mode === "create") {
    const content = loadApprovedContent();
    const session = await startSession(
      access,
      DEMO_IDS.assignmentId,
      "live_demo",
    );
    const attempt = await presentQuestion(access, session.id, {
      question: getCuratedQuestion(
        content,
        content.sequence.initial_question_id,
      ),
      intent: "initial_retrieval",
    });
    console.log(
      JSON.stringify({
        sessionId: session.id,
        attemptId: attempt.id,
        url: `/study/assignments/${DEMO_IDS.assignmentId}?tab=study&session=${session.id}`,
      }),
    );
  } else if (mode === "expire") {
    assert.match(id || "", /^[a-zA-Z0-9_-]{10,128}$/);
    const expired = await pool.query(
      'UPDATE auth_session SET "expiresAt"=clock_timestamp()-interval \'1 minute\' WHERE id=$1 AND "userId"=$2 RETURNING id,"expiresAt"',
      [id, actor.rows[0].auth_user_id],
    );
    assert.equal(expired.rowCount, 1);
    console.log(
      JSON.stringify({
        auth_session_id: expired.rows[0].id,
        expires_at: expired.rows[0].expiresAt,
      }),
    );
  } else {
    assert.match(id || "", /^[a-f0-9-]{36}$/);
    assert.match(attemptId || "", /^[a-f0-9-]{36}$/);
    const evidence = await readSession(access, id, "student");
    const attempt = evidence.attempts.find((x) => x.id === attemptId);
    assert.ok(attempt?.submitted_at);
    assert.equal(attempt.current_evaluation_id, null);
    assert.equal(evidence.evaluations.length, 0);
    const evaluation = await recordEvaluation(access, id, {
      id: randomUUID(),
      attempt_id: attemptId,
      validation_status: "accepted",
      evaluator: {
        type: "synthetic_fixture",
        model: null,
        version: "student-save-recovery-acceptance-v1",
      },
      supersedes_id: null,
      result: {
        per_concept_results: attempt.question.concept_ids.map((concept_id) => ({
          concept_id,
          correctness: "uncertain",
          error_type: "insufficient_response",
          rubric_criteria_met: [],
          rubric_criteria_missing: [],
        })),
        source_passage_ids: attempt.question.source_passage_ids,
        evidence_quotes: [],
        misconception_candidates: [],
        reasoning_observed:
          "Synthetic persistence fixture; not a model assessment.",
        uncertainty_reason:
          "The invented placeholder text does not assess the lesson.",
        proposed_next_action: "ASK_SELF_EXPLANATION",
      },
      applied_result: null,
      failure_reason: null,
    });
    await applyTutoring(access, id, evaluation.id);
    console.log(
      JSON.stringify({ evaluation_id: evaluation.id, actual_model_calls: 0 }),
    );
  }
} finally {
  await pool.end();
}
