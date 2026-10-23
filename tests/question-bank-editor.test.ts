import test from "node:test";
import assert from "node:assert/strict";
import { QuestionSnapshotSchema } from "../lib/evidence/contracts.ts";
import type { LessonDraftContent } from "../lib/lessons/contracts.ts";
import {
  fingerprintQuestionBank,
  getReviewedQuestionBank,
} from "../lib/question-bank/validation.ts";
import {
  makeTeacherLesson,
  makeTeacherSourceReference,
} from "./fixtures/teacher-lesson.ts";

import {
  DEFAULT_QUESTION_BANK_PREFERENCES,
  QuestionBankMetadataSchema,
  QuestionCalculationSchema,
} from "../lib/question-bank/contracts.ts";
import {
  parseRecovery,
  questionFormatChange,
  withHintPermission,
} from "../app/teacher/lessons/[lessonId]/questions/editor-state.ts";

function recoveryCopy() {
  return {
    lesson_id: "teacher-lesson",
    revision: 7,
    bank: {
      questions: [
        QuestionSnapshotSchema.parse({
          origin: "curated",
          question_id: "question-1",
          sequence_id: null,
          prompt_text:
            "A group has two pairs of students. How many students are there?",
          content_ref: {
            package_id: "teacher-lesson",
            content_version: "1",
            source_id: "source-1",
            source_commit: "a".repeat(40),
            excerpt_sha256: "b".repeat(64),
          },
          concept_ids: ["counting"],
          source_passage_ids: ["passage-1"],
          rubric: {
            version: "1",
            answer_guidance:
              "Four students: two pairs contain two students each.",
            criteria: ["Multiply two by two."],
            acceptable_variations: [],
            partial_credit_guidance:
              "Credit the grouping even when the total is incorrect.",
          },
          embedded_scaffolding: [],
          generation: null,
        }),
      ],
      question_guidance: [
        { question_id: "question-1", assumptions: [], misconception_ids: [] },
      ],
      question_bank: QuestionBankMetadataSchema.parse({
        preferences: DEFAULT_QUESTION_BANK_PREFERENCES,
        items: [
          {
            question_id: "question-1",
            family_id: "family-1",
            role: "initial",
            format: "calculation",
            difficulty: "foundational",
            feedback_guidance: "Count both students in each pair.",
            reasoning_error: null,
            source_support: [
              {
                passage_id: "passage-1",
                quote: "A pair contains two members.",
                criterion: "Multiply two by two.",
              },
            ],
            calculation: {
              operation: "multiply",
              operands: [2, 2],
              expected: 4,
              unit: "students",
            },
            review_status: "needs_review",
            review_notes: "",
            quality_issues: [],
          },
        ],
        approval: null,
      }),
      activity_policy: {
        allowed_actions: ["ASK_RETRIEVAL_QUESTION"],
        allow_runtime_generation: false,
      },
    },
  };
}

test("changing away from calculation clears the hidden specification without mutating the previous item", () => {
  const original = recoveryCopy().bank.question_bank.items[0];
  for (const format of ["short_answer", "multiple_choice"] as const) {
    const patch = questionFormatChange(original, format);
    assert.equal(patch.format, format);
    assert.equal(patch.calculation, null);
  }
  assert.equal(original.calculation?.expected, 4);
  assert.deepEqual(
    questionFormatChange(original, "calculation").calculation,
    original.calculation,
  );
});

test("refresh recovery preserves unfinished delivery, calculation unit and partial guidance while saves remain strict", () => {
  const stored = recoveryCopy();
  stored.bank.question_bank.delivery = {
    closing_feedback: {
      correct_after_feedback: "",
      uncertain_after_feedback: "",
      partial_after_feedback_arithmetic_or_units: "",
      partial_or_incorrect_after_feedback: "",
    },
    fallback_message: "",
  };
  const calculation = stored.bank.question_bank.items[0].calculation;
  assert.ok(calculation);
  calculation.unit = "";
  stored.bank.questions[0].rubric.partial_credit_guidance = "";

  const recovered = parseRecovery(JSON.stringify(stored));
  assert.ok(recovered);
  assert.equal(
    recovered.revision,
    7,
    "Recovery keeps the original base revision for stale-write protection.",
  );
  assert.deepEqual(recovered.bank, stored.bank);
  assert.equal(
    QuestionBankMetadataSchema.safeParse(recovered.bank.question_bank).success,
    false,
  );
  assert.equal(
    QuestionCalculationSchema.safeParse(
      recovered.bank.question_bank.items[0].calculation,
    ).success,
    false,
  );
  assert.equal(
    QuestionSnapshotSchema.safeParse(recovered.bank.questions[0]).success,
    false,
  );
});

