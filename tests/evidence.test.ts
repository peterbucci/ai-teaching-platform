import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { apiResponse, requestBody } from "../lib/api.ts";
import { AuthError } from "../lib/auth.ts";
import { buildDemoFixture, DEMO_IDS } from "../lib/evidence/demo.ts";
import {
  AttemptSchema,
  EvaluationSchema,
  InterventionSchema,
  SessionEvidenceSchema,
  SubmitAnswerSchema,
} from "../lib/evidence/contracts.ts";
import type {
  Attempt,
  Evaluation,
  Intervention,
} from "../lib/evidence/contracts.ts";
import {
  getCuratedQuestion,
  loadApprovedContent,
  validateQuestionSnapshot,
} from "../lib/evidence/content.ts";
import {
  deriveAssistance,
  toStudentSessionView,
  validateEvaluationReferences,
  validateQuote,
  validateSessionEvidence,
} from "../lib/evidence/rules.ts";

const content = loadApprovedContent();
const sessionId = randomUUID();
const presented = "2026-10-15T12:00:00.000Z";
const submitted = "2026-10-15T12:01:00.000Z";

test("approved synthetic histories reconstruct after JSONB-style serialization without losing concepts, assistance or outcomes", () => {
  const fixture = buildDemoFixture(content);
  const sessions = fixture.sessions.map((original) => {
    // JSONB does not retain object-key order; timestamptz columns can return a
    // different but equivalent offset representation from nested JSON values.
    const serialized: unknown = JSON.parse(
      JSON.stringify(original, (_key, value: unknown) =>
        value !== null && typeof value === "object" && !Array.isArray(value)
          ? Object.fromEntries(
              Object.entries(value).sort(([left], [right]) =>
                right.localeCompare(left),
              ),
            )
          : value,
      ),
    );
    const stored = SessionEvidenceSchema.parse(serialized);
    for (const intervention of stored.interventions) {
      intervention.created_at = intervention.created_at.replace("Z", "+00:00");
      intervention.visible_at =
        intervention.visible_at?.replace("Z", "+00:00") ?? null;
    }
    return validateSessionEvidence(content, stored);
  });
  const supported = sessions.find(
    (session) => session.session.id === DEMO_IDS.supportedSession,
  );
  const correct = sessions.find(
    (session) => session.session.id === DEMO_IDS.correctSession,
  );
  assert.ok(supported && correct);
  assert.deepEqual(
    supported.attempts.map((attempt) => attempt.question.question_id),
    ["NP-TX-01", "D02", "D05", "D06"],
  );
  assert.deepEqual(
    supported.evaluations.map((evaluation) =>
      evaluation.result?.per_concept_results.map((result) => [
        result.concept_id,
        result.correctness,
      ]),
    ),
    [
      [
        ["transmission_delay", "incorrect"],
        ["propagation_delay", "correct"],
      ],
      [
        ["transmission_delay", "incorrect"],
        ["propagation_delay", "correct"],
      ],
      [
        ["transmission_delay", "correct"],
        ["propagation_delay", "correct"],
      ],
      [
        ["transmission_delay", "correct"],
        ["propagation_delay", "correct"],
      ],
    ],
  );
  assert.deepEqual(
    supported.evaluations.flatMap(
      (evaluation) =>
        evaluation.applied_result?.hypothesis_events.map(
          (event) => event.status,
        ) ?? [],
    ),
    ["suspected", "supported"],
  );
  assert.ok(
    supported.attempts
      .slice(2)
      .every(
        (attempt) =>
          attempt.assistance?.assistance_level === "corrective_feedback",
      ),
  );
  assert.equal(
    supported.attempts[0].outcome?.outcome,
    "correct_after_feedback",
  );
  assert.equal(
    supported.attempts[0].outcome?.latest_hypothesis_status,
    "supported",
  );
  assert.equal(correct.attempts.length, 1);
  assert.equal(
    correct.attempts[0].outcome?.outcome,
    "correct_initial_without_content_assistance",
  );
  assert.equal(correct.attempts[0].outcome?.hypothesis_instance_id, null);
  assert.equal(
    correct.attempts[0].assistance?.assistance_level,
    "none_recorded",
  );
  assert.ok(
    fixture.enrollments.some(
      (enrollment) => enrollment.student_id === DEMO_IDS.inactiveStudent,
    ),
  );
  assert.ok(
    !sessions.some(
      (session) => session.session.student_id === DEMO_IDS.inactiveStudent,
    ),
  );
  assert.ok(
    sessions.every(
      (session) => session.session.data_origin === "synthetic_fixture",
    ),
  );
});

