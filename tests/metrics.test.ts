import assert from "node:assert/strict";
import test from "node:test";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { buildDemoFixture, DEMO_IDS } from "../lib/evidence/demo.ts";
import { calculateClassMetrics } from "../lib/teacher/metrics.ts";
import { validateSessionEvidence } from "../lib/evidence/rules.ts";
const content = loadApprovedContent();
const fixture = buildDemoFixture(content);
const roster = fixture.enrollments.map((e) => e.student_id);
const concepts = [...content.concept_ids];

test("metrics count students once and separate initial, assisted and immediate evidence", () => {
  const result = calculateClassMetrics(roster, concepts, fixture.sessions);
  assert.deepEqual(result.participation, { numerator: 2, denominator: 3 });
  assert.equal(result.no_activity_students, 1);
  const tx = result.concepts.find(
    (c) => c.concept_id === "transmission_delay",
  )!;
  assert.deepEqual(tx.latest.correct_rate, { numerator: 2, denominator: 2 });
  assert.deepEqual(tx.independent.correct_rate, {
    numerator: 1,
    denominator: 2,
  });
  assert.deepEqual(tx.content_assisted.correct_rate, {
    numerator: 1,
    denominator: 1,
  });
  assert.deepEqual(tx.immediate_retest.correct_rate, {
    numerator: 1,
    denominator: 1,
  });
  assert.deepEqual(tx.delayed_review.correct_rate, {
    numerator: 0,
    denominator: 0,
  });
  assert.deepEqual(tx.repeated_difficulty, { numerator: 1, denominator: 2 });
  assert.deepEqual(
    calculateClassMetrics(roster, concepts, fixture.sessions, "live_demo")
      .participation,
    { numerator: 0, denominator: 3 },
  );
});
test("new pending evidence stays visible; failed grading cannot erase an accepted judgment", () => {
  const evidence = structuredClone(fixture.sessions);
  const latest = evidence[1].attempts[0];
  const accepted = evidence[1].evaluations[0];
  evidence[1].evaluations.push({
    ...accepted,
    id: "61000000-0000-4000-8000-000000000099",
    validation_status: "evaluation_failed",
    result: null,
    applied_result: null,
    evaluated_at: "2026-10-16T10:00:00Z",
    failure_reason: "Fixture provider failure",
  });
  let tx = calculateClassMetrics(roster, concepts, evidence).concepts.find(
    (c) => c.concept_id === "transmission_delay",
  )!;
  assert.equal(tx.latest.correct, 2);
  latest.current_evaluation_id = null;
  evidence[1].evaluations = [];
  tx = calculateClassMetrics(roster, concepts, evidence).concepts.find(
    (c) => c.concept_id === "transmission_delay",
  )!;
  assert.equal(tx.latest.pending, 1);
  assert.equal(tx.latest.no_response, 1);
  assert.deepEqual(tx.latest.correct_rate, { numerator: 1, denominator: 1 });
  evidence[1].evaluations = [
    {
      ...accepted,
      validation_status: "accepted",
      applied_result: null,
      result: {
        ...accepted.result!,
        per_concept_results: accepted.result!.per_concept_results.map((j) => ({
          ...j,
          correctness: "uncertain",
          error_type: "terminology_or_ambiguity",
        })),
        uncertainty_reason: "Unclear fixture response",
      },
    },
  ];
  latest.current_evaluation_id = accepted.id;
  tx = calculateClassMetrics(roster, concepts, evidence).concepts.find(
    (c) => c.concept_id === "transmission_delay",
  )!;
  assert.equal(tx.latest.uncertain, 1);
  assert.deepEqual(tx.latest.correct_rate, { numerator: 1, denominator: 2 });
});
test("one added live student's evidence changes only assessed concepts and respects origin filtering", () => {
  const original = fixture.sessions[1];
  const remapped = new Map([
    [original.session.id, "41000000-0000-4000-8000-000000000099"],
    [original.attempts[0].id, "51000000-0000-4000-8000-000000000099"],
    [original.evaluations[0].id, "61000000-0000-4000-8000-000000000099"],
  ]);
  const added = validateSessionEvidence(
    content,
    JSON.parse(
      JSON.stringify(original, (_key, value: unknown) =>
        typeof value === "string" ? (remapped.get(value) ?? value) : value,
      ),
    ),
  );
  added.session.id = "41000000-0000-4000-8000-000000000099";
  added.session.student_id = DEMO_IDS.inactiveStudent;
  added.session.data_origin = "live_demo";
  const before = calculateClassMetrics(roster, concepts, fixture.sessions);
  const after = calculateClassMetrics(roster, concepts, [
    ...fixture.sessions,
    added,
  ]);
  assert.deepEqual(after.participation, { numerator: 3, denominator: 3 });
  for (const concept of after.concepts) {
    if (added.attempts[0].question.concept_ids.includes(concept.concept_id))
      assert.equal(concept.latest.correct, 3);
    else
      assert.deepEqual(
        concept,
        before.concepts.find((c) => c.concept_id === concept.concept_id),
      );
  }
  assert.deepEqual(
    calculateClassMetrics(
      roster,
      concepts,
      [...fixture.sessions, added],
      "synthetic_fixture",
    ),
    { ...before, origin_filter: "synthetic_fixture" },
  );
  assert.throws(
    () => calculateClassMetrics([roster[0]], concepts, fixture.sessions),
    /outside the roster/,
  );
  assert.throws(
    () =>
      calculateClassMetrics(roster, concepts, [
        ...fixture.sessions,
        fixture.sessions[0],
      ]),
    /Duplicate session/,
  );
});
