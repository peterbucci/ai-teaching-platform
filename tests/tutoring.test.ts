import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { z } from "zod";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { buildDemoFixture } from "../lib/evidence/demo.ts";
import {
  EvaluationSchema,
  type SessionEvidence,
} from "../lib/evidence/contracts.ts";
import { decideTutoring } from "../lib/tutoring/decide.ts";

const content = loadApprovedContent();
const authored = buildDemoFixture(content).sessions[0];
const now = "2026-10-18T12:00:00Z";
const report = z
  .object({
    cases: z.array(
      z.object({
        caseId: z.string(),
        response: z.string(),
        evaluation: EvaluationSchema,
      }),
    ),
  })
  .parse(
    JSON.parse(
      readFileSync("evals/results/2026-10-16-v2-comparison.json", "utf8"),
    ),
  );
function initial(caseId: string): SessionEvidence {
  const example = report.cases.find((item) => item.caseId === caseId);
  assert.ok(example);
  const evaluation = structuredClone(example.evaluation);
  const attempt = {
    ...structuredClone(authored.attempts[0]),
    id: evaluation.attempt_id,
    root_attempt_id: evaluation.attempt_id,
    response_text: example.response,
    current_evaluation_id: evaluation.id,
    outcome: null,
  };
  return {
    session: { ...authored.session, status: "active", ended_at: null },
    attempts: [attempt],
    evaluations: [evaluation],
    interventions: [],
  };
}

test("controller routes all eight recorded real evaluations without following unavailable model actions", () => {
  const expected = [
    ["correct-explained", "END_SESSION", null],
    ["both-double-partly-correct", "ASK_DIAGNOSTIC_FOLLOWUP", "D02"],
    ["explicit-distance-confusion", "ASK_DIAGNOSTIC_FOLLOWUP", "D02"],
    ["ambiguous-longer", "ASK_SELF_EXPLANATION", "D01"],
    ["correct-model-arithmetic-error", "GIVE_CORRECTIVE_FEEDBACK", "D05"],
    ["different-transmission-error", "GIVE_CORRECTIVE_FEEDBACK", "D05"],
    ["unrelated-request", "ASK_RETRIEVAL_QUESTION", "NP-TX-01"],
    ["prompt-injection", "ASK_RETRIEVAL_QUESTION", "NP-TX-01"],
  ];
  for (const [id, action, next] of expected) {
    assert.ok(id);
    const evidence = initial(id);
    const before = structuredClone(evidence);
    const decision = decideTutoring(
      content,
      evidence,
      evidence.evaluations[0].id,
      now,
    );
    assert.equal(decision.applied.action, action, id);
    assert.equal(decision.nextQuestionId, next, id);
    assert.deepEqual(evidence, before, "Decision must not mutate evidence");
    if (action === "ASK_DIAGNOSTIC_FOLLOWUP")
      assert.equal(decision.applied.hypothesis_events[0].status, "suspected");
    else assert.equal(decision.applied.hypothesis_events.length, 0);
  }
});

test("a distinct diagnostic response supports the hypothesis; a fresh retest cannot erase its history", () => {
  const evidence = structuredClone(authored);
  evidence.session.status = "active";
  evidence.session.ended_at = null;
  evidence.attempts[0].outcome = null;
  evidence.attempts = evidence.attempts.slice(0, 2);
  evidence.interventions = [];
  evidence.evaluations = evidence.evaluations.filter((e) =>
    evidence.attempts.some((a) => a.id === e.attempt_id),
  );
  const evaluation = evidence.evaluations.at(-1)!;
  const oldEvent = evaluation.applied_result!.hypothesis_events[0];
  evaluation.applied_result = null;
  evaluation.result!.misconception_candidates = [
    {
      concept_id: oldEvent.concept_id,
      misconception_id: oldEvent.misconception_id,
      status: "tentative",
      uncertainty_reason:
        "Observed wording is not proof of a persistent belief.",
      evidence_quotes: oldEvent.supporting_response_quotes.filter(
        (q) => q.response_id === evaluation.attempt_id,
      ),
    },
  ];
  const decision = decideTutoring(content, evidence, evaluation.id, now);
  assert.equal(decision.applied.hypothesis_events[0].status, "supported");
  assert.equal(
    decision.applied.hypothesis_events[0].evidence_evaluation_ids.length,
    2,
  );
  assert.equal(decision.nextQuestionId, "D05");
  assert.ok(decision.help?.source_passage_ids.length);
});

