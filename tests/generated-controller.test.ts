import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { buildDemoFixture } from "../lib/evidence/demo.ts";
import {
  QuestionSnapshotSchema,
  type SessionEvidence,
} from "../lib/evidence/contracts.ts";
import { toStudentSessionView } from "../lib/evidence/rules.ts";
import type { GeneratedDialogue } from "../lib/dialogue/contracts.ts";
import { decideTutoring } from "../lib/tutoring/decide.ts";
import {
  bindGeneratedQuestion,
  controllerNode,
} from "../lib/tutoring/generated-question.ts";

const content = loadApprovedContent();
const authored = buildDemoFixture(content).sessions[0];
const now = "2026-10-18T12:00:00Z";
function episode(length: number): SessionEvidence {
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
  const evaluation = evidence.evaluations.at(-1)!;
  const event = evaluation.applied_result?.hypothesis_events.at(-1);
  if (event)
    evaluation.result!.misconception_candidates = [
      {
        concept_id: event.concept_id,
        misconception_id: event.misconception_id,
        status: "tentative",
        uncertainty_reason:
          "Synthetic observation, not proof of a stable belief.",
        evidence_quotes: event.supporting_response_quotes.filter(
          (quote) => quote.response_id === evaluation.attempt_id,
        ),
      },
    ];
  evaluation.applied_result = null;
  return evidence;
}
function candidate(
  slot: string,
): Extract<GeneratedDialogue, { kind: "question" }> {
  const authoredQuestion = content.questions.get(slot)!;
  const id = randomUUID();
  return {
    kind: "question",
    content_id: id,
    intent: content.sequence.nodes.find((n) => n.node_id === slot)!.kind as
      "diagnostic_followup" | "neutral_clarification" | "immediate_retest",
    target_misconception_ids: [],
    question: {
      ...structuredClone(authoredQuestion),
      origin: "generated",
      question_id: id,
      sequence_id: null,
      prompt_text: `A new conceptual probe for approved activity ${slot}. Explain the relevant relationship.`,
      generation: {
        model: "synthetic_fixture",
        prompt_template_version: "test",
        generated_at: now,
      },
    },
  };
}
function replaceWithGenerated(evidence: SessionEvidence, index: number) {
  const attempt = evidence.attempts[index];
  const slot = attempt.question.question_id!;
  const generated = candidate(slot);
  attempt.question = {
    ...generated.question,
    // This test isolates controller continuation after the reviewed commit.
    sequence_id: content.sequence_id,
    controller_node_id: slot,
  };
}

test("reviewed generated diagnostic binds its UUID to the existing authored controller slot without changing the candidate", () => {
  const evidence = episode(1);
  const decision = decideTutoring(
    content,
    evidence,
    evidence.evaluations[0].id,
    now,
  );
  assert.equal(decision.applied.action, "ASK_DIAGNOSTIC_FOLLOWUP");
  const generated = candidate(decision.nextQuestionId!);
  const before = structuredClone(generated);
  const bound = bindGeneratedQuestion(content, evidence, decision, generated);
  assert.equal(bound.controller_node_id, decision.nextQuestionId);
  assert.equal(bound.question_id, generated.content_id);
  assert.deepEqual(bound.rubric, generated.question.rubric);
  assert.deepEqual(generated, before);
  assert.notEqual(bound.question_id, bound.controller_node_id);
});

test("generated diagnostic and both retests continue through the existing decision/evidence path", () => {
  for (const length of [2, 3, 4]) {
    const evidence = episode(length);
    for (let index = 1; index < length; index++)
      replaceWithGenerated(evidence, index);
    const last = evidence.evaluations.at(-1)!;
    const decision = decideTutoring(content, evidence, last.id, now);
    assert.equal(
      decision.nextQuestionId,
      length === 2 ? "D05" : length === 3 ? "D06" : null,
    );
    if (length === 4) assert.equal(decision.outcome, "correct_after_feedback");
    const visible = JSON.stringify(toStudentSessionView(evidence));
    assert.ok(!visible.includes('"rubric"'));
    assert.ok(!visible.includes('"controller_node_id"'));
    assert.ok(!visible.includes('"generation"'));
  }
});

