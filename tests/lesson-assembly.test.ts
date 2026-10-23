import test from "node:test";
import assert from "node:assert/strict";
import { assembleReviewedLesson } from "../lib/lessons/assemble.ts";
import {
  projectLessonDraftContent,
  type LessonDraftContent,
} from "../lib/lessons/contracts.ts";
import { hydrateLessonContent } from "../lib/lessons/validate.ts";
import { ObjectiveWorkflowSchema } from "../lib/objectives/contracts.ts";
import {
  deriveObjectiveConcepts,
  prepareObjectiveEdits,
} from "../lib/objectives/rules.ts";
import { makeQuestionBankObjectiveEdits } from "./fixtures/question-bank-objectives.ts";
import {
  DEFAULT_QUESTION_BANK_PREFERENCES,
  QuestionBankMetadataSchema,
} from "../lib/question-bank/contracts.ts";
import { fingerprintQuestionBank } from "../lib/question-bank/validation.ts";
import {
  makeTeacherLesson,
  makeTeacherSourceReference,
  teacherSourcePassages,
} from "./fixtures/teacher-lesson.ts";

const teacherId = "11111111-1111-4111-8111-111111111111";
const lessonId = "22222222-2222-4222-8222-222222222222";
const sourceId = "33333333-3333-4333-8333-333333333333";
const evaporationId = "44444444-4444-4444-8444-444444444444";
const condensationId = "55555555-5555-4555-8555-555555555555";
const approval = {
  status: "approved",
  approved_by: teacherId,
  approved_at: "2026-10-22T12:00:00Z",
  approval_type: "synthetic_fixture",
  approval_note: "Deterministic fixture; no model call.",
};
// Unit-only review receipt. The database probe obtains receipts from real services.
function approveFixtureBank(draft: LessonDraftContent) {
  draft.question_bank!.approval = {
    reviewed_by: teacherId,
    reviewed_at: approval.approved_at,
    content_fingerprint: fingerprintQuestionBank(draft),
  };
}
function bank(): LessonDraftContent {
  const draft: LessonDraftContent = makeTeacherLesson(
    makeTeacherSourceReference(sourceId, teacherId),
    lessonId,
    "1",
  );
  // Synthetic, schema-valid #50 reviewed workflow; no database/model claim.
  const conceptIds = [evaporationId, condensationId];
  const edits = makeQuestionBankObjectiveEdits().map((item, index) => ({
    ...item,
    concept_id: conceptIds[index],
  }));
  draft.objective_workflow = ObjectiveWorkflowSchema.parse({
    source_ref: makeTeacherSourceReference(sourceId, teacherId),
    creation: {
      request_id: lessonId,
      title: "Synthetic assembly unit fixture",
    },
    items: prepareObjectiveEdits(
      edits,
      [],
      teacherSourcePassages,
      teacherId,
      approval.approved_at,
    ),
    reviewed: {
      reviewed_by: teacherId,
      reviewed_at: approval.approved_at,
      revision: 1,
    },
  });
  draft.concepts = deriveObjectiveConcepts(draft.objective_workflow);
  draft.questions = draft.questions!.map((question) => ({
    ...question,
    concept_ids: conceptIds,
  }));
  const roles = ["initial", "alternative", "diagnostic", "retest", "retest"];
  draft.question_bank = QuestionBankMetadataSchema.parse({
    preferences: DEFAULT_QUESTION_BANK_PREFERENCES,
    items: draft.questions!.map((question, index) => ({
      question_id: question.question_id,
      family_id: "water-state",
      role: roles[index],
      format: "short_answer",
      difficulty: "intermediate",
      feedback_guidance:
        "Evaporation changes liquid water to vapor; condensation changes vapor to liquid. Compare the starting and ending states.",
      reasoning_error: null,
      source_support: question.rubric.criteria.map(
        (criterion, criterionIndex) => ({
          passage_id: draft.passages![criterionIndex].id,
          quote: draft.passages![criterionIndex].text.split(". ")[0] + ".",
          criterion,
        }),
      ),
      calculation: null,
      review_status: "reviewed",
      review_notes: "Reviewed synthetic example.",
      quality_issues: [],
    })),
    approval: null,
  });
  delete draft.sequence;
  delete draft.approval;
  approveFixtureBank(draft);
  return draft;
}
function published(draft: LessonDraftContent) {
  return hydrateLessonContent({
    ...projectLessonDraftContent(draft),
    approval,
  });
}

test("assembly preserves reviewed words, private criteria and metadata while creating a bounded compatible fallback", () => {
  const draft = bank();
  const before = structuredClone(draft);
  const assembled = assembleReviewedLesson(draft);
  const content = published(assembled);
  assert.deepEqual(
    draft,
    before,
    "The assembler must not mutate the reviewed draft",
  );
  assert.deepEqual(assembled.question_bank, draft.question_bank);
  assert.equal(assembled.approval, undefined);
  assert.equal(
    fingerprintQuestionBank(assembled),
    fingerprintQuestionBank(draft),
  );
  assert.deepEqual(
    assembled.questions!.map((question) => ({
      ...question,
      sequence_id: null,
    })),
    draft.questions!.map((question) => ({ ...question, sequence_id: null })),
  );
  assert.equal(content.sequence.bounds.max_neutral_clarifications, 0);
  assert.equal(content.sequence.bounds.max_immediate_retest_prompts, 2);
  assert.equal(content.sequence.bounds.max_student_response_prompts, 5);
  assert.deepEqual(content.sequence.diagnostic_options, [
    { misconception_id: null, question_id: "WC-DIAGNOSTIC" },
  ]);
  assert.equal(
    content.sequence.nodes.find((node) => node.node_id === "WC-RETEST-1")
      ?.next_node_id,
    "WC-RETEST-2",
  );
  assert.equal(
    content.sequence.nodes.find((node) => node.node_id === "WC-RETEST-2")
      ?.next_node_id,
    undefined,
  );
  assert.equal(
    content.sequence.nodes.find((node) => node.kind === "corrective_feedback")
      ?.feedback,
    draft.question_bank!.items[0].feedback_guidance,
  );
  assert.deepEqual(
    content.sequence.nodes.find(
      (node) => node.kind === "closing_feedback_and_review",
    )?.feedback_variants,
    draft.question_bank!.delivery.closing_feedback,
  );
  assert.equal(
    content.questions.get("WC-CLARIFY")?.sequence_id,
    null,
    "Unused alternatives remain in the bank without becoming a clarification activity",
  );
});

