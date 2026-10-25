import assert from "node:assert/strict";
import test from "node:test";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { buildDemoFixture, DEMO_IDS } from "../lib/evidence/demo.ts";
import { calculateClassMetrics } from "../lib/teacher/metrics.ts";
import {
  buildAssignmentProgress,
  progressEvaluation,
  progressEvidenceHref,
  progressHref,
  progressMark,
  progressRestorationTarget,
  progressReturnFocusId,
  progressSelectionId,
  progressSessionHref,
  selectProgressEvidence,
  type AssignmentEvidence,
  type ProgressReturnContext,
} from "../app/teacher/assignments/progress-model.ts";

const content = loadApprovedContent();
const fixture = buildDemoFixture(content);
function snapshot(): AssignmentEvidence {
  const students = fixture.enrollments.map(({ student_id }) => ({
    student_id,
    display_name: fixture.profiles.find((profile) => profile.id === student_id)!
      .display_name,
  }));
  return {
    assignment_id: fixture.assignment.id,
    class_id: fixture.classRecord.id,
    class_name: fixture.classRecord.name,
    title: fixture.assignment.title,
    approved_misconception_ids: fixture.assignment.approved_misconception_ids,
    students,
    evidence: structuredClone(fixture.sessions),
    metrics: calculateClassMetrics(
      students.map((student) => student.student_id),
      [...content.concept_ids],
      fixture.sessions,
    ),
  };
}

test("progress distinguishes distinct students, response counts, and assisted evidence without changing history", () => {
  const data = snapshot();
  const original = structuredClone(data);
  const result = buildAssignmentProgress(data, "all");
  assert.deepEqual(result.summary, {
    enrolled: 3,
    startedStudents: 2,
    studentsAnswered: 2,
    completedSessions: 2,
    submittedResponses: 5,
    unansweredQuestions: 0,
    pendingEvaluations: 0,
    failedEvaluations: 0,
    rejectedEvaluations: 0,
  });
  const transmission = result.metrics.concepts.find(
    (item) => item.concept_id === "transmission_delay",
  )!;
  assert.equal(transmission.latest.correct, 2);
  assert.equal(transmission.independent.correct, 1);
  assert.equal(transmission.content_assisted.correct, 1);
  assert.equal(result.students[0].responseCount, 4);
  assert.equal(
    result.students[2].cells.every((cell) => cell.status === "no_response"),
    true,
  );
  assert.deepEqual(data, original);
});

test("a resumed session retains old work until a new answer replaces the latest result", () => {
  const data = snapshot();
  const resumed = structuredClone(data.evidence[1]);
  resumed.session.id = "40000000-0000-4000-8000-000000000099";
  resumed.session.status = "active";
  resumed.session.started_at = "2026-10-20T10:00:00Z";
  resumed.session.ended_at = null;
  const attempt = resumed.attempts[0];
  attempt.id = "50000000-0000-4000-8000-000000000099";
  attempt.root_attempt_id = attempt.id;
  attempt.session_id = resumed.session.id;
  attempt.presented_at = resumed.session.started_at;
  attempt.submitted_at = null;
  attempt.response_text = null;
  attempt.submission_key = null;
  attempt.assistance = null;
  attempt.current_evaluation_id = null;
  attempt.outcome = null;
  resumed.evaluations = [];
  data.evidence.push(resumed);
  const progress = buildAssignmentProgress(data, "all");
  const cell = progress.students
    .find((student) => student.student_id === DEMO_IDS.studentTwo)!
    .cells.find((item) => item.conceptId === "transmission_delay")!;
  assert.equal(cell.status, "correct");
  assert.equal(cell.latestSubmitted?.attempt.id, DEMO_IDS.correctRoot);
  assert.equal(cell.evidenceCount, 2);
  assert.equal(progress.summary.startedStudents, 2);
  assert.equal(progress.summary.unansweredQuestions, 1);
  assert.equal(
    selectProgressEvidence(
      progress.sessions,
      DEMO_IDS.studentTwo,
      "transmission_delay",
    ).length,
    2,
  );
  attempt.submitted_at = "2026-10-20T10:01:00Z";
  attempt.response_text = "A new response awaits evaluation.";
  attempt.submission_key = "a0000000-0000-4000-8000-000000000099";
  attempt.assistance = structuredClone(data.evidence[1].attempts[0].assistance);
  const updated = buildAssignmentProgress(data, "all");
  const updatedCell = updated.students
    .find((student) => student.student_id === DEMO_IDS.studentTwo)!
    .cells.find((item) => item.conceptId === "transmission_delay")!;
  assert.equal(updatedCell.status, "pending");
  assert.equal(updatedCell.latestSubmitted?.attempt.id, attempt.id);
  assert.equal(updated.summary.pendingEvaluations, 1);
  assert.equal(updated.summary.submittedResponses, 6);
  assert.equal(updated.summary.unansweredQuestions, 0);
});