test("generated diagnostics never receive an authored numerical worked example for different inputs", () => {
  const evidence = episode(2);
  replaceWithGenerated(evidence, 1);
  const evaluation = evidence.evaluations.at(-1)!;
  evaluation.result!.misconception_candidates = [];
  for (const judgment of evaluation.result!.per_concept_results) {
    judgment.correctness = "partially_correct";
    judgment.error_type = "arithmetic_or_units";
  }
  const decision = decideTutoring(content, evidence, evaluation.id, now);
  assert.equal(decision.help?.type, "corrective_feedback");
  assert.match(decision.help!.text_shown, /Check the arithmetic and units/);
});

test("binding rejects model-chosen slots, wrong intent, missing assessed concepts and changed source", () => {
  const evidence = episode(1);
  const decision = decideTutoring(
    content,
    evidence,
    evidence.evaluations[0].id,
    now,
  );
  const generated = candidate(decision.nextQuestionId!);
  for (const mutate of [
    (value: typeof generated) => {
      value.question.controller_node_id = "D06";
    },
    (value: typeof generated) => {
      value.intent = "immediate_retest";
    },
    (value: typeof generated) => {
      value.question.concept_ids.pop();
    },
    (value: typeof generated) => {
      value.question.content_ref.content_version = "other-version";
    },
    (value: typeof generated) => {
      value.question.prompt_text = evidence.attempts[0].question.prompt_text;
    },
  ]) {
    const changed = structuredClone(generated);
    mutate(changed);
    assert.throws(() =>
      bindGeneratedQuestion(content, evidence, decision, changed),
    );
  }
  const curated = {
    ...content.questions.get("D02")!,
    controller_node_id: "D02",
  };
  assert.equal(QuestionSnapshotSchema.safeParse(curated).success, false);
});

test("unbound or mismatched generated activities cannot enter controller continuation", () => {
  const evidence = episode(2);
  replaceWithGenerated(evidence, 1);
  const attempt = evidence.attempts[1];
  const saved = attempt.question.controller_node_id;
  delete attempt.question.controller_node_id;
  assert.throws(() => controllerNode(content, attempt));
  attempt.question.controller_node_id = "D06";
  assert.throws(() => controllerNode(content, attempt));
  attempt.question.controller_node_id = saved;
  assert.equal(controllerNode(content, attempt).node_id, "D02");
});

test("generated UUIDs cannot reset the controller's unsupported-response retry bound", () => {
  const evidence = episode(2);
  replaceWithGenerated(evidence, 1);
  const first = evidence.attempts[1];
  const oldEvaluation = evidence.evaluations.at(-1)!;
  oldEvaluation.applied_result = {
    action: "ASK_RETRIEVAL_QUESTION",
    hypothesis_events: [],
  };
  const newId = randomUUID();
  const evaluationId = randomUUID();
  const repeated = {
    ...structuredClone(first),
    id: newId,
    parent_attempt_id: first.id,
    sequence_index: 2,
    current_evaluation_id: evaluationId,
  };
  // Even a different generated UUID cannot manufacture another diagnostic slot.
  repeated.question.question_id = randomUUID();
  evidence.attempts.push(repeated);
  const evaluation = structuredClone(oldEvaluation);
  evaluation.id = evaluationId;
  evaluation.attempt_id = newId;
  evaluation.applied_result = null;
  evaluation.result!.misconception_candidates = [];
  evaluation.result!.evidence_quotes = evaluation.result!.evidence_quotes.map(
    (quote) => ({ ...quote, response_id: newId }),
  );
  evaluation.result!.uncertainty_reason = "Unrelated synthetic response.";
  for (const judgment of evaluation.result!.per_concept_results) {
    judgment.correctness = "uncertain";
    judgment.error_type = "insufficient_response";
  }
  evidence.evaluations.push(evaluation);
  const decision = decideTutoring(content, evidence, evaluationId, now);
  assert.equal(decision.applied.action, "END_SESSION");
  assert.equal(decision.outcome, "unevaluated");
});

test("generated assessed prompts cannot carry assistance before a question-display acknowledgment exists", () => {
  const evidence = episode(1);
  const decision = decideTutoring(
    content,
    evidence,
    evidence.evaluations[0].id,
    now,
  );
  const generated = candidate(decision.nextQuestionId!);
  generated.question.embedded_scaffolding = [
    {
      type: "supplied_relationship",
      concept_ids: [...generated.question.concept_ids],
      supplied_content: "A supplied relationship would be content assistance.",
      affected_rubric_criteria: [],
    },
  ];
  assert.throws(() =>
    bindGeneratedQuestion(content, evidence, decision, generated),
  );
  assert.equal(content.questions.get("D02")!.origin, "curated");
});
