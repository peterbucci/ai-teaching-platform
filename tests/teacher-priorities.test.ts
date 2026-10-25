import assert from "node:assert/strict";
import test from "node:test";
import { buildDemoFixture } from "../lib/evidence/demo.ts";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { calculateClassMetrics } from "../lib/teacher/metrics.ts";
import {
  canPrepareFromRow,
  evidenceResult,
  teacherEvidenceRows,
  teachingPriorities,
  type EvidenceSnapshot,
} from "../app/teacher/evidence/model.ts";

const content = loadApprovedContent();
function snapshot(): EvidenceSnapshot {
  const fixture = buildDemoFixture(content);
  const students = fixture.enrollments.map((enrollment) => ({
    student_id: enrollment.student_id,
    display_name: fixture.profiles.find(
      (profile) => profile.id === enrollment.student_id,
    )!.display_name,
  }));
  return {
    students,
    evidence: fixture.sessions,
    metrics: calculateClassMetrics(
      students.map((student) => student.student_id),
      [...content.concept_ids],
      fixture.sessions,
    ),
  };
}
function recount(value: EvidenceSnapshot) {
  value.metrics = calculateClassMetrics(
    value.students.map((student) => student.student_id),
    [...content.concept_ids],
    value.evidence,
  );
}

test("a newer empty session cannot hide the exact saved assessed response", () => {
  const input = snapshot();
  const saved = input.evidence[1];
  input.evidence.push({
    session: {
      ...saved.session,
      id: "41000000-0000-4000-8000-000000000099",
      status: "active",
      started_at: "2026-10-25T10:00:00Z",
      ended_at: null,
    },
    attempts: [],
    evaluations: [],
    interventions: [],
  });
  recount(input);
  const before = JSON.stringify(input);
  const rows = teacherEvidenceRows(input);
  const row = rows.find((item) => item.attempt.id === saved.attempts[0].id)!;
  assert.equal(row.session_id, saved.session.id);
  assert.equal(row.evaluation?.id, saved.attempts[0].current_evaluation_id);
  assert.equal(row.attempt.response_text, saved.attempts[0].response_text);
  assert.deepEqual(
    row.attempt.question.content_ref,
    saved.attempts[0].question.content_ref,
  );
  assert.equal(JSON.stringify(input), before);
});

test("a failed retry does not replace an accepted evaluation or its preparation eligibility", () => {
  const input = snapshot();
  const saved = input.evidence[1];
  const accepted = saved.evaluations[0];
  saved.evaluations.push({
    ...accepted,
    id: "61000000-0000-4000-8000-000000000099",
    validation_status: "evaluation_failed",
    result: null,
    applied_result: null,
    evaluated_at: "2026-10-25T10:00:00Z",
    failure_reason: "Fixture timeout",
  });
  recount(input);
  const row = teacherEvidenceRows(input).find(
    (item) => item.attempt.id === accepted.attempt_id,
  )!;
  assert.equal(row.evaluation?.id, accepted.id);
  assert.equal(evidenceResult(row, "transmission_delay"), "correct");
  assert.equal(canPrepareFromRow(row, "transmission_delay"), true);
  assert.equal(canPrepareFromRow(row, "unapproved_concept"), false);
});

test("a newer submitted answer awaiting evaluation has its own priority and never borrows an old grade", () => {
  const input = snapshot();
  const saved = input.evidence[1];
  const original = saved.attempts[0];
  const id = "51000000-0000-4000-8000-000000000099";
  saved.attempts.push({
    ...original,
    id,
    sequence_index: original.sequence_index + 1,
    root_attempt_id: id,
    outcome: null,
    presented_at: "2026-10-25T10:00:00Z",
    submitted_at: "2026-10-25T10:01:00Z",
    current_evaluation_id: null,
    response_text: "My new reasoning is saved, but not evaluated.",
  });
  recount(input);
  const priority = teachingPriorities(input).find(
    (item) => item.concept_id === "transmission_delay",
  )!;
  assert.equal(priority.kind, "evaluation");
  assert.equal(priority.count, 1);
  assert.equal(priority.row?.attempt.id, id);
  assert.equal(priority.row?.evaluation, undefined);
  assert.equal(evidenceResult(priority.row!), "Awaiting evaluation");
  assert.equal(canPrepareFromRow(priority.row!, "transmission_delay"), false);
  assert.ok(
    teacherEvidenceRows(input).some(
      (item) =>
        item.attempt.id === original.id &&
        item.evaluation?.validation_status === "accepted",
    ),
  );
});

test("historical difficulty is not presented as current incorrectness and correct follow-ups retain assistance", () => {
  const input = snapshot();
  const original = JSON.stringify(input);
  const priority = teachingPriorities(input).find(
    (item) => item.concept_id === "transmission_delay",
  )!;
  assert.equal(priority.kind, "followup");
  assert.equal(priority.count, 1);
  assert.equal(priority.denominator, 2);
  assert.equal(priority.metric.latest.correct, 2);
  const rows = teacherEvidenceRows(input);
  assert.ok(
    rows.some(
      (row) => evidenceResult(row, "transmission_delay") === "incorrect",
    ),
  );
  assert.ok(
    rows.some(
      (row) =>
        evidenceResult(row, "transmission_delay") === "correct" &&
        row.attempt.assistance?.assistance_level !== "none_recorded",
    ),
  );
  assert.equal(JSON.stringify(input), original);
});