test("API boundaries reject cross-origin writes and hide internal errors without disguising required sign-in", async () => {
  const previousUrl = process.env.AUTH_URL;
  process.env.AUTH_URL = "https://demo.example";
  try {
    const url = "https://demo.example/api/sessions";
    const request = (origin: string, contentType = "application/json") =>
      new Request(url, {
        method: "POST",
        headers: { origin, "Content-Type": contentType },
        body: "{}",
      });
    assert.deepEqual(await requestBody(request("https://demo.example")), {});
    assert.deepEqual(
      await requestBody(
        new Request("http://0.0.0.0:3000/api/sessions", {
          method: "POST",
          headers: {
            Origin: "https://demo.example",
            "Content-Type": "application/json",
          },
          body: "{}",
        }),
      ),
      {},
    );
    await assert.rejects(requestBody(request("https://other.example")));
    await assert.rejects(
      requestBody(request("https://demo.example", "text/plain")),
    );
    const authResponse = await apiResponse(async () => {
      throw new AuthError(401, "Sign in to continue.");
    });
    assert.equal(authResponse.status, 401);
    assert.deepEqual(await authResponse.json(), {
      error: "Sign in to continue.",
    });
    const internalResponse = await apiResponse(async () => {
      throw new Error("Internal database credentials must not be returned");
    });
    assert.equal(internalResponse.status, 503);
    assert.deepEqual(await internalResponse.json(), {
      error: "Evidence is temporarily unavailable.",
    });
    assert.equal(internalResponse.headers.get("Cache-Control"), "no-store");
  } finally {
    if (previousUrl === undefined) delete process.env.AUTH_URL;
    else process.env.AUTH_URL = previousUrl;
  }
});

function attemptFixture(): Attempt {
  const id = randomUUID();
  const question = getCuratedQuestion(content, "NP-TX-01");
  return AttemptSchema.parse({
    id,
    session_id: sessionId,
    sequence_index: 0,
    parent_attempt_id: null,
    root_attempt_id: id,
    review_of_attempt_id: null,
    question,
    intent: "initial_retrieval",
    presented_at: presented,
    submitted_at: submitted,
    response_text: "🔎 Both double because the distance doubles.",
    submission_key: randomUUID(),
    assistance: deriveAssistance(
      question,
      "initial_retrieval",
      presented,
      submitted,
      [],
    ),
    current_evaluation_id: null,
    outcome: null,
  });
}

function evaluationFixture(attempt: Attempt): Evaluation {
  return EvaluationSchema.parse({
    id: randomUUID(),
    attempt_id: attempt.id,
    validation_status: "accepted",
    evaluator: {
      type: "synthetic_fixture",
      model: null,
      version: "fixture-v1",
    },
    evaluated_at: "2026-10-15T12:01:01.000Z",
    supersedes_id: null,
    result: {
      per_concept_results: [
        {
          concept_id: "transmission_delay",
          correctness: "incorrect",
          error_type: "conceptual",
          rubric_criteria_met: [],
          rubric_criteria_missing: ["Transmission is unchanged"],
        },
        {
          concept_id: "propagation_delay",
          correctness: "correct",
          error_type: null,
          rubric_criteria_met: ["Propagation doubles"],
          rubric_criteria_missing: [],
        },
      ],
      source_passage_ids: ["P07", "P08"],
      evidence_quotes: [
        {
          response_id: attempt.id,
          quote: "Both double",
          start_character: 2,
          end_character: 13,
          interpretation: "Claims both delays change",
        },
      ],
      reasoning_observed: "Attributes both changes to distance.",
      uncertainty_reason: null,
      proposed_next_action: "ASK_DIAGNOSTIC_FOLLOWUP",
    },
    applied_result: {
      action: "ASK_DIAGNOSTIC_FOLLOWUP",
      hypothesis_events: [],
    },
    failure_reason: null,
  });
}

function interventionFixture(
  attempt: Attempt,
  type: Intervention["type"] = "corrective_feedback",
): Intervention {
  return InterventionSchema.parse({
    id: randomUUID(),
    session_id: sessionId,
    related_attempt_id: attempt.id,
    related_evaluation_id: null,
    type,
    text_shown: "Transmission depends on packet size and link rate.",
    concept_ids: ["transmission_delay"],
    source_passage_ids: ["P07", "P08"],
    content_ref: content.content_ref,
    created_at: "2026-10-15T12:00:20.000Z",
    visible_at: "2026-10-15T12:00:30.000Z",
    delivery_status: "displayed",
  });
}

