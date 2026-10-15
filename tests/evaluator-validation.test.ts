import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  EvaluationSchema,
  MisconceptionCandidateSchema,
} from "../lib/evidence/contracts.ts";
import type { Evaluation } from "../lib/evidence/contracts.ts";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { buildDemoFixture } from "../lib/evidence/demo.ts";
import { validateEvaluationReferences } from "../lib/evidence/rules.ts";

const content = loadApprovedContent();

function example() {
  const prepared = buildDemoFixture(content).sessions[0];
  const attempt = {
    ...prepared.attempts[0],
    response_text: "🔎 Both double because the distance doubles.",
  };
  const quote = {
    response_id: attempt.id,
    quote: "Both double because the distance doubles.",
    start_character: 2,
    end_character: Array.from(attempt.response_text).length,
    interpretation: "Explicitly applies the distance change to both delays.",
  };
  const candidate = MisconceptionCandidateSchema.parse({
    concept_id: "transmission_delay",
    misconception_id: "transmission_depends_on_distance",
    status: "tentative",
    evidence_quotes: [quote],
    uncertainty_reason:
      "One explanation suggests the causal rule but needs a separate diagnostic response.",
  });
  const original = prepared.evaluations[0];
  assert.ok(original.result);
  const evaluation = EvaluationSchema.parse({
    ...original,
    result: {
      ...original.result,
      evidence_quotes: [quote],
      misconception_candidates: [candidate],
    },
    applied_result: null,
  });
  return { attempt, evaluation, candidate };
}

test("tentative candidates retain exact Unicode response evidence without applying a hypothesis", () => {
  const { attempt, evaluation, candidate } = example();
  validateEvaluationReferences(content, evaluation, attempt, [attempt]);
  assert.equal(evaluation.applied_result, null);
  assert.equal(candidate.evidence_quotes[0].start_character, 2);
  assert.deepEqual(
    evaluation.result?.per_concept_results.map((item) => item.correctness),
    ["incorrect", "correct"],
  );

  const stored = buildDemoFixture(content).sessions[0].evaluations[0];
  assert.ok(stored.result);
  assert.equal("misconception_candidates" in stored.result, false);
  assert.deepEqual(EvaluationSchema.parse(stored), stored);
});

test("candidate contracts reject confirmed diagnoses, missing support and missing uncertainty", () => {
  const { candidate } = example();
  for (const invalid of [
    { ...candidate, status: "confirmed" },
    { ...candidate, status: "supported" },
    { ...candidate, evidence_quotes: [] },
    { ...candidate, uncertainty_reason: " " },
  ]) {
    assert.equal(
      MisconceptionCandidateSchema.safeParse(invalid).success,
      false,
    );
  }
});

test("candidate grounding rejects unknown, mismatched and duplicate categories and fabricated response evidence", () => {
  const { attempt, evaluation, candidate } = example();
  assert.ok(evaluation.result);
  const result = evaluation.result;
  function validate(candidates: unknown) {
    const changed: Evaluation = EvaluationSchema.parse({
      ...evaluation,
      result: { ...result, misconception_candidates: candidates },
    });
    validateEvaluationReferences(content, changed, attempt, [attempt]);
  }
  assert.throws(() =>
    validate([{ ...candidate, misconception_id: "invented_category" }]),
  );
  assert.throws(() =>
    validate([
      { ...candidate, misconception_id: "propagation_depends_on_packet_size" },
    ]),
  );
  assert.throws(() =>
    validate([{ ...candidate, concept_id: "queuing_delay" }]),
  );
  assert.throws(() => validate([candidate, candidate]));
  const quote = candidate.evidence_quotes[0];
  assert.throws(() =>
    validate([
      {
        ...candidate,
        evidence_quotes: [{ ...quote, response_id: randomUUID() }],
      },
    ]),
  );
  assert.throws(() =>
    validate([
      {
        ...candidate,
        evidence_quotes: [{ ...quote, quote: "Transmission is unchanged." }],
      },
    ]),
  );
  assert.throws(() =>
    validate([
      {
        ...candidate,
        evidence_quotes: [
          {
            ...quote,
            start_character: 3,
            end_character: quote.end_character + 1,
          },
        ],
      },
    ]),
  );
});
