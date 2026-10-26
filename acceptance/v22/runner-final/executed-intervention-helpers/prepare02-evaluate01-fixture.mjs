/** Operator-only synthetic seam for one completed authoring browser record.
 * Run inside the pinned isolated app image; never approves, delivers or submits an answer.
 * Modes: prepare <authoring-report> <fresh-output>; evaluate-followup <browser-report> <fresh-output>.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
const [mode, inputPath, outputPath] = process.argv.slice(2);
assert.ok(["prepare", "evaluate-followup"].includes(mode));
for (const file of [inputPath, outputPath])
  assert.match(file || "", /^\/tmp\/acceptance-[a-zA-Z0-9-]+\.json$/);
assert.equal(
  existsSync(outputPath),
  false,
  "Keep each seam result; choose a fresh output path.",
);
const pinnedSha = "462cfb1b31d9108cec70d18b6553bd45048d2eed";
const pinnedTree = "03cca1fed3900a122e689c4a512afadd9052e5af";
assert.equal(process.env.ACCEPTANCE_SOURCE_SHA, pinnedSha);
assert.equal(process.env.ACCEPTANCE_SOURCE_TREE, pinnedTree);
assert.equal(process.env.ACCEPTANCE_PROJECT, "lp-v22-shell5");
assert.equal(process.env.AUTH_URL, "http://localhost:3350");
assert.equal(process.env.PGHOST, "db");
assert.equal(process.env.PGDATABASE, "learning_platform");
for (const key of ["OPENAI_API_KEY", "OPENAI_MODEL"])
  assert.equal(process.env[key]?.trim() || "", "");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const bytes = readFileSync(inputPath);
assert.ok(bytes.length < 2_000_000);
const input = JSON.parse(bytes);
const authoring = mode === "prepare" ? input : input.preparation.authoring;
assert.equal(authoring.sha ?? authoring.sourceSha, pinnedSha);
assert.equal(authoring.tree ?? authoring.sourceTree, pinnedTree);
assert.equal(authoring.origin, process.env.AUTH_URL);
assert.equal(authoring.target, "shell");
assert.equal(
  authoring.functional_completed_through,
  "teacher-original-evidence",
);
assert.ok(["passed", "failed-responsive"].includes(authoring.status));
assert.equal(typeof authoring.original_response, "string");
assert.ok(
  authoring.original_response.includes(
    "original fictional acceptance response",
  ),
);
assert.equal(authoring.paid_calls, 0);
// Fail closed if an imported service unexpectedly attempts a provider HTTP call.
globalThis.fetch = async () => {
  throw new Error("External HTTP is disabled in this synthetic seam.");
};
const { getPool } = await import("/app/lib/db.ts");
const { DEMO_IDS } = await import("/app/lib/evidence/demo.ts");
const { evidenceAccess, readSession } =
  await import("/app/lib/evidence/store.ts");
const { readAssignmentContent } = await import("/app/lib/lessons/store.ts");
const { readAssignmentEvidence } = await import("/app/lib/teacher/store.ts");
const { buildInterventionEvidence } =
  await import("/app/lib/interventions/evidence.ts");
const { generateInterventionDraft, readInterventionDraft } =
  await import("/app/lib/interventions/store.ts");
const { readInterventionReview } =
  await import("/app/lib/interventions/approval.ts");
const { evaluateSubmittedAttempt } =
  await import("/app/lib/evaluation/evaluate.ts");
const { evaluationRecovery } = await import("/app/lib/evaluation/recovery.ts");
const {
  applyStudentInterventionFollowup,
  readStudentInterventionFollowup,
  readInterventionComparison,
} = await import("/app/lib/interventions/outcomes.ts");
const pool = getPool();
const report = {
  mode,
  status: "running",
  source_sha: pinnedSha,
  source_tree: pinnedTree,
  project: process.env.ACCEPTANCE_PROJECT,
  origin: process.env.AUTH_URL,
  input_sha256: hash(bytes),
  harness_sha256: hash(readFileSync(new URL(import.meta.url))),
  started_at: new Date().toISOString(),
  actual_model_calls: 0,
  injected_evaluation_calls: 0,
  injected_draft_calls: 0,
  seams: [],
  authoring,
};
const save = () =>
  writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n", {
    flush: true,
  });
writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n", {
  flag: "wx",
  flush: true,
});
async function actor(id, prefix) {
  const found = await pool.query(
    "SELECT p.auth_user_id,u.email FROM profiles p JOIN auth_user u ON u.id=p.auth_user_id WHERE p.id=$1",
    [id],
  );
  assert.equal(found.rowCount, 1);
  assert.equal(found.rows[0].email, process.env[prefix + "_EMAIL"]);
  assert.ok(found.rows[0].email.endsWith("@example.invalid"));
  return evidenceAccess({ profileId: id, userId: found.rows[0].auth_user_id });
}
function provider(correctness, expectedText) {
  return async (prompt) => {
    report.injected_evaluation_calls++;
    const given = JSON.parse(prompt.input);
    assert.equal(given.student_response, expectedText);
    assert.deepEqual(given.question.content_ref, authoring.content_ref);
    return {
      ok: true,
      needsReconciliation: false,
      model: "synthetic-same-browser-journey",
      responseId: "fixture-" + randomUUID(),
      latencyMs: 0,
      usage: null,
      result: {
        per_concept_results: given.question.concept_ids.map((concept_id) => ({
          concept_id,
          correctness,
          error_type: correctness === "correct" ? null : "conceptual",
          rubric_criteria_met:
            correctness === "correct" ? given.question.rubric.criteria : [],
          rubric_criteria_missing:
            correctness === "correct" ? [] : given.question.rubric.criteria,
        })),
        source_passage_ids: given.question.source_passage_ids,
        evidence_quotes: [
          {
            quote: expectedText,
            interpretation:
              "Explicit synthetic evaluator seam for original response identity; not a model judgment.",
          },
        ],
        misconception_candidates: [],
        reasoning_observed:
          "Synthetic browser-journey fixture; no real model was called and no educational effectiveness is established.",
        uncertainty_reason: null,
        proposed_next_action:
          correctness === "correct"
            ? "SCHEDULE_REVIEW"
            : "ASK_DIAGNOSTIC_FOLLOWUP",
      },
    };
  };
}
function stableUuid(label) {
  const raw = hash(authoring.student_session_id + ":" + label);
  return (
    raw.slice(0, 8) +
    "-" +
    raw.slice(8, 12) +
    "-4" +
    raw.slice(13, 16) +
    "-8" +
    raw.slice(17, 20) +
    "-" +
    raw.slice(20, 32)
  );
}
try {
  assert.equal(authoring.student_id, DEMO_IDS.studentOne);
  const teacher = await actor(DEMO_IDS.teacher, "DEMO_TEACHER");
  const student = await actor(DEMO_IDS.studentOne, "DEMO_STUDENT_ONE");
  const assignmentRows = await pool.query(
    "SELECT a.lesson_id,a.lesson_version,a.class_id,a.teacher_approved_at,c.teacher_id FROM assignments a JOIN classes c ON c.id=a.class_id WHERE a.id=$1",
    [authoring.assignment_id],
  );
  assert.equal(assignmentRows.rowCount, 1);
  const assignment = assignmentRows.rows[0];
  assert.equal(assignment.lesson_id, authoring.lesson_id);
  assert.equal(assignment.lesson_version, String(authoring.published_version));
  assert.equal(assignment.class_id, authoring.class_id);
  assert.equal(assignment.teacher_id, DEMO_IDS.teacher);
  assert.ok(
    assignment.teacher_approved_at,
    "This fixture never activates assignments.",
  );
  const original = await readSession(
    student,
    authoring.student_session_id,
    "student",
  );
  assert.equal(original.session.assignment_id, authoring.assignment_id);
  assert.equal(original.session.student_id, authoring.student_id);
  assert.equal(original.session.class_id, authoring.class_id);
  const attempt = original.attempts.find(
    (value) => value.id === authoring.presented_attempt_id,
  );
  assert.ok(attempt?.submitted_at);
  assert.equal(attempt.response_text, authoring.original_response);
  assert.deepEqual(attempt.question.content_ref, authoring.content_ref);
  const content = await readAssignmentContent(
    teacher,
    authoring.assignment_id,
    "teacher",
  );
  assert.deepEqual(content.content_ref, authoring.content_ref);
  assert.equal(content.content_ref.source_id, authoring.source_id);
  assert.equal(content.content_ref.source_version, authoring.source_version);
  report.original_attempt_snapshot = attempt;
  report.original_answer_sha256 = hash(attempt.response_text);
  report.concept_id = attempt.question.concept_ids[0];
  const originalEvaluations = original.evaluations.filter(
    (value) => value.attempt_id === attempt.id,
  );
  assert.equal(
    Boolean(evaluationRecovery(originalEvaluations, Date.now()).unfinished),
    false,
    "An unresolved original evaluation must be reconciled, never replayed.",
  );
  if (mode === "prepare") {
    let accepted = originalEvaluations.find(
      (value) =>
        value.id === attempt.current_evaluation_id &&
        value.validation_status === "accepted",
    );
    if (!accepted) {
      assert.equal(
        originalEvaluations.length,
        0,
        "Do not replace or silently retry a recorded evaluation.",
      );
      const began = new Date().toISOString();
      const result = await evaluateSubmittedAttempt(
        student,
        original.session.id,
        attempt.id,
        undefined,
        { provider: provider("incorrect", attempt.response_text) },
      );
      assert.equal(result.failure, null);
      accepted = result.evaluation;
      assert.equal(accepted?.validation_status, "accepted");
      report.seams.push({
        kind: "original-answer-evaluation",
        started_at: began,
        finished_at: new Date().toISOString(),
        evaluation_id: accepted.id,
        model: accepted.evaluator.model,
        synthetic: true,
      });
    } else
      report.seams.push({
        kind: "original-answer-evaluation",
        reused_existing_accepted: true,
        evaluation_id: accepted.id,
        model: accepted.evaluator.model,
        paid_calls: 0,
      });
    report.original_evaluation_id = accepted.id;
    assert.equal(
      accepted.result.per_concept_results.find(
        (value) => value.concept_id === report.concept_id,
      )?.correctness,
      "incorrect",
    );
    save();
    const selection = {
      assignment_id: authoring.assignment_id,
      concept_id: report.concept_id,
      misconception_id: null,
      attempt_ids: [attempt.id],
      origin: "all",
    };
    const evidence = buildInterventionEvidence(
      await readAssignmentEvidence(teacher, authoring.assignment_id, "all"),
      content,
      selection,
    );
    const observation = evidence.observations.find(
      (value) => value.attempt.id === attempt.id,
    );
    assert.ok(observation);
    assert.equal(observation.student_id, authoring.student_id);
    const passage = evidence.sources.find((value) =>
      value.text.includes(
        "Evaporation changes liquid water into water vapor, a gas.",
      ),
    );
    assert.ok(
      passage,
      "This utility is scoped to the manual water lesson only.",
    );
    const quote = "Evaporation changes liquid water into water vapor, a gas.";
    const guidance = {
      concept_ids: [report.concept_id],
      source_passage_ids: [passage.passage_id],
      answer_guidance: quote,
      criteria: [quote],
    };
    const proposal = {
      content_ref: content.content_ref,
      title: "Following water through a change of state",
      learning_objective: evidence.concept.objectives[0],
      strategy: "self_explanation",
      exercise_text:
        "Read the passage and explain the change in the water using your own words.",
      source_references: [{ passage_id: passage.passage_id, quote }],
      practice_questions: [
        {
          ...guidance,
          prompt_text:
            "Describe the relationship between liquid water and water vapor during evaporation.",
        },
      ],
      fresh_check: {
        ...guidance,
        prompt_text:
          "A gardener notices that damp soil dries after watering. Explain where the water can go and whether it still exists.",
      },
      evidence_references: evidence.observations.map((value) => ({
        evidence_id: value.evidence_id,
        response_quote: value.attempt.response_text,
        role: value.role,
      })),
      suggested_recipients: [
        {
          pseudonym: observation.pseudonym,
          evidence_ids: [observation.evidence_id],
        },
      ],
    };
    const request = {
      request_id: stableUuid("draft-request"),
      draft_id: stableUuid("draft"),
      expected_revision: 0,
      selection,
      revision_instructions: "",
    };
    report.draft_request_id = request.request_id;
    report.draft_id = request.draft_id;
    save();
    const prior = await pool.query(
      "SELECT status FROM teacher_intervention_requests WHERE teacher_id=$1 AND request_id=$2",
      [DEMO_IDS.teacher, request.request_id],
    );
    let draft;
    if (prior.rowCount) {
      assert.equal(
        prior.rows[0].status,
        "completed",
        "Do not retry a failed or unresolved draft generation.",
      );
      draft = await readInterventionDraft(teacher, request.draft_id);
      report.seams.push({
        kind: "private-intervention-draft",
        reused_existing_completed: true,
        request_id: request.request_id,
        draft_id: request.draft_id,
      });
    } else {
      const began = new Date().toISOString();
      const generated = await generateInterventionDraft(
        teacher,
        request,
        async (prompt) => {
          report.injected_draft_calls++;
          assert.deepEqual(
            JSON.parse(prompt.input).content_ref,
            authoring.content_ref,
          );
          return {
            ok: true,
            result: proposal,
            model: "synthetic-same-browser-journey",
            responseId: "fixture-" + randomUUID(),
            latencyMs: 0,
            usage: null,
          };
        },
      );
      assert.equal(generated.status, "completed", generated.error);
      draft = generated.draft;
      report.seams.push({
        kind: "private-intervention-draft",
        synthetic: true,
        request_id: request.request_id,
        draft_id: request.draft_id,
        started_at: began,
        finished_at: new Date().toISOString(),
      });
    }
    assert.equal(draft.status, "private_draft");
    assert.deepEqual(draft.evidence.content_ref, authoring.content_ref);
    assert.equal(
      draft.evidence.observations.find(
        (value) => value.attempt.id === attempt.id,
      )?.attempt.response_text,
      authoring.original_response,
    );
    const review = await readInterventionReview(teacher, draft.id);
    assert.equal(review.approval, null);
    assert.equal(review.delivery, null);
    report.teacher_url =
      "/teacher/interventions?" +
      new URLSearchParams({
        assignment: authoring.assignment_id,
        concept: report.concept_id,
        origin: "all",
        draft: draft.id,
        seedAttempt: attempt.id,
      });
    report.followup_response =
      "The water can evaporate from the soil and become water vapor, a gas. It remains water in a different state rather than stopping existing.";
  } else {
    assert.equal(input.phase, "review-and-submit");
    assert.ok(
      ["passed", "failed-responsive"].includes(input.status),
      "Do not continue after a functional browser failure.",
    );
    assert.equal(
      input.functional_completed_through,
      "teacher-inspected-provider-disabled-followup",
    );
    const preparation = input.preparation;
    assert.equal(preparation.status, "completed");
    assert.equal(
      preparation.original_answer_sha256,
      report.original_answer_sha256,
    );
    assert.equal(
      preparation.original_evaluation_id,
      attempt.current_evaluation_id,
    );
    const review = await readInterventionReview(teacher, preparation.draft_id);
    assert.equal(review.approval?.id, input.approval_id);
    assert.ok(review.delivery);
    assert.deepEqual(review.approval.recipient_ids, [authoring.student_id]);
    assert.deepEqual(review.approval.content_ref, authoring.content_ref);
    const before = await readStudentInterventionFollowup(
      student,
      input.approval_id,
    );
    assert.equal(before.response_text, preparation.followup_response);
    assert.equal(before.attempt_id, input.followup.attempt_id);
    assert.ok(before.submitted_at);
    report.preparation = preparation;
    report.approval_id = input.approval_id;
    report.draft_id = preparation.draft_id;
    report.teacher_url = preparation.teacher_url;
    report.followup_response = preparation.followup_response;
    report.browser_report_sha256 = hash(bytes);
    report.before_followup = before;
    if (before.evaluation_status === "accepted")
      report.seams.push({
        kind: "followup-evaluation",
        reused_existing_accepted: true,
        evaluation_id: before.evaluation_id,
      });
    else {
      assert.equal(
        before.evaluation_status,
        "failed",
        "Pending/unknown follow-ups must never be replayed.",
      );
      assert.equal(
        before.retry_allowed,
        true,
        "Respect the normal retry delay/quota. Wait until retry_after, then use a new seam output path.",
      );
      const began = new Date().toISOString();
      const requestId = stableUuid("followup-evaluation-retry");
      report.followup_request_id = requestId;
      save();
      const after = await applyStudentInterventionFollowup(
        student,
        input.approval_id,
        {
          action: "retry",
          request_id: requestId,
          expected_evaluation_id: before.evaluation_id,
        },
        { provider: provider("correct", before.response_text) },
      );
      assert.equal(after.evaluation_status, "accepted");
      assert.equal(after.evaluation_provenance, "injected_fixture");
      assert.equal(after.response_text, before.response_text);
      report.seams.push({
        kind: "followup-evaluation",
        synthetic: true,
        request_id: requestId,
        evaluation_id: after.evaluation_id,
        started_at: began,
        finished_at: new Date().toISOString(),
      });
    }
    report.followup = await readStudentInterventionFollowup(
      student,
      input.approval_id,
    );
    const comparison = await readInterventionComparison(
      teacher,
      preparation.draft_id,
    );
    assert.equal(
      comparison.original_evidence.observations.find(
        (value) => value.attempt.id === attempt.id,
      )?.attempt.response_text,
      authoring.original_response,
    );
    report.comparison_counts = comparison.counts;
  }
  const afterOriginal = await readSession(
    student,
    original.session.id,
    "student",
  );
  const afterAttempt = afterOriginal.attempts.find(
    (value) => value.id === attempt.id,
  );
  assert.deepEqual(
    { ...afterAttempt, current_evaluation_id: attempt.current_evaluation_id },
    attempt,
  );
  assert.deepEqual(afterOriginal.interventions, original.interventions);
  report.status = "completed";
} catch (error) {
  report.status = "failed";
  report.error = error.message;
  process.exitCode = 1;
} finally {
  report.finished_at = new Date().toISOString();
  save();
  await pool.end();
  console.log(
    JSON.stringify({
      mode,
      status: report.status,
      output: outputPath,
      seams: report.seams,
      error: report.error,
    }),
  );
}