test("no activity or a filtered-out origin never creates a learning concern", () => {
  const input = snapshot();
  input.evidence = input.evidence.filter(
    (item) => item.session.data_origin === "live_demo",
  );
  recount(input);
  assert.equal(input.metrics.no_activity_students, input.students.length);
  assert.deepEqual(teacherEvidenceRows(input), []);
  assert.deepEqual(teachingPriorities(input), []);
});

test("a learning concern never hides unresolved evaluations for the same concept", () => {
  const input = snapshot();
  const [learner, pendingLearner] = input.evidence;
  learner.attempts = learner.attempts.slice(0, 1);
  learner.evaluations = learner.evaluations.filter(
    (item) => item.attempt_id === learner.attempts[0].id,
  );
  pendingLearner.attempts[0].current_evaluation_id = null;
  pendingLearner.evaluations = [];
  recount(input);
  const entries = teachingPriorities(input).filter(
    (item) => item.concept_id === "transmission_delay",
  );
  assert.deepEqual(
    entries.map((item) => item.kind),
    ["review", "evaluation"],
  );
  assert.deepEqual(
    entries.map((item) => item.count),
    [1, 1],
  );
  assert.equal(entries[0].row?.attempt.id, learner.attempts[0].id);
  assert.equal(entries[1].row?.attempt.id, pendingLearner.attempts[0].id);
});

test("historical follow-up opens the latest response of a student with repeated difficulty", () => {
  const input = snapshot();
  const [repeatedLearner, independentLearner] = input.evidence;
  // Another student's later correct submission must not steal this investigation.
  independentLearner.attempts[0].submitted_at = "2026-10-25T10:00:00Z";
  independentLearner.evaluations[0].evaluated_at = "2026-10-25T10:01:00Z";
  recount(input);
  const priority = teachingPriorities(input).find(
    (item) => item.concept_id === "transmission_delay",
  )!;
  const latestRepeatedResponse = teacherEvidenceRows(input).find(
    (row) =>
      row.student_id === repeatedLearner.session.student_id &&
      row.attempt.question.concept_ids.includes("transmission_delay"),
  )!;
  assert.equal(priority.kind, "followup");
  assert.equal(priority.row?.student_id, repeatedLearner.session.student_id);
  assert.equal(priority.row?.attempt.id, latestRepeatedResponse.attempt.id);
  assert.equal(evidenceResult(priority.row!, "transmission_delay"), "correct");
  assert.notEqual(
    priority.row?.attempt.assistance?.assistance_level,
    "none_recorded",
  );
});

test("inspection links use the current URL selection instead of stale rendered seeds, including clearing all", async () => {
  const { evidenceNavigationHref } =
    await import("../app/teacher/evidence/model.ts");
  const { parseTeacherWorkspaceContext, teacherWorkspaceHref } =
    await import("../lib/teacher/workspace-contracts.ts");
  const input = snapshot();
  const rows = teacherEvidenceRows(input);
  const [first, second, third] = rows;
  const context = parseTeacherWorkspaceContext({
    assignment: input.evidence[0].session.assignment_id,
    origin: "all",
    concept: "transmission_delay",
    session: first.session_id,
    attempt: first.attempt.id,
    evaluation: first.evaluation?.id,
    seedAttempt: [first.attempt.id],
    returnTo: "evidence",
  });
  for (const path of [
    `/teacher/sessions/${first.session_id}`,
    "/teacher/evidence",
    "/teacher/insights",
  ]) {
    const initial =
      teacherWorkspaceHref(path, context) + "#recorded-observation";
    const changed = new URL(
      evidenceNavigationHref(initial, [second.attempt.id, third.attempt.id]),
      "https://example.test",
    );
    assert.deepEqual(changed.searchParams.getAll("seedAttempt"), [
      second.attempt.id,
      third.attempt.id,
    ]);
    assert.equal(changed.searchParams.get("attempt"), first.attempt.id);
    assert.equal(
      changed.searchParams.get("evaluation"),
      first.evaluation?.id ?? null,
    );
    assert.equal(changed.hash, "#recorded-observation");
    const cleared = new URL(
      evidenceNavigationHref(initial, []),
      "https://example.test",
    );
    assert.deepEqual(cleared.searchParams.getAll("seedAttempt"), []);
  }
  const explicit = teacherWorkspaceHref("/teacher/interventions", context, {
    seedAttempt: [first.attempt.id],
  });
  assert.equal(
    evidenceNavigationHref(
      explicit,
      [second.attempt.id, third.attempt.id],
      false,
    ),
    explicit,
  );
});