test("stale, failed and already applied evaluations cannot choose a new activity", () => {
  const evidence = initial("ambiguous-longer");
  const evaluation = evidence.evaluations[0];
  evaluation.applied_result = {
    action: "ASK_SELF_EXPLANATION",
    hypothesis_events: [],
  };
  assert.throws(() => decideTutoring(content, evidence, evaluation.id, now));
  evaluation.applied_result = null;
  evaluation.validation_status = "evaluation_failed";
  evidence.attempts[0].current_evaluation_id = null;
  assert.throws(() => decideTutoring(content, evidence, evaluation.id, now));
});

test("fresh retests preserve diagnostic history and close as immediate performance after help", () => {
  for (const length of [3, 4]) {
    const evidence = structuredClone(authored);
    evidence.session.status = "active";
    evidence.session.ended_at = null;
    evidence.attempts[0].outcome = null;
    evidence.attempts = evidence.attempts.slice(0, length);
    evidence.interventions = evidence.interventions.filter((i) =>
      evidence.attempts.some((a) => a.id === i.related_attempt_id),
    );
    evidence.evaluations = evidence.evaluations.filter((e) =>
      evidence.attempts.some((a) => a.id === e.attempt_id),
    );
    const last = evidence.evaluations.at(-1)!;
    last.applied_result = null;
    const decision = decideTutoring(content, evidence, last.id, now);
    assert.equal(
      decision.applied.hypothesis_events.length,
      0,
      "Successful assisted work must not erase the earlier hypothesis",
    );
    if (length === 3) {
      assert.equal(decision.nextQuestionId, "D06");
      assert.equal(
        decision.help,
        null,
        "Do not reveal first retest correctness before the second",
      );
    } else {
      assert.equal(decision.outcome, "correct_after_feedback");
      assert.equal(decision.nextQuestionId, null);
      assert.match(decision.help!.text_shown, /after feedback/);
    }
  }
});

test("unsupported input has one bounded repeat without a hypothesis or an invented grade", () => {
  const evidence = initial("unrelated-request");
  const first = evidence.attempts[0];
  const evaluation = evidence.evaluations[0];
  const repeatedId = "50000000-0000-4000-8000-000000000099";
  const repeatedEvaluationId = "60000000-0000-4000-8000-000000000099";
  evidence.attempts.push({
    ...first,
    id: repeatedId,
    parent_attempt_id: first.id,
    sequence_index: 1,
    current_evaluation_id: repeatedEvaluationId,
  });
  const repeated = structuredClone(evaluation);
  repeated.id = repeatedEvaluationId;
  repeated.attempt_id = repeatedId;
  repeated.result!.evidence_quotes = repeated.result!.evidence_quotes.map(
    (quote) => ({ ...quote, response_id: repeatedId }),
  );
  evidence.evaluations.push(repeated);
  const decision = decideTutoring(content, evidence, repeated.id, now);
  assert.equal(decision.outcome, "unevaluated");
  assert.equal(decision.nextQuestionId, null);
  assert.equal(decision.applied.hypothesis_events.length, 0);
});