test("assembly requires a reviewed unchanged bank, explicit scoring policy and teacher feedback", () => {
  const unapproved = bank();
  unapproved.question_bank!.approval = null;
  assert.throws(
    () => assembleReviewedLesson(unapproved),
    /explicit teacher approval/,
  );
  const unreviewedObjectives = bank();
  unreviewedObjectives.objective_workflow!.reviewed = null;
  approveFixtureBank(unreviewedObjectives);
  assert.throws(
    () => assembleReviewedLesson(unreviewedObjectives),
    /learning objectives need approval/,
    "A bank receipt cannot substitute for objective approval",
  );
  const changed = bank();
  changed.questions![0].prompt_text += " A new unreviewed request.";
  assert.throws(
    () => assembleReviewedLesson(changed),
    /explicit teacher approval/,
  );
  const noPolicy = bank();
  delete noPolicy.scoring_policy;
  approveFixtureBank(noPolicy);
  assert.throws(() => assembleReviewedLesson(noPolicy), /scoring policy/);
  const noFeedback = bank();
  noFeedback.question_bank!.items[0].feedback_guidance = "";
  approveFixtureBank(noFeedback);
  assert.throws(() => assembleReviewedLesson(noFeedback), /feedback guidance/);
  assert.throws(
    () => assembleReviewedLesson(bank(), "missing-family"),
    /family is unavailable/,
  );
});

test("a selected family changes routing without rewriting the other reviewed family", () => {
  const draft = bank();
  draft.questions!.push(
    ...draft.questions!.map((question) => ({
      ...question,
      question_id: `${question.question_id}-second`,
    })),
  );
  draft.question_guidance!.push(
    ...draft.question_guidance!.map((guidance) => ({
      ...guidance,
      question_id: `${guidance.question_id}-second`,
    })),
  );
  draft.question_bank!.items.push(
    ...draft.question_bank!.items.map((item) => ({
      ...item,
      family_id: "second",
      question_id: `${item.question_id}-second`,
    })),
  );
  approveFixtureBank(draft);
  const assembled = assembleReviewedLesson(draft, "second");
  const content = published(assembled);
  assert.equal(content.sequence.initial_question_id, "WC-01-second");
  assert.equal(content.questions.get("WC-01")?.sequence_id, null);
  assert.equal(content.questions.size, 10);
});

test("publication rejects a misconception mapped to a diagnostic that does not assess its concept", () => {
  const reviewed = bank();
  reviewed.misconceptions!.push({
    id: "reversed-evaporation",
    concept_id: evaporationId,
    definition: "Reverses evaporation's states.",
  });
  reviewed.question_guidance!.find(
    (item) => item.question_id === "WC-DIAGNOSTIC",
  )!.misconception_ids = ["reversed-evaporation"];
  approveFixtureBank(reviewed);
  assert.equal(
    assembleReviewedLesson(reviewed).sequence!.diagnostic_options[0]
      .misconception_id,
    "reversed-evaporation",
  );
  const assembled = assembleReviewedLesson(bank());
  assembled.misconceptions!.push({
    id: "reversed-evaporation",
    concept_id: evaporationId,
    definition: "Reverses evaporation's states.",
  });
  const diagnostic = assembled.questions!.find(
    (question) => question.question_id === "WC-DIAGNOSTIC",
  )!;
  diagnostic.concept_ids = [condensationId];
  assembled.sequence!.diagnostic_options[0].misconception_id =
    "reversed-evaporation";
  assert.throws(
    () => published(assembled),
    /Diagnostic must assess its mapped misconception's concept/,
  );
  assembled.sequence!.diagnostic_options[0].misconception_id = null;
  assert.doesNotThrow(
    () => published(assembled),
    "A neutral diagnostic does not claim a misconception category",
  );
});

test("previously approved global diagnostic categories remain readable without weakening concept-specific scope", () => {
  // Global categories were already a valid published contract before #52.
  // Hydration also runs when reopening old assignments and saved evidence.
  const original = makeTeacherLesson(
    makeTeacherSourceReference(sourceId, teacherId),
    lessonId,
    "1",
  );
  original.misconceptions.push({
    id: "cause-and-description",
    concept_id: null,
    definition: "Uses a description as a causal explanation.",
    handling: "Investigate with evidence; do not infer a stable belief.",
  });
  original.question_guidance.find(
    (item) => item.question_id === "WC-DIAGNOSTIC",
  )!.misconception_ids = ["cause-and-description"];
  original.sequence.diagnostic_options[0].misconception_id =
    "cause-and-description";
  const before = structuredClone(original);
  const reopened = hydrateLessonContent(original);
  assert.equal(
    reopened.misconceptions.get("cause-and-description")?.concept_id,
    null,
  );
  assert.equal(
    reopened.sequence.diagnostic_options[0].misconception_id,
    "cause-and-description",
  );
  assert.deepEqual(
    original,
    before,
    "Reading a published snapshot must not rewrite it",
  );
});
