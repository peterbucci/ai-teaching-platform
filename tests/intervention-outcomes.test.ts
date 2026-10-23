import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import type { Evaluation, SessionEvidence } from "../lib/evidence/contracts.ts";
import { buildDemoFixture } from "../lib/evidence/demo.ts";
import {
  deriveAssistance,
  validateSessionEvidence,
} from "../lib/evidence/rules.ts";
import { projectInterventionFollowup } from "../lib/interventions/outcomes.ts";

const content = loadApprovedContent();
const approvalId = randomUUID();
type Dispatch = Parameters<typeof projectInterventionFollowup>[2][number];

function followupFixture(): SessionEvidence {
  const original = buildDemoFixture(content).sessions.find(
    (item) => item.attempts.length === 1,
  );
  assert.ok(original);
  const evidence = structuredClone(original);
  evidence.session.status = "active";
  evidence.session.ended_at = null;
  const attempt = evidence.attempts[0];
  assert.ok(attempt.submitted_at);
  attempt.intent = "immediate_retest";
  attempt.outcome = null;
  attempt.assistance = deriveAssistance(
    attempt.question,
    attempt.intent,
    attempt.presented_at,
    attempt.submitted_at,
    evidence.interventions,
  );
  evidence.evaluations[0].applied_result = null;
  return validateSessionEvidence(content, evidence);
}

function dispatch(
  evidence: SessionEvidence,
  state: Dispatch["state"],
): Dispatch {
  const attempt = evidence.attempts[0];
  assert.ok(attempt.submitted_at);
  const evaluation = evidence.evaluations.at(-1);
  const id = randomUUID();
  return {
    request_id: id,
    request: {
      action: "submit",
      request_id: id,
      response_text: attempt.response_text ?? "",
    },
    state,
    evaluation_id: evaluation?.id ?? null,
    failure_code: state === "failed" ? "rate_limited" : null,
    created_at: attempt.submitted_at,
    finished_at:
      state === "pending"
        ? null
        : (evaluation?.evaluated_at ?? attempt.submitted_at),
  };
}

function unaccepted(
  evidence: SessionEvidence,
  status: Evaluation["validation_status"],
) {
  const evaluation = evidence.evaluations[0];
  evaluation.validation_status = status;
  evaluation.evaluator = {
    type: "language_model",
    model: "fixture-only",
    version: "projection-test",
  };
  evaluation.result = null;
  evaluation.applied_result = null;
  evaluation.failure_reason = "Injected evaluation condition";
  evidence.attempts[0].current_evaluation_id = null;
  validateSessionEvidence(content, evidence);
}

test("opening or explicitly starting a follow-up does not invent a response or failed evaluation", () => {
  const unopened = projectInterventionFollowup(approvalId, null, []);
  assert.equal(unopened.started_at, null);
  assert.equal(unopened.evaluation_status, "not_submitted");
  assert.equal(unopened.feedback, null);
  assert.deepEqual(unopened.results, []);
  const started = followupFixture();
  Object.assign(started.attempts[0], {
    submitted_at: null,
    response_text: null,
    submission_key: null,
    assistance: null,
    current_evaluation_id: null,
  });
  started.evaluations = [];
  const view = projectInterventionFollowup(
    approvalId,
    validateSessionEvidence(content, started),
    [],
  );
  assert.equal(view.started_at, started.session.started_at);
  assert.equal(view.evaluation_status, "not_submitted");
  assert.equal(view.submitted_at, null);
  assert.equal(view.retry_allowed, false);
});

test("a saved response and unknown dispatch remain pending and never become a retryable failure with elapsed time", () => {
  const evidence = followupFixture();
  unaccepted(evidence, "pending_review");
  const request = dispatch(evidence, "pending");
  const future = Date.parse(request.created_at) + 7 * 86_400_000;
  const view = projectInterventionFollowup(
    approvalId,
    evidence,
    [request],
    future,
  );
  assert.equal(view.evaluation_status, "pending");
  assert.equal(view.response_text, evidence.attempts[0].response_text);
  assert.equal(view.retry_allowed, false);
  assert.equal(view.retry_after, null);
  assert.equal(view.uncertain, false);
  assert.deepEqual(view.results, []);
  evidence.evaluations = [];
  const unconfirmed = projectInterventionFollowup(
    approvalId,
    evidence,
    [],
    future,
  );
  assert.equal(unconfirmed.evaluation_status, "pending");
  assert.equal(unconfirmed.retry_allowed, false);
});

