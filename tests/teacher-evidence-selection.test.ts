import assert from "node:assert/strict";
import test from "node:test";
import { buildDemoFixture } from "../lib/evidence/demo.ts";
import {
  getCuratedQuestion,
  loadApprovedContent,
} from "../lib/evidence/content.ts";
import { deriveAssistance } from "../lib/evidence/rules.ts";
import { calculateClassMetrics } from "../lib/teacher/metrics.ts";
import {
  parseTeacherWorkspaceContext,
  type TeacherWorkspaceParams,
} from "../lib/teacher/workspace-contracts.ts";
import {
  teacherEvidenceRows,
  type EvidenceSnapshot,
} from "../app/teacher/evidence/model.ts";
import { resolveEvidenceSelection } from "../app/teacher/evidence/selection.ts";

const content = loadApprovedContent();
const concept = "transmission_delay";
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
function resolve(input: EvidenceSnapshot, params: TeacherWorkspaceParams) {
  return resolveEvidenceSelection(input, parseTeacherWorkspaceContext(params));
}
function differentStudents(input: EvidenceSnapshot) {
  const rows = teacherEvidenceRows(input).filter((row) =>
    row.attempt.question.concept_ids.includes(concept),
  );
  const latest = rows[0];
  const other = rows.find((row) => row.student_id !== latest.student_id)!;
  assert.ok(other);
  return { latest, other };
}

test("session-only selection opens that session's latest submitted response", () => {
  const input = snapshot();
  const { other } = differentStudents(input);
  const selection = resolve(input, { concept, session: other.session_id });
  assert.equal(selection?.selected?.attempt.id, other.attempt.id);
  assert.equal(selection?.session?.session.id, other.session_id);
  // Opening an exact response must retain the class evidence list for selection.
  assert.ok(
    selection?.visibleRows.some((row) => row.session_id !== other.session_id),
  );
});

test("student-only and matching student/session selections stay within that student", () => {
  const input = snapshot();
  const { other } = differentStudents(input);
  for (const params of [
    { concept, student: other.student_id },
    { concept, student: other.student_id, session: other.session_id },
  ]) {
    const selection = resolve(input, params);
    assert.equal(selection?.selected?.attempt.id, other.attempt.id);
    assert.ok(
      selection?.conceptRows.every(
        (row) => row.student_id === other.student_id,
      ),
    );
  }
  const inactive = input.students.find(
    (student) =>
      !input.evidence.some(
        (item) => item.session.student_id === student.student_id,
      ),
  )!;
  assert.ok(inactive);
  assert.equal(
    resolve(input, { concept, student: inactive.student_id })?.selected,
    undefined,
  );
});

test("student and session must agree even when no attempt was supplied", () => {
  const input = snapshot();
  const { latest, other } = differentStudents(input);
  assert.equal(
    resolve(input, {
      concept,
      student: latest.student_id,
      session: other.session_id,
    }),
    null,
  );
});

test("a requested empty session never falls back to another session's answer", () => {
  const input = snapshot();
  const saved = input.evidence[0];
  const emptyId = "41000000-0000-4000-8000-000000000099";
  input.evidence.push({
    session: {
      ...saved.session,
      id: emptyId,
      started_at: "2026-10-25T10:00:00Z",
      ended_at: null,
      status: "active",
    },
    attempts: [],
    evaluations: [],
    interventions: [],
  });
  for (const params of [
    { concept, session: emptyId },
    { concept, session: emptyId, student: saved.session.student_id },
  ]) {
    const selection = resolve(input, params);
    assert.ok(
      selection,
      "An authorized empty session has an empty result, not an unrelated response",
    );
    assert.equal(selection.selected, undefined);
    assert.equal(selection.evaluation, undefined);
  }
});

test("unsubmitted questions cannot become a selected original response", () => {
  const input = snapshot();
  const saved = input.evidence[0];
  const pendingId = "51000000-0000-4000-8000-000000000099";
  saved.attempts = [
    {
      ...saved.attempts[0],
      id: pendingId,
      root_attempt_id: pendingId,
      parent_attempt_id: null,
      submitted_at: null,
      response_text: null,
      assistance: null,
      outcome: null,
      current_evaluation_id: null,
    },
  ];
  saved.evaluations = [];
  saved.interventions = [];
  assert.equal(resolve(input, { concept, attempt: pendingId }), null);
  assert.equal(
    resolve(input, { concept, session: saved.session.id })?.selected,
    undefined,
  );
});

