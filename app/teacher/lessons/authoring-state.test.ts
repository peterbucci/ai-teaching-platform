import assert from "node:assert/strict";
import test from "node:test";
import type { LessonDraftContent } from "../../../lib/lessons/contracts.ts";
import {
  DEFAULT_QUESTION_BANK_DELIVERY,
  DEFAULT_QUESTION_BANK_PREFERENCES,
} from "../../../lib/question-bank/contracts.ts";
import {
  makeTeacherLesson,
  makeTeacherSourceReference,
} from "../../../tests/fixtures/teacher-lesson.ts";
import {
  lessonStepHref,
  resumeLessonStep,
  sequenceCoverage,
} from "./authoring-state.ts";
import { groupPublishingRequirements } from "./readiness.ts";

const teacherId = "11111111-1111-4111-8111-111111111111";
const lessonId = "22222222-2222-4222-8222-222222222222";
const source = makeTeacherSourceReference(
  "33333333-3333-4333-8333-333333333333",
  teacherId,
);
const reviewed = {
  reviewed_by: teacherId,
  reviewed_at: "2026-10-25T12:00:00.000Z",
};

function preparedLesson() {
  return makeTeacherLesson(source, lessonId, "1");
}

test("legacy prepared lessons remain reviewable without optional objective or question-bank workflows", () => {
  const draft = preparedLesson();
  const original = structuredClone(draft);
  assert.equal(resumeLessonStep(draft, false), "approval");
  assert.equal(resumeLessonStep(draft, true), "publication");
  assert.deepEqual(draft, original);
  assert.equal(resumeLessonStep(null, false), "objectives");
});

test("resume follows current authoring reviews and does not treat old lesson approval as current readiness", () => {
  const draft: LessonDraftContent = {
    ...preparedLesson(),
    objective_workflow: {
      source_ref: source,
      creation: { request_id: lessonId, title: "Water changing state" },
      items: [],
      reviewed: null,
    },
    question_bank: {
      preferences: structuredClone(DEFAULT_QUESTION_BANK_PREFERENCES),
      delivery: structuredClone(DEFAULT_QUESTION_BANK_DELIVERY),
      items: [],
      approval: null,
    },
  };
  assert.ok(draft.objective_workflow);
  assert.ok(draft.question_bank);
  assert.equal(resumeLessonStep(draft, true), "objectives");
  draft.objective_workflow.reviewed = { ...reviewed, revision: 1 };
  assert.equal(resumeLessonStep(draft, true), "questions");
  draft.question_bank.approval = {
    ...reviewed,
    content_fingerprint: "a".repeat(64),
  };
  const sequence = draft.sequence;
  delete draft.sequence;
  assert.equal(resumeLessonStep(draft, true), "sequence");
  draft.sequence = sequence;
  assert.equal(resumeLessonStep(draft, false), "approval");
  assert.equal(resumeLessonStep(draft, true), "publication");

  // An objective edit invalidates its review before downstream content can
  // resume, even when old derived content remains in this browser snapshot.
  draft.objective_workflow.reviewed = null;
  assert.equal(resumeLessonStep(draft, true), "objectives");
});

test("sequence coverage distinguishes the multi-concept bank from the selected prepared family", () => {
  const draft = preparedLesson();
  draft.sequence.concept_ids = [draft.concepts[0].id];
  draft.questions = draft.questions.slice(0, 3);
  draft.questions[0].sequence_id = draft.sequence.sequence_id;
  draft.questions[1].sequence_id = draft.sequence.sequence_id;
  draft.questions[2].sequence_id = null;
  const original = structuredClone(draft);
  const coverage = sequenceCoverage(draft);
  assert.deepEqual(coverage.included, [draft.concepts[0]]);
  assert.deepEqual(coverage.outside, [draft.concepts[1]]);
  assert.equal(coverage.bankCount, 3);
  assert.equal(coverage.preparedCount, 2);
  assert.deepEqual(draft, original);

  const unprepared: LessonDraftContent = { ...draft };
  delete unprepared.sequence;
  assert.deepEqual(sequenceCoverage(unprepared), {
    included: [],
    outside: draft.concepts,
    bankCount: 3,
    preparedCount: 0,
  });
  assert.deepEqual(sequenceCoverage(null), {
    included: [],
    outside: [],
    bankCount: 0,
    preparedCount: 0,
  });
});

test("readiness groups deduplicate requirements while preserving every diagnostic and source of truth", () => {
  const issues = [
    {
      path: "questions.0.rubric.required_concepts",
      message: "Source support is missing.",
    },
    { path: "question_bank.approval", message: "Approve the current bank." },
    {
      path: "authoring_review",
      message:
        "Approve the current objectives before approving the complete lesson.",
    },
    {
      path: "concepts.0.objective",
      message: "Too small: expected string to have >=1 characters",
    },
    {
      path: "content",
      message: "Lesson passages differ from the approved source version.",
    },
    {
      path: "sequence",
      message: "Invalid input: expected object, received undefined",
    },
    {
      path: "activity_policy",
      message: "Invalid input: expected object, received undefined",
    },
    {
      path: "future_contract_requirement",
      message: "A newly introduced check failed.",
    },
  ];
  const original = structuredClone(issues);
  const result = groupPublishingRequirements(lessonId, issues);
  assert.deepEqual(
    result.groups.map((group) => [group.key, group.issueCount]),
    [
      ["source", 1],
      ["objectives", 2],
      ["questions", 2],
      ["sequence", 1],
      ["policy", 2],
    ],
  );
  assert.equal(result.groups[1].href, `/teacher/objectives/${lessonId}`);
  assert.equal(result.groups[2].href, `/teacher/lessons/${lessonId}/questions`);
  assert.deepEqual(result.diagnostics, issues);
  assert.notEqual(result.diagnostics, issues);
  assert.deepEqual(issues, original);
});

test("version conflicts point to publication without losing raw errors or inventing requirements", () => {
  const issues = [
    {
      path: "content_ref.content_version",
      message:
        "This version is already published. Choose a new lesson version before approving changed content.",
    },
  ];
  const result = groupPublishingRequirements("lesson/with space", issues);
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].key, "policy");
  assert.equal(
    result.groups[0].href,
    "/teacher/lessons/lesson%2Fwith%20space?step=publication",
  );
  assert.deepEqual(result.diagnostics, issues);
  assert.deepEqual(groupPublishingRequirements(lessonId, []), {
    groups: [],
    diagnostics: [],
  });
  assert.equal(
    lessonStepHref("lesson/with space", "questions"),
    "/teacher/lessons/lesson%2Fwith%20space/questions",
  );
});