test("pending, failed and rejected answers remain distinct from missing responses and older grades", () => {
  for (const validation_status of [
    "pending_review",
    "evaluation_failed",
    "rejected",
  ] as const) {
    const data = snapshot();
    const history = data.evidence[1];
    history.attempts[0].current_evaluation_id = null;
    history.evaluations[0] = {
      ...history.evaluations[0],
      validation_status,
      result: null,
      applied_result: null,
      failure_reason:
        validation_status === "pending_review"
          ? null
          : "Synthetic failed judgment",
    };
    const result = buildAssignmentProgress(data, "all");
    const cell = result.students
      .find((student) => student.student_id === DEMO_IDS.studentTwo)!
      .cells.find((item) => item.conceptId === "transmission_delay")!;
    assert.equal(
      cell.status,
      validation_status === "pending_review" ? "pending" : validation_status,
    );
    assert.equal(result.summary.submittedResponses, 5);
    assert.equal(result.summary.unansweredQuestions, 0);
    assert.equal(
      result.summary.pendingEvaluations,
      validation_status === "pending_review" ? 1 : 0,
    );
    assert.equal(
      result.summary.failedEvaluations,
      validation_status === "evaluation_failed" ? 1 : 0,
    );
    assert.equal(
      result.summary.rejectedEvaluations,
      validation_status === "rejected" ? 1 : 0,
    );
  }
  const data = snapshot();
  data.evidence[1].attempts[0].current_evaluation_id = null;
  data.evidence[1].evaluations = [];
  assert.equal(
    buildAssignmentProgress(data, "all").summary.pendingEvaluations,
    1,
  );
});

test("a later failed reevaluation preserves the current accepted judgment and uncertainty", () => {
  const data = snapshot();
  const history = data.evidence[1];
  const accepted = history.evaluations[0];
  accepted.result!.uncertainty_reason = "The original response is ambiguous.";
  accepted.result!.per_concept_results[0].correctness = "uncertain";
  history.evaluations.push({
    ...accepted,
    id: "60000000-0000-4000-8000-000000000099",
    evaluated_at: "2026-10-20T10:00:00Z",
    validation_status: "evaluation_failed",
    result: null,
    applied_result: null,
    failure_reason: "Synthetic timeout",
  });
  const row = selectProgressEvidence(data.evidence, DEMO_IDS.studentTwo)[0];
  assert.equal(progressEvaluation(row)?.id, accepted.id);
  assert.equal(
    progressEvaluation(row)?.result?.uncertainty_reason,
    "The original response is ambiguous.",
  );
  const progress = buildAssignmentProgress(data, "all");
  assert.equal(progress.summary.failedEvaluations, 0);
  assert.equal(
    progress.students
      .find((student) => student.student_id === DEMO_IDS.studentTwo)!
      .cells.find(
        (cell) =>
          cell.conceptId === accepted.result!.per_concept_results[0].concept_id,
      )!.status,
    "uncertain",
  );
});

test("origin filtering retains the roster and gives truthful zero participation", () => {
  const result = buildAssignmentProgress(snapshot(), "live_demo");
  assert.equal(result.summary.enrolled, 3);
  assert.equal(result.summary.startedStudents, 0);
  assert.equal(result.summary.studentsAnswered, 0);
  assert.equal(result.summary.submittedResponses, 0);
  assert.equal(result.students.length, 3);
  assert.equal(
    result.students.every((student) =>
      student.cells.every(
        (cell) => cell.status === "no_response" && cell.evidenceCount === 0,
      ),
    ),
    true,
  );
  assert.equal(
    result.metrics.concepts.every(
      (concept) => concept.latest.accepted_students === 0,
    ),
    true,
  );
});