test("a reviewed neutral diagnostic tests an error without inventing a hypothesis", () => {
  const lesson = structuredClone(content);
  lesson.sequence.hypothesis_id = null;
  lesson.sequence.diagnostic_options = [
    { misconception_id: null, question_id: "D02" },
  ];
  const evidence = initial("different-transmission-error");
  evidence.evaluations[0].result!.misconception_candidates = [];
  const decision = decideTutoring(
    lesson,
    evidence,
    evidence.evaluations[0].id,
    now,
  );
  assert.equal(decision.nextQuestionId, "D02");
  assert.equal(decision.applied.action, "ASK_DIAGNOSTIC_FOLLOWUP");
  assert.deepEqual(decision.applied.hypothesis_events, []);

  const ambiguous = initial("ambiguous-longer");
  assert.equal(
    decideTutoring(lesson, ambiguous, ambiguous.evaluations[0].id, now).applied
      .action,
    "ASK_SELF_EXPLANATION",
    "Ambiguity must not become a diagnostic claim",
  );
  lesson.sequence.bounds.max_diagnostic_prompts = 0;
  assert.equal(
    decideTutoring(lesson, evidence, evidence.evaluations[0].id, now).applied
      .action,
    "GIVE_CORRECTIVE_FEEDBACK",
    "A neutral diagnostic obeys the same prompt budget",
  );
});

test("multiple approved diagnostics select the matching category and question", () => {
  const lesson = structuredClone(content);
  const originalNode = lesson.sequence.nodes.find(
    (node) => node.node_id === "D02",
  )!;
  const originalQuestion = lesson.questions.get("D02")!;
  lesson.sequence.nodes.push({ ...originalNode, node_id: "D02-propagation" });
  lesson.questions.set("D02-propagation", {
    ...originalQuestion,
    question_id: "D02-propagation",
  });
  lesson.sequence.diagnostic_options = [
    {
      misconception_id: "propagation_depends_on_packet_size",
      question_id: "D02-propagation",
    },
    {
      misconception_id: "transmission_depends_on_distance",
      question_id: "D02",
    },
  ];
  const evidence = initial("explicit-distance-confusion");
  const decision = decideTutoring(
    lesson,
    evidence,
    evidence.evaluations[0].id,
    now,
  );
  assert.equal(decision.nextQuestionId, "D02-propagation");
  assert.equal(decision.applied.hypothesis_events.length, 1);
  assert.equal(
    decision.applied.hypothesis_events[0].misconception_id,
    "propagation_depends_on_packet_size",
  );
});

test("neutral diagnostic results do not promote a category from unrelated evidence", () => {
  const lesson = structuredClone(content);
  lesson.sequence.hypothesis_id = null;
  lesson.sequence.diagnostic_options = [
    { misconception_id: null, question_id: "D02" },
  ];
  const evidence = structuredClone(authored);
  evidence.session.status = "active";
  evidence.session.ended_at = null;
  evidence.attempts = evidence.attempts.slice(0, 2);
  evidence.attempts[0].outcome = null;
  evidence.interventions = [];
  evidence.evaluations = evidence.evaluations.filter((evaluation) =>
    evidence.attempts.some((attempt) => attempt.id === evaluation.attempt_id),
  );
  for (const evaluation of evidence.evaluations) {
    if (evaluation.applied_result)
      evaluation.applied_result.hypothesis_events = [];
    evaluation.result!.misconception_candidates = [];
  }
  const current = evidence.evaluations.at(-1)!;
  current.applied_result = null;
  const decision = decideTutoring(lesson, evidence, current.id, now);
  assert.deepEqual(decision.applied.hypothesis_events, []);
  assert.equal(decision.applied.action, "GIVE_CORRECTIVE_FEEDBACK");
});

test("arithmetic feedback does not assume the lesson is about networking", () => {
  const evidence = initial("correct-model-arithmetic-error");
  const decision = decideTutoring(
    content,
    evidence,
    evidence.evaluations[0].id,
    now,
  );
  assert.ok(decision.help);
  assert.match(
    decision.help.text_shown,
    /^Your explanation of .* was correct\.|^Check the arithmetic/,
  );
  assert.doesNotMatch(
    decision.help.text_shown,
    /Your reasoning separates the two delays/,
  );
});
