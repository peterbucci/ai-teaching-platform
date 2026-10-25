import assert from "node:assert/strict";
import test from "node:test";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { buildDemoFixture } from "../lib/evidence/demo.ts";
import type {
  EvaluationResult,
  SessionEvidence,
} from "../lib/evidence/contracts.ts";
import { tutoringCompletionMessage } from "../lib/tutoring/completion.ts";

const fixture = buildDemoFixture(loadApprovedContent());
const generic =
  "Practice complete. This records today's performance, not lasting mastery.";

function completed(
  correctness: EvaluationResult["per_concept_results"][number]["correctness"] = "correct",
) {
  const evidence = structuredClone(fixture.sessions[1]);
  const attempt = evidence.attempts.at(-1)!;
  const evaluation = evidence.evaluations.find(
    (item) => item.id === attempt.current_evaluation_id,
  )!;
  assert.ok(evaluation.result);
  for (const result of evaluation.result.per_concept_results)
    result.correctness = correctness;
  return { evidence, attempt, evaluation, result: evaluation.result };
}

test("correct initial and diagnostic answers get visible-safe confirmation without changing evidence", () => {
  for (const intent of ["initial_retrieval", "diagnostic_followup"] as const) {
    const { evidence, attempt, result } = completed();
    attempt.intent = intent;
    result.reasoning_observed = "PRIVATE REASONING";
    result.per_concept_results[0].rubric_criteria_met = ["PRIVATE CRITERION"];
    const before = structuredClone(evidence);
    assert.equal(
      tutoringCompletionMessage(evidence),
      "Your answer is correct. Practice complete. This records today's performance, not lasting mastery.",
    );
    assert.deepEqual(evidence, before);
  }
});

test("a correct retest retains the recorded help distinction", () => {
  const evidence = structuredClone(fixture.sessions[0]);
  const attempt = evidence.attempts.at(-1)!;
  assert.equal(attempt.intent, "immediate_retest");
  assert.equal(attempt.assistance?.assistance_level, "corrective_feedback");
  assert.equal(
    tutoringCompletionMessage(evidence),
    "Your answer is correct. Practice complete. This answer followed help. This records today's performance, not lasting mastery.",
  );
});

test("uncertain, partial and incorrect answers are not reported as correct", () => {
  const cases = [
    ["uncertain", "Your latest answer could not be assessed with confidence."],
    ["partially_correct", "Your latest answer is partly correct."],
    ["incorrect", "Your latest answer is not correct yet."],
  ] as const;
  for (const [correctness, prefix] of cases) {
    const { evidence } = completed(correctness);
    assert.equal(
      tutoringCompletionMessage(evidence),
      `${prefix} Practice complete. This records today's performance, not lasting mastery.`,
    );
  }
  const mixed = completed();
  mixed.result.per_concept_results[0].correctness = "incorrect";
  assert.match(tutoringCompletionMessage(mixed.evidence), /partly correct/);
});

test("pending, rejected, failed and unevaluated work cannot receive a success message", () => {
  for (const status of [
    "active",
    "pending_evaluation",
    "unevaluated",
  ] as const) {
    const { evidence } = completed();
    evidence.session.status = status;
    assert.match(tutoringCompletionMessage(evidence), /not yet confirmed/);
  }
  for (const status of [
    "pending_review",
    "rejected",
    "evaluation_failed",
  ] as const) {
    const { evidence, evaluation } = completed();
    evaluation.validation_status = status;
    assert.equal(tutoringCompletionMessage(evidence), generic);
  }
  const missing = completed();
  missing.evaluation.result = null;
  assert.equal(tutoringCompletionMessage(missing.evidence), generic);
});

test("missing, duplicated or foreign concept results cannot imply complete correctness", () => {
  const cases = [
    (evidence: SessionEvidence) => {
      evidence.evaluations[0].result!.per_concept_results = [];
    },
    (evidence: SessionEvidence) => {
      evidence.evaluations[0].result!.per_concept_results.pop();
    },
    (evidence: SessionEvidence) => {
      const results = evidence.evaluations[0].result!.per_concept_results;
      results[1].concept_id = results[0].concept_id;
    },
    (evidence: SessionEvidence) => {
      evidence.evaluations[0].result!.per_concept_results[0].concept_id =
        "another-lesson-concept";
    },
  ];
  for (const change of cases) {
    const { evidence } = completed();
    change(evidence);
    assert.equal(tutoringCompletionMessage(evidence), generic);
  }
});

test("a superseded or wrong-attempt evaluation cannot supply the current answer result", () => {
  const superseded = completed();
  superseded.evidence.evaluations.push({
    ...structuredClone(superseded.evaluation),
    id: "60000000-0000-4000-8000-000000000099",
    supersedes_id: superseded.evaluation.id,
  });
  assert.equal(tutoringCompletionMessage(superseded.evidence), generic);
  const wrongAttempt = completed();
  wrongAttempt.evaluation.attempt_id = "50000000-0000-4000-8000-000000000099";
  assert.equal(tutoringCompletionMessage(wrongAttempt.evidence), generic);
});

test("an earlier correct answer cannot hide a later incorrect or unsubmitted answer", () => {
  const { evidence, attempt, evaluation } = completed();
  const later = structuredClone(attempt);
  later.id = "50000000-0000-4000-8000-000000000099";
  later.sequence_index += 1;
  const laterEvaluation = structuredClone(evaluation);
  laterEvaluation.id = "60000000-0000-4000-8000-000000000099";
  laterEvaluation.attempt_id = later.id;
  later.current_evaluation_id = laterEvaluation.id;
  for (const result of laterEvaluation.result!.per_concept_results)
    result.correctness = "incorrect";
  // Sequence order is authoritative, not array insertion order.
  evidence.attempts.unshift(later);
  evidence.evaluations.push(laterEvaluation);
  assert.match(tutoringCompletionMessage(evidence), /not correct yet/);
  later.submitted_at = null;
  assert.equal(tutoringCompletionMessage(evidence), generic);
});
