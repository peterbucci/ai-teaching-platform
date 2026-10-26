import assert from "node:assert/strict";
import test from "node:test";
import type { Evaluation } from "../lib/evidence/contracts.ts";
import { buildDemoFixture } from "../lib/evidence/demo.ts";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { calculateClassMetrics } from "../lib/teacher/metrics.ts";
import {
  canPrepareFromRow,
  teacherEvidenceRows,
  type EvidenceRow,
} from "../app/teacher/evidence/model.ts";
import { evidenceEvaluationDisplay } from "../app/teacher/evidence/evaluation-display.ts";

const content = loadApprovedContent();
const fixture = buildDemoFixture(content);
const students = fixture.enrollments.map((item) => ({
  student_id: item.student_id,
  display_name: "Fictional learner",
}));
const snapshot = {
  students,
  evidence: fixture.sessions,
  metrics: calculateClassMetrics(
    students.map((student) => student.student_id),
    [...content.concept_ids],
    fixture.sessions,
  ),
};
const concept = "transmission_delay";
function acceptedRow(): EvidenceRow {
  return structuredClone(
    teacherEvidenceRows(snapshot).find((row) =>
      canPrepareFromRow(row, concept),
    )!,
  );
}
function unaccepted(
  row: EvidenceRow,
  status: "pending_review" | "evaluation_failed" | "rejected",
): Evaluation {
  return {
    ...row.evaluation!,
    id: "61000000-0000-4000-8000-000000000099",
    validation_status: status,
    result: null,
    applied_result: null,
    failure_reason:
      status === "pending_review" ? null : "Synthetic retry failure",
    evaluated_at: "2026-10-25T10:00:00Z",
  };
}

test("the current accepted evaluation remains eligible without a history warning", () => {
  const row = acceptedRow();
  const before = JSON.stringify(row);
  const display = evidenceEvaluationDisplay(row, row.evaluation, concept);
  assert.equal(display.kind, "current_accepted");
  assert.equal(display.canPrepareSelected, true);
  assert.equal(display.notice, null);
  assert.equal(canPrepareFromRow(row, concept), true);
  assert.equal(JSON.stringify(row), before);
});

for (const status of [
  "pending_review",
  "evaluation_failed",
  "rejected",
] as const)
  test(`${status} with no accepted pointer never implies another accepted result`, () => {
    const row = acceptedRow();
    row.evaluation = unaccepted(row, status);
    row.attempt.current_evaluation_id = null;
    const display = evidenceEvaluationDisplay(row, row.evaluation, concept);
    assert.equal(display.kind, "no_current_accepted");
    assert.equal(
      display.notice,
      "No current accepted evaluation is recorded for this response.",
    );
    assert.equal(display.canPrepareSelected, false);
    assert.equal(canPrepareFromRow(row, concept), false);
    assert.match(
      display.preparationNote,
      /until a current accepted evaluation is recorded/,
    );
  });

test("a submitted response without any evaluation stays awaiting acceptance", () => {
  const row = acceptedRow();
  row.attempt.current_evaluation_id = null;
  row.evaluation = undefined;
  const display = evidenceEvaluationDisplay(row, undefined, concept);
  assert.equal(display.kind, "no_current_accepted");
  assert.equal(
    display.notice,
    "No current accepted evaluation is recorded for this response.",
  );
  assert.equal(display.canPrepareSelected, false);
});

test("historical accepted evaluation keeps the actual current pointer authoritative", () => {
  const row = acceptedRow();
  const historical = structuredClone(row.evaluation!);
  row.evaluation = {
    ...historical,
    id: "61000000-0000-4000-8000-000000000098",
    supersedes_id: historical.id,
    evaluated_at: "2026-10-25T09:00:00Z",
  };
  row.attempt.current_evaluation_id = row.evaluation.id;
  const before = JSON.stringify(row);
  const display = evidenceEvaluationDisplay(row, historical, concept);
  assert.equal(display.kind, "historical_accepted");
  assert.match(display.notice!, /historical accepted evaluation/);
  assert.equal(display.canPrepareSelected, false);
  assert.equal(canPrepareFromRow(row, concept), true);
  assert.equal(
    evidenceEvaluationDisplay(row, row.evaluation, concept).canPrepareSelected,
    true,
  );
  assert.equal(JSON.stringify(row), before);
});

test("later failed retry explains that its older accepted response remains eligible", () => {
  const row = acceptedRow();
  const failedRetry = unaccepted(row, "evaluation_failed");
  const before = JSON.stringify(row);
  const display = evidenceEvaluationDisplay(row, failedRetry, concept);
  assert.equal(display.kind, "later_unaccepted");
  assert.match(display.notice!, /later evaluation attempt/);
  assert.match(display.notice!, /earlier accepted result remains current/);
  assert.match(
    display.preparationNote,
    /response remains eligible through its current accepted evaluation/,
  );
  assert.equal(display.canPrepareSelected, false);
  assert.equal(canPrepareFromRow(row, concept), true);
  assert.equal(
    evidenceEvaluationDisplay(row, row.evaluation, concept).canPrepareSelected,
    true,
  );
  assert.equal(JSON.stringify(row), before);
});

test("an older unaccepted evaluation is not mislabeled as a later retry", () => {
  const row = acceptedRow();
  const oldFailure = {
    ...unaccepted(row, "evaluation_failed"),
    evaluated_at: row.attempt.submitted_at!,
  };
  const display = evidenceEvaluationDisplay(row, oldFailure, concept);
  assert.equal(display.kind, "other_unaccepted");
  assert.match(display.notice!, /separate accepted result remains current/);
  assert.match(display.preparationNote, /response remains eligible/);
});

test("an accepted record without a current pointer cannot imply preparation eligibility", () => {
  const row = acceptedRow();
  row.attempt.current_evaluation_id = null;
  const display = evidenceEvaluationDisplay(row, row.evaluation, concept);
  assert.equal(display.kind, "no_current_accepted");
  assert.match(
    display.notice!,
    /marked accepted, but no current accepted result is recorded/,
  );
  assert.equal(display.canPrepareSelected, false);
  assert.equal(canPrepareFromRow(row, concept), false);
});

test("retry wording does not claim eligibility for an unrelated concept", () => {
  const row = acceptedRow();
  const display = evidenceEvaluationDisplay(
    row,
    unaccepted(row, "evaluation_failed"),
    "unassessed-concept",
  );
  assert.equal(display.canPrepareSelected, false);
  assert.doesNotMatch(display.preparationNote, /response remains eligible/);
  assert.equal(canPrepareFromRow(row, "unassessed-concept"), false);
});
