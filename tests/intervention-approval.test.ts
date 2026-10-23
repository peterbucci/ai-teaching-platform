import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { buildClassFixture } from "../lib/evidence/class-fixture.ts";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import { calculateClassMetrics } from "../lib/teacher/metrics.ts";
import { buildInterventionEvidence } from "../lib/interventions/evidence.ts";
import { InterventionDraftSchema } from "../lib/interventions/drafts.ts";
import {
  InterventionActionSchema,
  StudentInterventionActivitySchema,
  toStudentInterventionActivity,
} from "../lib/interventions/approval-contracts.ts";
import { validateEditedIntervention } from "../lib/interventions/approval-validation.ts";

// Reuse #44's recorded model output as a fixture; these tests make no model calls.
const recorded = z
  .object({
    result: z.object({
      draft: InterventionDraftSchema.omit({ evidence: true }),
    }),
  })
  .parse(
    JSON.parse(
      readFileSync("evals/results/intervention-draft-live-v2.json", "utf8"),
    ),
  ).result.draft;
const content = loadApprovedContent();
const fixture = buildClassFixture(content);
const students = fixture.enrollments.map((e) => ({
  student_id: e.student_id,
  display_name: fixture.profiles.find((p) => p.id === e.student_id)!
    .display_name,
}));
const evidence = buildInterventionEvidence(
  {
    assignment_id: DEMO_IDS.assignmentId,
    class_id: DEMO_IDS.classId,
    title: "Networking",
    class_name: "Fictional class",
    approved_misconception_ids: [...content.misconceptions.keys()],
    students,
    evidence: fixture.sessions,
    metrics: calculateClassMetrics(
      students.map((s) => s.student_id),
      [...content.concept_ids],
      fixture.sessions,
    ),
  },
  content,
  {
    assignment_id: DEMO_IDS.assignmentId,
    concept_id: "transmission_delay",
    origin: "synthetic_fixture",
    attempt_ids: [],
    misconception_id: null,
  },
);
const draft = InterventionDraftSchema.parse({ ...recorded, evidence });

test("teacher edits preserve the original evidence, source version and generation provenance", () => {
  const before = JSON.stringify(draft);
  const edited = structuredClone(draft.activity);
  edited.title = "Review how a changed cable affects each delay";
  edited.explanation =
    "Use the quoted source relationships to compare what is fixed and what changes.";
  edited.fresh_check.rubric.answer_guidance =
    "Transmission time stays fixed; propagation time increases when signal speed falls.";
  edited.fresh_check.rubric.criteria = [
    "Separates transmission time from propagation time.",
  ];
  assert.deepEqual(validateEditedIntervention(edited, draft), edited);
  assert.equal(JSON.stringify(draft), before);
});

test("rejects forged question identity, provenance, source versions and evidence changes", () => {
  for (const mutate of [
    (a: typeof draft.activity) => {
      a.fresh_check.question_id = "replacement";
    },
    (a: typeof draft.activity) => {
      a.fresh_check.generation!.model = "replacement";
    },
    (a: typeof draft.activity) => {
      a.fresh_check.content_ref.content_version = "replacement";
    },
    (a: typeof draft.activity) => {
      a.rationale = "An unsupported diagnosis";
    },
    (a: typeof draft.activity) => {
      a.evidence_references[0].response_quote = "Invented student words";
    },
    (a: typeof draft.activity) => {
      a.suggested_recipients = [];
    },
    (a: typeof draft.activity) => {
      a.source_references[0].quote = "Invented source";
    },
    (a: typeof draft.activity) => {
      a.fresh_check.source_passage_ids = ["outside"];
    },
    (a: typeof draft.activity) => {
      a.fresh_check.concept_ids = ["outside"];
    },
  ]) {
    const edited = structuredClone(draft.activity);
    mutate(edited);
    assert.throws(() => validateEditedIntervention(edited, draft));
  }
});

test("student projection excludes answer guidance, evidence, hypotheses, recipient identities and model traces", () => {
  const student = toStudentInterventionActivity(draft.activity);
  assert.equal(
    student.fresh_check.question_id,
    draft.activity.fresh_check.question_id,
  );
  assert.equal(student.explanation, draft.activity.explanation);
  const serialized = JSON.stringify(student);
  for (const field of [
    "rubric",
    "answer_guidance",
    "criteria",
    "generation",
    "rationale",
    "uncertainty",
    "evidence_references",
    "suggested_recipients",
    "response_quote",
  ])
    assert.ok(!serialized.includes(`"${field}"`), field);
  for (const recipient of draft.activity.suggested_recipients)
    assert.ok(!serialized.includes(recipient.student_id));
  assert.equal(
    StudentInterventionActivitySchema.safeParse({
      ...student,
      rubric: draft.activity.fresh_check.rubric,
    }).success,
    false,
  );
});

test("approval requires explicit distinct recipients and a positive reviewed revision", () => {
  const input = {
    action: "approve",
    request_id: DEMO_IDS.supportedRoot,
    expected_revision: 1,
    recipient_ids: [DEMO_IDS.studentOne, DEMO_IDS.studentTwo],
  };
  assert.equal(InterventionActionSchema.safeParse(input).success, true);
  for (const invalid of [
    { ...input, recipient_ids: [] },
    { ...input, recipient_ids: [DEMO_IDS.studentOne, DEMO_IDS.studentOne] },
    { ...input, expected_revision: 0 },
    { ...input, approved_by: DEMO_IDS.teacher },
  ])
    assert.equal(InterventionActionSchema.safeParse(invalid).success, false);
});