test("curated snapshots preserve the two-concept question and reject forged IDs, text and versions", () => {
  const initial = getCuratedQuestion(content, "NP-TX-01");
  assert.deepEqual(initial.concept_ids, [
    "transmission_delay",
    "propagation_delay",
  ]);
  assert.equal(
    validateQuestionSnapshot(content, initial).prompt_text,
    initial.prompt_text,
  );
  assert.notEqual(
    getCuratedQuestion(content, "D05").prompt_text,
    initial.prompt_text,
  );
  assert.notEqual(
    getCuratedQuestion(content, "D06").prompt_text,
    getCuratedQuestion(content, "D05").prompt_text,
  );
  assert.throws(() =>
    validateQuestionSnapshot(content, {
      ...initial,
      source_passage_ids: ["P99"],
    }),
  );
  assert.throws(() =>
    validateQuestionSnapshot(content, {
      ...initial,
      concept_ids: ["invented_concept"],
    }),
  );
  assert.throws(() =>
    validateQuestionSnapshot(content, {
      ...initial,
      prompt_text: "An unreviewed replacement",
    }),
  );
  assert.throws(() =>
    validateQuestionSnapshot(content, {
      ...initial,
      content_ref: { ...initial.content_ref, content_version: "unapproved" },
    }),
  );
});

test("generated questions use the same grounded snapshot without a bank ID", () => {
  const generated = {
    ...getCuratedQuestion(content, "D05"),
    origin: "generated",
    question_id: null,
    sequence_id: null,
    generation: {
      model: "fixture-model",
      prompt_template_version: "future-template-v1",
      generated_at: presented,
    },
  };
  assert.equal(validateQuestionSnapshot(content, generated).question_id, null);
  assert.throws(() =>
    validateQuestionSnapshot(content, { ...generated, generation: null }),
  );
  assert.throws(() =>
    validateQuestionSnapshot(content, {
      ...generated,
      source_passage_ids: ["outside_assignment"],
    }),
  );
});

test("mixed correctness stays separate and fabricated quotes or incomplete concept judgments fail", () => {
  const attempt = attemptFixture();
  const evaluation = evaluationFixture(attempt);
  validateEvaluationReferences(content, evaluation, attempt, [attempt]);
  assert.deepEqual(
    evaluation.result?.per_concept_results.map((item) => item.correctness),
    ["incorrect", "correct"],
  );
  assert.ok(evaluation.result);
  const result = evaluation.result;
  const quote = result.evidence_quotes[0];
  assert.ok(quote);
  validateQuote(quote, [attempt]);
  assert.throws(() =>
    validateQuote({ ...quote, quote: "Transmission is unchanged" }, [attempt]),
  );
  assert.throws(() =>
    validateQuote({ ...quote, start_character: 3, end_character: 14 }, [
      attempt,
    ]),
  );
  assert.throws(() =>
    validateEvaluationReferences(
      content,
      {
        ...evaluation,
        result: {
          ...result,
          per_concept_results: result.per_concept_results.slice(0, 1),
        },
      },
      attempt,
      [attempt],
    ),
  );
});

test("hypotheses reject unknown categories and repeated evaluation of one response cannot establish support", () => {
  const attempt = attemptFixture();
  const evaluation = evaluationFixture(attempt);
  assert.ok(evaluation.result);
  const event = {
    id: randomUUID(),
    hypothesis_instance_id: randomUUID(),
    concept_id: "transmission_delay",
    misconception_id: "transmission_depends_on_distance",
    previous_status: null,
    status: "suspected" as const,
    evidence_evaluation_ids: [evaluation.id],
    contradicting_evaluation_ids: [],
    supporting_response_quotes: evaluation.result.evidence_quotes,
    reason: "The response explicitly attributes transmission time to distance.",
    created_at: evaluation.evaluated_at,
  };
  const suspected = EvaluationSchema.parse({
    ...evaluation,
    applied_result: {
      action: "ASK_DIAGNOSTIC_FOLLOWUP",
      hypothesis_events: [event],
    },
  });
  validateEvaluationReferences(content, suspected, attempt, [attempt]);
  const unknown = EvaluationSchema.parse({
    ...suspected,
    applied_result: {
      action: "ASK_DIAGNOSTIC_FOLLOWUP",
      hypothesis_events: [{ ...event, misconception_id: "made_up" }],
    },
  });
  assert.throws(() =>
    validateEvaluationReferences(content, unknown, attempt, [attempt]),
  );
  const revision = {
    ...evaluation,
    id: randomUUID(),
    supersedes_id: evaluation.id,
  };
  const supported = EvaluationSchema.parse({
    ...suspected,
    applied_result: {
      action: "ASK_DIAGNOSTIC_FOLLOWUP",
      hypothesis_events: [
        {
          ...event,
          status: "supported",
          evidence_evaluation_ids: [evaluation.id, revision.id],
        },
      ],
    },
  });
  assert.throws(() =>
    validateEvaluationReferences(
      content,
      supported,
      attempt,
      [attempt],
      [revision],
    ),
  );
});

