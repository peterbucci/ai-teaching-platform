/** Draft operator-only acceptance helper. Execute only in the fresh disposable app.
 * This script never calls a model or acknowledges help. No fixture action ran during preparation.
 * Usage: node --experimental-strip-types --conditions=react-server FILE init KIND /tmp/fixture.json
 *        node --experimental-strip-types --conditions=react-server FILE step /tmp/fixture.json
 *        node --experimental-strip-types --conditions=react-server FILE inspect /tmp/fixture.json
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

assert.equal(process.env.ALLOW_DISPOSABLE_STUDENT_FIXTURES, "1");
assert.match(
  process.env.ACCEPTANCE_PROJECT || "",
  /^lp-(?:accept|student)-[a-z0-9-]+$/,
);
assert.match(process.env.ACCEPTANCE_SOURCE_SHA || "", /^[a-f0-9]{40}$/);
assert.equal(process.env.OPENAI_API_KEY?.trim() || "", "");
assert.equal(process.env.OPENAI_MODEL?.trim() || "", "");
assert.equal(process.env.PGHOST, "db");
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(process.env.AUTH_URL).hostname),
);
assert.equal(process.cwd(), "/app");
const [mode, first, second] = process.argv.slice(2);
assert.ok(["init", "step", "inspect"].includes(mode));
const kinds = ["correct", "partially_correct", "incorrect", "uncertain"];
const file = mode === "init" ? second : first;
assert.match(file || "", /^\/tmp\/[a-z0-9_-]+\.json$/);
const { getPool } = await import("/app/lib/db.ts");
const {
  evidenceAccess,
  startSession,
  presentQuestion,
  submitAnswer,
  recordEvaluation,
  readSession,
} = await import("/app/lib/evidence/store.ts");
const { applyTutoring, tutorView } = await import("/app/lib/tutoring/store.ts");
const { loadApprovedContent, getCuratedQuestion } =
  await import("/app/lib/evidence/content.ts");
const { buildDemoFixture, DEMO_IDS } =
  await import("/app/lib/evidence/demo.ts");
const pool = getPool();
const privateCanary = "PRIVATE_STUDENT_ACCEPTANCE_CANARY_20261025";
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
  const content = loadApprovedContent();
  let manifest;
  if (mode === "init") {
    assert.ok(kinds.includes(first));
    assert.equal(
      existsSync(file),
      false,
      "Choose a new fixture path; never overwrite a previous fixture.",
    );
    const session = await startSession(
      access,
      DEMO_IDS.assignmentId,
      "live_demo",
    );
    await presentQuestion(access, session.id, {
      question: getCuratedQuestion(
        content,
        content.sequence.initial_question_id,
      ),
      intent: "initial_retrieval",
    });
    manifest = {
      schema: "student-blockers-fixture-v1",
      project: process.env.ACCEPTANCE_PROJECT,
      source_sha: process.env.ACCEPTANCE_SOURCE_SHA,
      kind: first,
      session_id: session.id,
      assignment_id: DEMO_IDS.assignmentId,
      student_id: DEMO_IDS.studentTwo,
      private_canary: privateCanary,
      created_at: new Date().toISOString(),
      actual_model_calls: 0,
      provenance:
        "Fresh ordinary session, synthetic evaluator; outcomes are authored acceptance states, not actual model judgments. Feedback may be acknowledged only by normal browser display.",
      steps: [],
      url: `/study/assignments/${DEMO_IDS.assignmentId}?tab=study&session=${session.id}`,
    };
    writeFileSync(file, JSON.stringify(manifest, null, 2), { flag: "wx" });
  } else {
    manifest = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(manifest.schema, "student-blockers-fixture-v1");
    assert.equal(manifest.project, process.env.ACCEPTANCE_PROJECT);
    assert.equal(manifest.source_sha, process.env.ACCEPTANCE_SOURCE_SHA);
    assert.equal(manifest.student_id, DEMO_IDS.studentTwo);
    assert.ok(kinds.includes(manifest.kind));
  }
  if (mode === "step") {
    assert.equal(
      Boolean(manifest.pending_step),
      false,
      "An interrupted step needs inspection; do not create a new submission identity.",
    );
    const before = await readSession(access, manifest.session_id, "student");
    assert.equal(
      before.session.status,
      "active",
      "Completed fixture must not receive another submission.",
    );
    assert.equal(
      before.interventions.some((item) => item.delivery_status === "created"),
      false,
      "Open the fixture in the browser and actually display pending help before advancing.",
    );
    const current = before.attempts.at(-1);
    assert.equal(
      current.submitted_at,
      null,
      "Inspect an interrupted step; never automatically retry it.",
    );
    assert.ok(
      manifest.steps.length < 4,
      "The fixture is bounded to the approved transcript.",
    );
    const histories = buildDemoFixture(content).sessions;
    const source = histories[manifest.kind === "correct" ? 1 : 0];
    const authored = source.attempts.find(
      (item) => item.question.question_id === current.question.question_id,
    );
    assert.ok(
      authored,
      "Unexpected controller question; stop instead of inventing a route.",
    );
    assert.equal(current.question.prompt_text, authored.question.prompt_text);
    const authoredEvaluation = source.evaluations.find(
      (item) => item.attempt_id === authored.id,
    );
    const result = structuredClone(authoredEvaluation.result);
    result.evidence_quotes = result.evidence_quotes.map((quote) => ({
      ...quote,
      response_id: current.id,
    }));
    const target = authoredEvaluation.applied_result?.hypothesis_events.at(-1);
    result.misconception_candidates = target?.supporting_response_quotes.some(
      (quote) => quote.response_id === authored.id,
    )
      ? [
          {
            concept_id: target.concept_id,
            misconception_id: target.misconception_id,
            status: "tentative",
            uncertainty_reason:
              "Authored synthetic acceptance evidence; not a confirmed belief.",
            evidence_quotes: target.supporting_response_quotes
              .filter((quote) => quote.response_id === authored.id)
              .map((quote) => ({ ...quote, response_id: current.id })),
          },
        ]
      : [];
    const final =
      manifest.kind === "correct" ||
      current.question.question_id ===
        source.attempts.at(-1).question.question_id;
    if (final) {
      for (const item of result.per_concept_results) {
        item.correctness = manifest.kind;
        item.error_type =
          manifest.kind === "partially_correct"
            ? "arithmetic_or_units"
            : manifest.kind === "incorrect"
              ? "conceptual"
              : manifest.kind === "uncertain"
                ? "other_or_uncertain"
                : null;
        item.rubric_criteria_met =
          manifest.kind === "correct" ? [privateCanary] : [];
        item.rubric_criteria_missing =
          manifest.kind === "correct" ? [] : [privateCanary];
      }
      result.reasoning_observed = privateCanary;
      result.uncertainty_reason =
        manifest.kind === "uncertain"
          ? "Synthetic uncertain acceptance outcome; no confident assessment claimed."
          : null;
      result.misconception_candidates = [];
    }
    const submission = {
      attempt_id: current.id,
      submission_key: randomUUID(),
      response_text: authored.response_text,
    };
    // Persist operator intent before writes so an interrupted command is inspectable, not blindly rerun.
    manifest.pending_step = {
      ...submission,
      created_at: new Date().toISOString(),
    };
    writeFileSync(file, JSON.stringify(manifest, null, 2));
    await submitAnswer(access, manifest.session_id, submission);
    const accepted = await recordEvaluation(access, manifest.session_id, {
      id: randomUUID(),
      attempt_id: current.id,
      validation_status: "accepted",
      evaluator: {
        type: "synthetic_fixture",
        model: null,
        version: "independent-student-blockers-v1",
      },
      supersedes_id: null,
      result,
      applied_result: null,
      failure_reason: null,
    });
    await applyTutoring(access, manifest.session_id, accepted.id);
    manifest.steps.push({
      ...submission,
      evaluation_id: accepted.id,
      final,
      at: new Date().toISOString(),
    });
    delete manifest.pending_step;
  }
  const saved = await readSession(access, manifest.session_id, "student");
  const last = saved.attempts.at(-1);
  const evaluation = saved.evaluations.find(
    (item) => item.id === last.current_evaluation_id,
  );
  manifest.receipt = {
    status: saved.session.status,
    attempt_id: last.id,
    response_text: last.response_text,
    submission_key: last.submission_key,
    evaluation_id: evaluation?.id ?? null,
    correctness: evaluation?.result?.per_concept_results ?? null,
    uncertainty_reason: evaluation?.result?.uncertainty_reason ?? null,
    assistance: last.assistance,
    content_ref: last.question.content_ref,
    attempts: saved.attempts.length,
    evaluations: saved.evaluations.length,
    pending_feedback_ids: saved.interventions
      .filter((item) => item.delivery_status === "created")
      .map((item) => item.id),
    student_view: await tutorView(access, manifest.session_id),
  };
  writeFileSync(file, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
} finally {
  await pool.end();
}