test("grid and full evidence links preserve the authorized assignment, selection and exact attempt", () => {
  const data = snapshot();
  const row = selectProgressEvidence(
    data.evidence,
    DEMO_IDS.studentOne,
    "transmission_delay",
  )[0];
  const selected = new URL(
    progressHref(
      data.assignment_id,
      "synthetic_fixture",
      {
        student: DEMO_IDS.studentOne,
        concept: "transmission_delay",
      },
      { class: DEMO_IDS.classId, status: "active" },
    ),
    "https://example.test",
  );
  assert.equal(selected.searchParams.get("assignment"), data.assignment_id);
  assert.equal(selected.searchParams.get("view"), "progress");
  assert.equal(selected.searchParams.get("student"), DEMO_IDS.studentOne);
  assert.equal(selected.searchParams.get("origin"), "synthetic_fixture");
  assert.equal(selected.searchParams.get("class"), DEMO_IDS.classId);
  assert.equal(selected.searchParams.get("status"), "active");
  assert.equal(selected.hash, "#cell-evidence");
  const target = new URL(
    progressEvidenceHref(row, {
      assignment: data.assignment_id,
      origin: "synthetic_fixture",
      student: DEMO_IDS.studentOne,
      concept: "transmission_delay",
      class: DEMO_IDS.classId,
      status: "active",
      progressView: "grid",
      pane: "details",
    }),
    "https://example.test",
  );
  assert.equal(target.pathname, `/teacher/sessions/${row.evidence.session.id}`);
  assert.equal(target.hash, `#attempt-${row.attempt.id}`);
  assert.equal(
    target.searchParams.get("progressConcept"),
    "transmission_delay",
  );
  assert.equal(target.searchParams.get("progressStudent"), DEMO_IDS.studentOne);
  assert.equal(target.searchParams.has("student"), false);
  assert.equal(target.searchParams.has("concept"), false);
  assert.equal(target.searchParams.get("returnTo"), "progress");
  assert.equal(target.searchParams.get("attempt"), row.attempt.id);
  assert.equal(target.searchParams.get("pane"), "details");
  assert.equal(target.searchParams.get("progressView"), "grid");
  assert.equal(target.searchParams.get("class"), DEMO_IDS.classId);
  assert.equal(target.searchParams.get("status"), "active");
  assert.equal(
    row.attempt.question.content_ref.content_version,
    content.content_ref.content_version,
  );
  assert.equal(
    row.attempt.response_text,
    fixture.sessions[0].attempts.at(-1)!.response_text,
  );
});

test("progress does not silently include evidence outside the authorized roster", () => {
  const data = snapshot();
  data.students = data.students.filter(
    (student) => student.student_id !== DEMO_IDS.studentOne,
  );
  assert.throws(
    () => buildAssignmentProgress(data, "all"),
    /outside the roster/,
  );
});

test("student-only and concept-only selections include their matching saved work", () => {
  const data = snapshot();
  const student = selectProgressEvidence(data.evidence, DEMO_IDS.studentOne);
  assert.equal(student.length, 4);
  assert.equal(
    student.every(
      (row) => row.evidence.session.student_id === DEMO_IDS.studentOne,
    ),
    true,
  );
  const concept = selectProgressEvidence(
    data.evidence,
    undefined,
    "transmission_delay",
  );
  assert.equal(
    new Set(concept.map((row) => row.evidence.session.student_id)).size,
    2,
  );
  assert.equal(
    concept.every((row) =>
      row.attempt.question.concept_ids.includes("transmission_delay"),
    ),
    true,
  );
  assert.equal(
    selectProgressEvidence(data.evidence, DEMO_IDS.inactiveStudent).length,
    0,
  );
});

test("class-grid marks retain every original attempt in chronological order", () => {
  const data = snapshot();
  const original = structuredClone(data);
  const progress = buildAssignmentProgress(data, "all");
  const student = progress.students.find(
    (item) => item.student_id === DEMO_IDS.studentOne,
  )!;
  const cell = student.cells.find(
    (item) => item.conceptId === "transmission_delay",
  )!;
  assert.deepEqual(
    cell.marks.map((mark) => mark.attemptId),
    data.evidence[0].attempts.map((attempt) => attempt.id),
  );
  assert.deepEqual(
    cell.marks.map((mark) => mark.status),
    ["incorrect", "incorrect", "correct", "correct"],
  );
  assert.deepEqual(
    cell.marks.map((mark) => mark.assistance),
    ["none", "none", "help", "help"],
  );
  assert.equal(student.helpShownCount, 2);
  assert.equal(progress.reachedByConcept.transmission_delay, 2);
  assert.equal(progress.assistanceSummary.helpResponses, 2);
  assert.deepEqual(data, original);
});

