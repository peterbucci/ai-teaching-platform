import assert from "node:assert/strict";
import test from "node:test";
import { buildClassFixture } from "../lib/evidence/class-fixture.ts";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { validateSessionEvidence } from "../lib/evidence/rules.ts";
import { calculatePatterns } from "../lib/teacher/patterns.ts";

const content = loadApprovedContent();
const fixture = buildClassFixture(content);
const roster = fixture.enrollments.map((e) => e.student_id);
const approved = new Set(content.misconceptions.keys());
const target = content.sequence.hypothesis_id;

test("a contradictory follow-up changes one student's status, retaining two students and earlier evidence", () => {
  const complete = fixture.sessions.filter((s) =>
    s.evaluations.some((e) =>
      e.applied_result?.hypothesis_events.some(
        (h) => h.status === "not_supported",
      ),
    ),
  );
  assert.equal(complete.length, 2);
  const initial = complete.map((s) => {
    const copy = structuredClone(s);
    copy.attempts = copy.attempts.slice(0, 1);
    copy.evaluations = copy.evaluations.slice(0, 1);
    copy.session.status = "active";
    copy.session.ended_at = null;
    return validateSessionEvidence(content, copy);
  });
  const before = calculatePatterns(roster, approved, initial).find(
    (g) => g.misconception_id === target,
  )!;
  assert.deepEqual(before.counts, {
    suspected: 2,
    supported: 0,
    not_supported: 0,
    uncertain: 0,
  });
  const input = [complete[0], initial[1]];
  const preserved = JSON.stringify(input);
  const after = calculatePatterns(roster, approved, input).find(
    (g) => g.misconception_id === target,
  )!;
  assert.deepEqual(after.counts, {
    suspected: 1,
    supported: 0,
    not_supported: 1,
    uncertain: 0,
  });
  assert.equal(after.students.length, 2);
  assert.equal(after.denominator, 24);
  const changed = after.students.find(
    (s) => s.current.status === "not_supported",
  )!;
  assert.equal(changed.history.length, 2);
  assert.equal(changed.history[0].status, "suspected");
  assert.equal(changed.current.contradicting_evaluation_ids.length, 1);
  assert.equal(changed.current.supporting_evaluation_ids.length, 1);
  assert.equal(JSON.stringify(input), preserved);
});

test("class patterns distinguish status, unknown responses, missing activity and origin scope", () => {
  const groups = calculatePatterns(roster, approved, fixture.sessions);
  const known = groups.find((g) => g.misconception_id === target)!;
  assert.deepEqual(known.counts, {
    suspected: 1,
    supported: 4,
    not_supported: 2,
    uncertain: 1,
  });
  assert.equal(known.students.length, 8);
  assert.equal(known.students.filter((s) => s.history.length > 1).length, 7);
  const unknown = groups.filter(
    (g) => g.misconception_id === "other_or_uncertain",
  );
  assert.equal(unknown.length, 2);
  assert.equal(
    unknown.find((g) => g.concept_id === "transmission_delay")?.counts
      .uncertain,
    1,
  );
  // The inconclusive distance diagnostic also leaves propagation uncertain,
  // although its named hypothesis belongs only to transmission.
  assert.equal(
    unknown.find((g) => g.concept_id === "propagation_delay")?.counts.uncertain,
    2,
  );
  assert.ok(
    unknown.every((g) =>
      g.students.every((s) => s.current.basis === "uncategorized_response"),
    ),
  );
  assert.ok(groups.every((g) => g.students.length > 0));
  assert.deepEqual(
    calculatePatterns(
      roster,
      approved,
      fixture.sessions.filter((s) => s.session.data_origin === "live_demo"),
    ),
    [],
  );
  assert.throws(
    () =>
      calculatePatterns(roster, approved, [
        fixture.sessions[0],
        fixture.sessions[0],
      ]),
    /Duplicate/,
  );
  assert.throws(
    () => calculatePatterns([], approved, fixture.sessions),
    /outside/,
  );
  assert.throws(
    () => calculatePatterns(roster, new Set(), fixture.sessions),
    /Unapproved/,
  );
});

test("model candidates are tentative and never double-count an applied hypothesis", () => {
  const copy = structuredClone(fixture.sessions[0]);
  const evaluation = copy.evaluations[0];
  const event = evaluation.applied_result!.hypothesis_events[0];
  evaluation.result!.misconception_candidates = [
    {
      concept_id: event.concept_id,
      misconception_id: event.misconception_id,
      status: "tentative",
      evidence_quotes: event.supporting_response_quotes,
      uncertainty_reason: "Needs a follow-up; not a confirmed belief.",
    },
  ];
  validateSessionEvidence(content, copy);
  const group = calculatePatterns(roster, approved, [copy])[0];
  assert.equal(group.students.length, 1);
  assert.equal(group.students[0].history.length, 2);
  assert.equal(group.counts.supported, 1);
  // Before the controller applies a result, the same candidate is only suspected.
  copy.attempts = copy.attempts.slice(0, 1);
  copy.attempts[0].outcome = null;
  copy.evaluations = copy.evaluations.slice(0, 1);
  evaluation.applied_result = null;
  copy.interventions = [];
  copy.session.status = "active";
  copy.session.ended_at = null;
  validateSessionEvidence(content, copy);
  const candidate = calculatePatterns(roster, approved, [copy])[0];
  assert.equal(candidate.counts.suspected, 1);
  assert.equal(candidate.counts.supported, 0);
  assert.equal(candidate.students[0].current.basis, "tentative_candidate");
});
