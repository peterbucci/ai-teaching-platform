import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { buildClassFixture } from "../lib/evidence/class-fixture.ts";
import {
  getCuratedQuestion,
  loadApprovedContent,
} from "../lib/evidence/content.ts";
import {
  deriveAssistance,
  validateSessionEvidence,
} from "../lib/evidence/rules.ts";
import { hydrateLessonContent } from "../lib/lessons/validate.ts";
import { calculateClassMetrics } from "../lib/teacher/metrics.ts";
import { calculatePatterns } from "../lib/teacher/patterns.ts";
import {
  makeTeacherLesson,
  makeTeacherSourceReference,
} from "./fixtures/teacher-lesson.ts";

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
  assert.ok(
    changed.history.every((h) => h.data_origin === "synthetic_fixture"),
  );
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
  const unknown = groups.filter((g) => g.misconception_id === null);
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

test("named other_or_uncertain candidates and hypotheses still require approval", () => {
  const approvedWithoutOther = new Set(approved);
  approvedWithoutOther.delete("other_or_uncertain");
  for (const basis of ["candidate", "hypothesis"] as const) {
    const evidence = structuredClone(fixture.sessions[0]);
    evidence.session.status = "active";
    evidence.session.ended_at = null;
    evidence.attempts = evidence.attempts.slice(0, 1);
    evidence.attempts[0].outcome = null;
    evidence.evaluations = evidence.evaluations.slice(0, 1);
    evidence.interventions = [];
    const evaluation = evidence.evaluations[0];
    const event = evaluation.applied_result!.hypothesis_events[0];
    event.misconception_id = "other_or_uncertain";
    event.status = "uncertain";
    evaluation.result!.misconception_candidates =
      basis === "candidate"
        ? [
            {
              concept_id: event.concept_id,
              misconception_id: "other_or_uncertain",
              status: "tentative",
              evidence_quotes: event.supporting_response_quotes,
              uncertainty_reason:
                "A named reviewed category remains uncertain.",
            },
          ]
        : [];
    if (basis === "candidate") evaluation.applied_result = null;
    validateSessionEvidence(content, evidence);
    const approvedGroup = calculatePatterns(roster, approved, [evidence]).find(
      (group) => group.misconception_id === "other_or_uncertain",
    )!;
    assert.equal(approvedGroup.counts.uncertain, 1);
    assert.equal(
      approvedGroup.students[0].current.basis,
      basis === "candidate" ? "tentative_candidate" : "applied_hypothesis",
    );
    for (const allowed of [approvedWithoutOther, new Set<string>()])
      assert.throws(
        () => calculatePatterns(roster, allowed, [evidence]),
        /Unapproved misconception category/,
      );
  }
});

test("a lesson without categories keeps uncertain responses visible without inventing a hypothesis", () => {
  const lesson = hydrateLessonContent(
    makeTeacherLesson(
      makeTeacherSourceReference(randomUUID(), randomUUID()),
      randomUUID(),
      "1",
    ),
  );
  const source = fixture.sessions.find((session) =>
    session.evaluations.some(
      (evaluation) =>
        !evaluation.applied_result &&
        evaluation.result?.per_concept_results.some(
          (judgment) => judgment.correctness === "uncertain",
        ),
    ),
  )!;
  function response(text: string, submittedAt: string) {
    const evidence = structuredClone(source);
    evidence.session.id = randomUUID();
    evidence.session.status = "active";
    evidence.session.ended_at = null;
    evidence.attempts = evidence.attempts.slice(0, 1);
    evidence.evaluations = evidence.evaluations.slice(0, 1);
    evidence.interventions = [];
    const attempt = evidence.attempts[0];
    const evaluation = evidence.evaluations[0];
    attempt.id = randomUUID();
    attempt.root_attempt_id = attempt.id;
    attempt.session_id = evidence.session.id;
    attempt.question = getCuratedQuestion(lesson, "WC-01");
    attempt.submitted_at = submittedAt;
    attempt.response_text = text;
    attempt.current_evaluation_id = evaluation.id = randomUUID();
    attempt.assistance = deriveAssistance(
      attempt.question,
      attempt.intent,
      attempt.presented_at,
      submittedAt,
      [],
    );
    evaluation.attempt_id = attempt.id;
    evaluation.evaluated_at = submittedAt;
    evaluation.result!.per_concept_results = attempt.question.concept_ids.map(
      (concept_id) => ({
        concept_id,
        correctness: "uncertain",
        error_type: "insufficient_response",
        rubric_criteria_met: [],
        rubric_criteria_missing: attempt.question.rubric.criteria,
      }),
    );
    evaluation.result!.source_passage_ids = attempt.question.source_passage_ids;
    evaluation.result!.misconception_candidates = [];
    evaluation.result!.evidence_quotes = [
      {
        response_id: attempt.id,
        quote: text,
        start_character: 0,
        end_character: text.length,
        interpretation:
          "The synthetic answer does not name either state change.",
      },
    ];
    return validateSessionEvidence(lesson, evidence);
  }
  const first = response("It changes.", "2026-10-22T12:00:00Z");
  const latest = response("I am still unsure.", "2026-10-22T12:01:00Z");
  const sessions = [first, latest];
  const students = [source.session.student_id, randomUUID()];
  const preserved = structuredClone(sessions);
  const metrics = calculateClassMetrics(
    students,
    [...lesson.concept_ids],
    sessions,
  );
  const groups = calculatePatterns(students, new Set(), sessions);
  assert.equal(groups.length, 2);
  for (const group of groups) {
    assert.equal(group.misconception_id, null);
    assert.equal(group.denominator, 2);
    assert.deepEqual(group.counts, {
      suspected: 0,
      supported: 0,
      not_supported: 0,
      uncertain: 1,
    });
    assert.equal(group.students.length, 1);
    const observation = group.students[0].current;
    assert.equal(observation.misconception_id, null);
    assert.equal(observation.basis, "uncategorized_response");
    assert.equal(observation.evaluation_id, latest.evaluations[0].id);
    assert.deepEqual(
      observation.quotes,
      latest.evaluations[0].result!.evidence_quotes,
    );
    assert.deepEqual(observation.supporting_evaluation_ids, []);
    assert.deepEqual(observation.contradicting_evaluation_ids, []);
  }
  assert.deepEqual(sessions, preserved);
  assert.equal(lesson.misconceptions.size, 0);
  assert.deepEqual(
    calculateClassMetrics(students, [...lesson.concept_ids], sessions),
    metrics,
  );
  assert.ok(
    metrics.concepts.every((concept) => concept.independent.uncertain === 1),
  );
});
