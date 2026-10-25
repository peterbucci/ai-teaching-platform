import assert from "node:assert/strict";
import test from "node:test";
import { buildClassFixture } from "../lib/evidence/class-fixture.ts";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import { buildInterventionEvidence } from "../lib/interventions/evidence.ts";
import { calculateClassMetrics } from "../lib/teacher/metrics.ts";
import {
  parseTeacherWorkspaceContext,
  teacherReturnHref,
} from "../lib/teacher/workspace-contracts.ts";
import {
  evidenceScopeCounts,
  interventionPreviewHref,
  matchesReviewedSelection,
} from "../app/teacher/interventions/handoff.ts";

const content = loadApprovedContent();
const fixture = buildClassFixture(content);
const students = fixture.enrollments.map((enrollment) => ({
  student_id: enrollment.student_id,
  display_name: fixture.profiles.find(
    (profile) => profile.id === enrollment.student_id,
  )!.display_name,
}));
const snapshot = {
  assignment_id: DEMO_IDS.assignmentId,
  class_id: DEMO_IDS.classId,
  title: "Networking",
  class_name: "Fictional class",
  approved_misconception_ids: [...content.misconceptions.keys()],
  students,
  evidence: fixture.sessions,
  metrics: calculateClassMetrics(
    students.map((student) => student.student_id),
    [...content.concept_ids],
    fixture.sessions,
  ),
};
const selection = {
  assignment_id: DEMO_IDS.assignmentId,
  concept_id: "transmission_delay",
  origin: "synthetic_fixture" as const,
  attempt_ids: [],
  misconception_id: null,
};

test("selected-response handoff previews related and contrary evidence without changing recipient choice", () => {
  const all = buildInterventionEvidence(snapshot, content, selection);
  const contrary = all.observations.find(
    (item) =>
      item.role === "contradictory" &&
      all.observations.some(
        (other) =>
          other.student_id === item.student_id && other.role === "supporting",
      ),
  )!;
  assert.ok(contrary);
  const starting = all.observations.find(
    (item) =>
      item.student_id === contrary.student_id && item.role === "supporting",
  )!;
  const context = parseTeacherWorkspaceContext({
    assignment: DEMO_IDS.assignmentId,
    origin: "synthetic_fixture",
    concept: selection.concept_id,
    attempt: starting.attempt.id,
    evaluation: starting.evaluation.id,
    session: starting.session_id,
    returnTo: "evidence",
  });
  const url = new URL(
    interventionPreviewHref(context, [starting.attempt.id]),
    "https://example.test",
  );
  const handoff = parseTeacherWorkspaceContext({
    ...Object.fromEntries(url.searchParams),
    seedAttempt: url.searchParams.getAll("seedAttempt"),
  });
  const preview = buildInterventionEvidence(snapshot, content, {
    ...selection,
    attempt_ids: handoff.seedAttempt,
  });
  assert.equal(preview.counts.selected_students, 1);
  assert.ok(
    preview.observations.some(
      (item) => item.attempt.id === contrary.attempt.id,
    ),
  );
  assert.equal(evidenceScopeCounts(preview).starting, 1);
  assert.ok(evidenceScopeCounts(preview).contrary > 0);
  assert.equal(url.searchParams.has("recipients"), false);
  assert.equal(
    new URL(
      teacherReturnHref(handoff),
      "https://example.test",
    ).searchParams.get("evaluation"),
    starting.evaluation.id,
  );
});

test("changing or clearing a starting set requires another server preview; ordering alone does not", () => {
  assert.equal(matchesReviewedSelection(["a", "b"], ["b", "a"]), true);
  assert.equal(matchesReviewedSelection(["a"], ["a", "b"]), false);
  assert.equal(matchesReviewedSelection([], ["a"]), false);
});

test("preview and investigation links exclude generation and draft identities", () => {
  const context = parseTeacherWorkspaceContext({
    assignment: DEMO_IDS.assignmentId,
    concept: selection.concept_id,
    draft: "private-draft-id",
    request: "private-request-id",
    generation_draft: "pending-draft-id",
  });
  for (const href of [
    interventionPreviewHref(context, []),
    teacherReturnHref(context),
  ]) {
    const query = new URL(href, "https://example.test").searchParams;
    assert.equal(query.has("draft"), false);
    assert.equal(query.has("request"), false);
    assert.equal(query.has("generation_draft"), false);
  }
});