test("assistance counts only displayed pre-submission help, per concept; retests remain assisted", () => {
  const attempt = attemptFixture();
  const help = interventionFixture(attempt);
  const failed = {
    ...help,
    id: randomUUID(),
    visible_at: null,
    delivery_status: "failed" as const,
  };
  const late = {
    ...help,
    id: randomUUID(),
    visible_at: "2026-10-15T12:02:00.000Z",
  };
  const assistance = deriveAssistance(
    attempt.question,
    attempt.intent,
    presented,
    submitted,
    [late, failed, help],
  );
  assert.deepEqual(assistance.intervention_ids, [help.id]);
  assert.equal(assistance.assistance_level, "corrective_feedback");
  assert.deepEqual(assistance.independent_retrieval_eligible_by_concept, {
    transmission_delay: false,
    propagation_delay: true,
  });
  assert.equal(assistance.elapsed_since_content_assistance_seconds, 30);
  const retest = deriveAssistance(
    getCuratedQuestion(content, "D05"),
    "immediate_retest",
    presented,
    submitted,
    [help],
  );
  assert.equal(retest.assistance_level, "corrective_feedback");
  assert.ok(
    Object.values(retest.independent_retrieval_eligible_by_concept).every(
      (value) => !value,
    ),
  );
  const scaffolded = deriveAssistance(
    getCuratedQuestion(content, "NP-BW-03"),
    "initial_retrieval",
    presented,
    submitted,
    [],
  );
  assert.equal(scaffolded.assistance_level, "prompt_supplied_content");
  assert.equal(
    scaffolded.independent_retrieval_eligible_by_concept.bandwidth_throughput,
    false,
  );
  const diagnostic = deriveAssistance(
    attempt.question,
    "diagnostic_followup",
    presented,
    submitted,
    [],
  );
  assert.equal(diagnostic.assistance_level, "none_recorded");
  assert.deepEqual(diagnostic.scaffolding_types, [
    "diagnostic_prompt_without_answer",
  ]);
  assert.ok(
    Object.values(diagnostic.independent_retrieval_eligible_by_concept).every(
      (value) => !value,
    ),
  );
  const delayed = deriveAssistance(
    attempt.question,
    "delayed_review",
    presented,
    submitted,
    [],
  );
  assert.ok(
    Object.values(delayed.independent_retrieval_eligible_by_concept).every(
      Boolean,
    ),
  );
  assert.equal(
    AttemptSchema.safeParse({ ...attempt, intent: "delayed_review" }).success,
    false,
  );
});

test("student submission and session projection cannot carry ownership, rubrics or internal evaluations", () => {
  const attempt = attemptFixture();
  const evaluation = evaluationFixture(attempt);
  const hidden = {
    ...interventionFixture(attempt),
    visible_at: null,
    delivery_status: "created" as const,
  };
  const evidence = SessionEvidenceSchema.parse({
    session: {
      id: sessionId,
      student_id: randomUUID(),
      assignment_id: randomUUID(),
      class_id: randomUUID(),
      status: "active",
      data_origin: "synthetic_fixture",
      started_at: presented,
      ended_at: null,
    },
    attempts: [attempt],
    evaluations: [evaluation],
    interventions: [
      hidden,
      { ...hidden, id: randomUUID(), delivery_status: "failed" },
    ],
  });
  validateSessionEvidence(content, evidence);
  const view = toStudentSessionView(evidence);
  assert.deepEqual(Object.keys(view), ["session", "attempts", "interventions"]);
  assert.equal(view.interventions.length, 1);
  assert.equal(view.interventions[0].delivery_status, "created");
  assert.equal(view.interventions[0].visible_at, null);
  assert.equal("question" in view.attempts[0], false);
  assert.equal("student_id" in view.session, false);
  assert.equal(
    JSON.stringify(view).includes(attempt.question.rubric.answer_guidance),
    false,
  );
  const submission = {
    attempt_id: attempt.id,
    submission_key: randomUUID(),
    response_text: "",
  };
  assert.equal(SubmitAnswerSchema.parse(submission).response_text, "");
  assert.equal(
    SubmitAnswerSchema.safeParse({
      ...submission,
      student_id: randomUUID(),
      correctness: "correct",
    }).success,
    false,
  );
  assert.throws(() =>
    validateSessionEvidence(content, {
      ...evidence,
      attempts: [{ ...attempt, session_id: randomUUID() }],
    }),
  );
});