test("evaluation-only selection resolves its exact attempt and preserves historical evaluation identity", () => {
  const input = snapshot();
  const { other } = differentStudents(input);
  const session = input.evidence.find(
    (item) => item.session.id === other.session_id,
  )!;
  const failed = {
    ...other.evaluation!,
    id: "61000000-0000-4000-8000-000000000099",
    validation_status: "evaluation_failed" as const,
    result: null,
    applied_result: null,
    failure_reason: "Synthetic failed retry",
    evaluated_at: "2026-10-25T10:00:00Z",
  };
  session.evaluations.push(failed);
  for (const evaluation of [other.evaluation!, failed]) {
    const selection = resolve(input, { concept, evaluation: evaluation.id });
    assert.equal(selection?.selected?.attempt.id, other.attempt.id);
    assert.equal(selection?.evaluation?.id, evaluation.id);
    assert.equal(
      selection?.selected?.attempt.current_evaluation_id,
      other.attempt.current_evaluation_id,
    );
  }
});

test("all supplied identifiers must refer to the same response and concept", () => {
  const input = snapshot();
  const { latest, other } = differentStudents(input);
  assert.equal(
    resolve(input, {
      concept,
      student: other.student_id,
      session: other.session_id,
      attempt: other.attempt.id,
      evaluation: other.evaluation!.id,
    })?.selected?.attempt.id,
    other.attempt.id,
  );
  for (const params of [
    { concept, attempt: other.attempt.id, session: latest.session_id },
    { concept, attempt: other.attempt.id, student: latest.student_id },
    { concept, attempt: other.attempt.id, evaluation: latest.evaluation!.id },
    { concept, evaluation: other.evaluation!.id, session: latest.session_id },
    { concept: "bandwidth_throughput", attempt: other.attempt.id },
  ])
    assert.equal(resolve(input, params), null);
});

test("selection cannot reach records outside the authorized assignment snapshot", () => {
  const input = snapshot();
  const { other } = differentStudents(input);
  input.evidence = input.evidence.filter(
    (item) => item.session.id !== other.session_id,
  );
  for (const params of [
    { concept, session: other.session_id },
    { concept, attempt: other.attempt.id },
    { concept, evaluation: other.evaluation!.id },
    { concept, student: "10000000-0000-4000-8000-000000000099" },
    { concept, seedAttempt: [other.attempt.id] },
  ])
    assert.equal(resolve(input, params), null);
});

test("default concept selection uses the explicitly scoped student's available work", () => {
  const input = snapshot();
  input.metrics.concepts.sort(
    (a, b) =>
      Number(b.concept_id === concept) - Number(a.concept_id === concept),
  );
  const session = input.evidence[1];
  const attempt = session.attempts[0];
  const question = getCuratedQuestion(content, "NP-BW-01");
  session.attempts = [
    {
      ...attempt,
      question,
      current_evaluation_id: null,
      outcome: null,
      assistance: deriveAssistance(
        question,
        attempt.intent,
        attempt.presented_at,
        attempt.submitted_at!,
        [],
      ),
    },
  ];
  session.evaluations = [];
  session.interventions = [];
  for (const params of [
    { student: session.session.student_id },
    { session: session.session.id },
  ]) {
    const selection = resolve(input, params);
    assert.equal(selection?.concept, "bandwidth_throughput");
    assert.equal(selection?.selected?.attempt.id, attempt.id);
  }
});

test("no explicit identity preserves default/search selection, while exact links survive search", () => {
  const input = snapshot();
  const before = JSON.stringify(input);
  const defaultConcept = input.metrics.concepts.find((item) =>
    teacherEvidenceRows(input).some((row) =>
      row.attempt.question.concept_ids.includes(item.concept_id),
    ),
  )!.concept_id;
  const defaultSelection = resolve(input, {});
  assert.equal(defaultSelection?.concept, defaultConcept);
  assert.equal(
    defaultSelection?.selected?.attempt.id,
    teacherEvidenceRows(input).find((row) =>
      row.attempt.question.concept_ids.includes(defaultConcept),
    )?.attempt.id,
  );
  const rows = teacherEvidenceRows(input).filter((row) =>
    row.attempt.question.concept_ids.includes(concept),
  );
  assert.equal(
    resolve(input, { concept })?.selected?.attempt.id,
    rows[0].attempt.id,
  );
  assert.equal(
    resolve(input, { concept, q: "words that never occur in these fixtures" })
      ?.selected,
    undefined,
  );
  const exact = resolve(input, {
    concept,
    attempt: rows[0].attempt.id,
    q: "words that never occur in these fixtures",
  });
  assert.equal(exact?.selected?.attempt.id, rows[0].attempt.id);
  assert.equal(exact?.visibleRows.length, 0);
  assert.equal(JSON.stringify(input), before);
});