test("recovery continues to reject malformed cache and wrong field types", () => {
  assert.equal(parseRecovery(null), null);
  assert.equal(parseRecovery("{broken"), null);
  const stored = recoveryCopy();
  const invalid = {
    ...stored,
    bank: {
      ...stored.bank,
      questions: [
        { ...stored.bank.questions[0], prompt_text: { unexpected: true } },
      ],
    },
  };
  assert.equal(parseRecovery(JSON.stringify(invalid)), null);
});

test("changing hints invalidates reviewed policy while preserving fallback actions and refresh recovery", () => {
  const teacherId = "11111111-1111-4111-8111-111111111111";
  const draft: LessonDraftContent = makeTeacherLesson(
    makeTeacherSourceReference(
      "33333333-3333-4333-8333-333333333333",
      teacherId,
    ),
    "22222222-2222-4222-8222-222222222222",
    "1",
  );
  draft.questions = draft.questions!.slice(0, 4);
  draft.question_guidance = draft.question_guidance!.slice(0, 4);
  const roles = ["initial", "alternative", "diagnostic", "retest"];
  draft.question_bank = QuestionBankMetadataSchema.parse({
    preferences: DEFAULT_QUESTION_BANK_PREFERENCES,
    items: draft.questions.map((question, index) => ({
      question_id: question.question_id,
      family_id: "water-state",
      role: roles[index],
      format: "short_answer",
      difficulty: "intermediate",
      feedback_guidance:
        "Compare the starting and ending states: evaporation changes liquid to gas; condensation changes gas to liquid.",
      reasoning_error: index === 2 ? "The direction may be reversed." : null,
      source_support: question.rubric.criteria.map(
        (criterion, passageIndex) => ({
          passage_id: draft.passages![passageIndex].id,
          quote: draft.passages![passageIndex].text.split(". ")[0] + ".",
          criterion,
        }),
      ),
      calculation: null,
      review_status: "reviewed",
      review_notes: "",
      quality_issues: [],
    })),
    approval: null,
  });
  draft.question_bank.approval = {
    reviewed_by: teacherId,
    reviewed_at: "2026-10-22T12:00:00Z",
    content_fingerprint: fingerprintQuestionBank(draft),
  };
  assert.doesNotThrow(() => getReviewedQuestionBank(draft));
  const originalPolicy = structuredClone(draft.activity_policy!);
  const changed = {
    ...draft,
    activity_policy: withHintPermission(draft.activity_policy!, true),
  };
  assert.throws(
    () => getReviewedQuestionBank(changed),
    /explicit teacher approval/,
    "A previously approved bank cannot publish newly enabled help without review.",
  );
  assert.deepEqual(draft.activity_policy, originalPolicy);
  assert.deepEqual(changed.activity_policy.allowed_actions, [
    ...originalPolicy.allowed_actions,
    "GIVE_HINT",
  ]);
  assert.equal(changed.activity_policy.allow_runtime_generation, false);
  assert.deepEqual(
    withHintPermission(changed.activity_policy, true),
    changed.activity_policy,
    "Saving an already enabled permission must not duplicate the action.",
  );
  const recovered = parseRecovery(
    JSON.stringify({
      lesson_id: draft.content_ref!.package_id,
      revision: 7,
      bank: changed,
    }),
  );
  assert.ok(recovered);
  assert.deepEqual(recovered.bank.activity_policy, changed.activity_policy);
  assert.deepEqual(
    withHintPermission(recovered.bank.activity_policy, false),
    originalPolicy,
    "Disabling hints must preserve neutral clarification and fallback permissions.",
  );
});