test("accepted uncertain judgments stay accepted while the student projection excludes private rubric and evaluator details", () => {
  const evidence = followupFixture();
  const evaluation = evidence.evaluations[0];
  assert.ok(evaluation.result);
  evaluation.result.per_concept_results[0].correctness = "uncertain";
  evaluation.result.per_concept_results[0].rubric_criteria_missing = [
    "PRIVATE_CRITERION_SENTINEL",
  ];
  evaluation.result.reasoning_observed = "PRIVATE_TEACHER_REASONING_SENTINEL";
  evaluation.result.uncertainty_reason = "PRIVATE_UNCERTAINTY_DETAIL_SENTINEL";
  validateSessionEvidence(content, evidence);
  const view = projectInterventionFollowup(approvalId, evidence, [
    dispatch(evidence, "completed"),
  ]);
  assert.equal(view.evaluation_status, "accepted");
  assert.equal(view.uncertain, true);
  assert.equal(view.retry_allowed, false);
  assert.equal(view.evaluator_type, "synthetic_fixture");
  assert.ok(view.results.some((item) => item.correctness === "uncertain"));
  assert.equal(
    projectInterventionFollowup(approvalId, evidence, [
      dispatch(evidence, "pending"),
    ]).evaluation_status,
    "accepted",
    "An accepted saved evaluation survives an interrupted journal completion",
  );
  const serialized = JSON.stringify(view);
  for (const privateValue of [
    "PRIVATE_CRITERION_SENTINEL",
    "PRIVATE_TEACHER_REASONING_SENTINEL",
    "PRIVATE_UNCERTAINTY_DETAIL_SENTINEL",
  ])
    assert.ok(!serialized.includes(privateValue));
  for (const privateKey of [
    "rubric",
    "answer_guidance",
    "criteria",
    "rubric_criteria_missing",
    "reasoning_observed",
    "source_passage_ids",
    "hypothesis_events",
  ])
    assert.ok(!serialized.includes(`"${privateKey}":`));
});

test("known failures respect the cooldown and durable dispatch cap, including configuration failures without a model evaluation", () => {
  const evidence = followupFixture();
  unaccepted(evidence, "evaluation_failed");
  const request = dispatch(evidence, "failed");
  assert.ok(request.finished_at);
  const eligible = Date.parse(request.finished_at) + 60_000;
  assert.equal(
    projectInterventionFollowup(approvalId, evidence, [request], eligible - 1)
      .retry_allowed,
    false,
  );
  const available = projectInterventionFollowup(
    approvalId,
    evidence,
    [request],
    eligible,
  );
  assert.equal(available.evaluation_status, "failed");
  assert.equal(available.retry_allowed, true);
  const exhausted = [
    request,
    dispatch(evidence, "failed"),
    dispatch(evidence, "failed"),
  ];
  assert.equal(
    projectInterventionFollowup(
      approvalId,
      evidence,
      exhausted,
      eligible + 60_000,
    ).retry_allowed,
    false,
  );
  evidence.evaluations = [];
  const configuration = {
    ...dispatch(evidence, "failed"),
    failure_code: "configuration",
  };
  assert.equal(
    projectInterventionFollowup(approvalId, evidence, [configuration], eligible)
      .retry_allowed,
    true,
  );
  assert.equal(
    projectInterventionFollowup(
      approvalId,
      evidence,
      [
        configuration,
        dispatch(evidence, "failed"),
        dispatch(evidence, "failed"),
      ],
      eligible,
    ).retry_allowed,
    false,
  );
});

test("an immediate fresh check never becomes independent retrieval; only assistance displayed before submission appears in its snapshot", () => {
  const evidence = followupFixture();
  const attempt = evidence.attempts[0];
  assert.ok(attempt.submitted_at);
  const submitted = Date.parse(attempt.submitted_at);
  const before = new Date(submitted - 10_000).toISOString();
  const after = new Date(submitted + 10_000).toISOString();
  const help = {
    id: randomUUID(),
    session_id: evidence.session.id,
    related_attempt_id: attempt.id,
    related_evaluation_id: null,
    type: "corrective_feedback" as const,
    text_shown: "Approved explanation actually displayed.",
    concept_ids: attempt.question.concept_ids,
    source_passage_ids: attempt.question.source_passage_ids,
    content_ref: attempt.question.content_ref,
    created_at: before,
    visible_at: before,
    delivery_status: "displayed" as const,
  };
  for (const interventions of [
    [],
    [help],
    [{ ...help, created_at: after, visible_at: after }],
  ]) {
    evidence.interventions = interventions;
    attempt.assistance = deriveAssistance(
      attempt.question,
      attempt.intent,
      attempt.presented_at,
      attempt.submitted_at,
      interventions,
    );
    validateSessionEvidence(content, evidence);
    const view = projectInterventionFollowup(approvalId, evidence, [
      dispatch(evidence, "completed"),
    ]);
    assert.ok(view.assistance);
    assert.ok(
      Object.values(
        view.assistance.independent_retrieval_eligible_by_concept,
      ).every((eligible) => eligible === false),
    );
    assert.deepEqual(
      view.assistance.intervention_ids,
      interventions[0]?.visible_at === before ? [help.id] : [],
    );
  }
});