test("reading-only marks require displayed recorded reading and never become content-help marks", () => {
  const data = snapshot();
  const row = selectProgressEvidence(data.evidence, DEMO_IDS.studentTwo)[0];
  const reading = {
    ...data.evidence[0].interventions[0],
    id: "70000000-0000-4000-8000-000000000099",
    session_id: row.evidence.session.id,
    related_attempt_id: row.attempt.id,
    related_evaluation_id: null,
    type: "reading" as const,
    concept_ids: ["transmission_delay"],
    delivery_status: "displayed" as const,
    created_at: row.attempt.presented_at,
    visible_at: row.attempt.presented_at,
  };
  row.evidence.interventions.push(reading);
  row.attempt.assistance!.intervention_ids.push(reading.id);
  row.attempt.assistance!.assistance_level = "reading";
  row.attempt.assistance!.independent_retrieval_eligible_by_concept.transmission_delay = false;
  assert.equal(progressMark(row, "transmission_delay").assistance, "reading");
  assert.equal(progressMark(row, "propagation_delay").assistance, "none");
  assert.equal(
    buildAssignmentProgress(data, "all").assistanceSummary.readingOnlyResponses,
    1,
  );
  row.evidence.interventions = [
    { ...reading, delivery_status: "created", visible_at: null },
  ];
  assert.equal(progressMark(row, "transmission_delay").assistance, "none");
});

test("progress navigation carries subview and reversible pane with selection", () => {
  const url = new URL(
    progressHref(
      DEMO_IDS.assignmentId,
      "synthetic_fixture",
      { student: DEMO_IDS.studentOne, concept: "transmission_delay" },
      { class: DEMO_IDS.classId, status: "active" },
      { progressView: "concepts", pane: "grid" },
    ),
    "https://example.test",
  );
  assert.equal(url.searchParams.get("pane"), "grid");
  assert.equal(url.searchParams.get("progressView"), "concepts");
  assert.equal(url.searchParams.get("student"), DEMO_IDS.studentOne);
  assert.equal(url.searchParams.get("concept"), "transmission_delay");
  assert.equal(url.searchParams.get("class"), DEMO_IDS.classId);
  assert.equal(
    url.hash,
    `#${progressSelectionId(undefined, "transmission_delay")}`,
  );
});

test("outgoing Details return context preserves concept-only and student-only selection", () => {
  const row = selectProgressEvidence(
    snapshot().evidence,
    DEMO_IDS.studentOne,
  )[0];
  const context: ProgressReturnContext = {
    assignment: DEMO_IDS.assignmentId,
    origin: "synthetic_fixture",
    progressView: "concepts",
    pane: "details",
    status: "active",
    class: DEMO_IDS.classId,
  };
  const concept = new URL(
    progressEvidenceHref(row, { ...context, concept: "transmission_delay" }),
    "https://example.test",
  );
  assert.equal(concept.searchParams.has("progressStudent"), false);
  assert.equal(
    concept.searchParams.get("progressConcept"),
    "transmission_delay",
  );
  assert.equal(concept.searchParams.has("student"), false);
  assert.equal(concept.searchParams.has("concept"), false);
  assert.equal(concept.hash, `#attempt-${row.attempt.id}`);
  const student = new URL(
    progressEvidenceHref(row, { ...context, student: DEMO_IDS.studentOne }),
    "https://example.test",
  );
  assert.equal(student.searchParams.has("progressConcept"), false);
  assert.equal(
    student.searchParams.get("progressStudent"),
    DEMO_IDS.studentOne,
  );
  assert.equal(student.searchParams.has("student"), false);
  assert.equal(student.searchParams.has("concept"), false);
  const unselected = new URL(
    progressEvidenceHref(row, context),
    "https://example.test",
  );
  assert.equal(unselected.searchParams.has("student"), false);
  assert.equal(unselected.searchParams.has("concept"), false);
  assert.equal(unselected.searchParams.has("progressStudent"), false);
  assert.equal(unselected.searchParams.has("progressConcept"), false);
});

test("question and session links preserve the originating selection separately from target records", () => {
  const row = selectProgressEvidence(
    snapshot().evidence,
    DEMO_IDS.studentTwo,
  )[0];
  const context: ProgressReturnContext = {
    assignment: DEMO_IDS.assignmentId,
    origin: "all",
    student: DEMO_IDS.studentOne,
    concept: "transmission_delay",
    progressView: "questions",
    pane: "grid",
    status: "all",
    class: DEMO_IDS.classId,
  };
  const question = new URL(
    progressEvidenceHref(row, context),
    "https://example.test",
  );
  assert.equal(
    question.pathname,
    `/teacher/sessions/${row.evidence.session.id}`,
  );
  assert.equal(row.evidence.session.student_id, DEMO_IDS.studentTwo);
  assert.equal(
    question.searchParams.get("progressStudent"),
    DEMO_IDS.studentOne,
  );
  assert.equal(
    question.searchParams.get("progressConcept"),
    "transmission_delay",
  );
  assert.equal(question.searchParams.has("student"), false);
  assert.equal(question.searchParams.has("concept"), false);
  assert.equal(question.searchParams.get("attempt"), row.attempt.id);
  assert.equal(question.searchParams.get("progressView"), "questions");
  assert.equal(question.searchParams.get("pane"), "grid");
  const session = new URL(
    progressSessionHref(row.evidence.session.id, {
      ...context,
      progressView: "sessions",
    }),
    "https://example.test",
  );
  assert.equal(session.searchParams.get("progressView"), "sessions");
  assert.equal(session.searchParams.get("returnTo"), "progress");
  assert.equal(
    session.searchParams.get("progressStudent"),
    DEMO_IDS.studentOne,
  );
  assert.equal(session.searchParams.has("student"), false);
  assert.equal(session.searchParams.has("concept"), false);
  assert.equal(session.searchParams.has("attempt"), false);
  assert.equal(session.hash, "");
  assert.deepEqual(
    [...session.searchParams.keys()].sort(),
    [
      "assignment",
      "class",
      "progressConcept",
      "origin",
      "pane",
      "progressView",
      "returnTo",
      "status",
      "progressStudent",
    ].sort(),
  );
});

test("returned focus anchors restore the actual visible selection or main view", () => {
  const context = {
    student: DEMO_IDS.studentOne,
    concept: "transmission_delay",
    progressView: "grid" as const,
    pane: "grid" as const,
  };
  const cell = progressSelectionId(context.student, context.concept);
  assert.equal(
    progressRestorationTarget(`#${encodeURIComponent(cell)}`, context),
    cell,
  );
  assert.equal(
    progressRestorationTarget("#cell-evidence", {
      ...context,
      pane: "details",
    }),
    "cell-evidence",
  );
  const column = progressSelectionId(undefined, context.concept);
  assert.equal(
    progressReturnFocusId({ ...context, progressView: "concepts" }),
    column,
  );
  assert.equal(
    progressRestorationTarget(`#${column}`, {
      ...context,
      progressView: "concepts",
    }),
    column,
  );
  assert.equal(
    progressRestorationTarget(`#${cell}`, {
      ...context,
      progressView: "concepts",
    }),
    null,
  );
  const studentOnly = {
    ...context,
    concept: undefined,
    progressView: "concepts" as const,
  };
  assert.equal(progressReturnFocusId(studentOnly), "progress-main");
  assert.equal(
    progressRestorationTarget("#progress-main", studentOnly),
    "progress-main",
  );
  for (const progressView of ["questions", "sessions"] as const) {
    assert.equal(
      progressReturnFocusId({ ...context, progressView }),
      "progress-main",
    );
    assert.equal(
      progressRestorationTarget("#progress-main", { ...context, progressView }),
      "progress-main",
    );
  }
});

test("restoration rejects arbitrary, malformed and unrelated selection hashes", () => {
  const context = {
    student: DEMO_IDS.studentOne,
    concept: "concept / one",
    progressView: "grid" as const,
    pane: "grid" as const,
  };
  const expected = progressSelectionId(context.student, context.concept);
  assert.equal(
    progressRestorationTarget(`#${encodeURIComponent(expected)}`, context),
    expected,
  );
  for (const hash of [
    "#body",
    "#.ap-main",
    "#%ZZ",
    `#${progressSelectionId(DEMO_IDS.studentTwo, context.concept)}`,
    "#cell-evidence",
  ])
    assert.equal(progressRestorationTarget(hash, context), null);
});
