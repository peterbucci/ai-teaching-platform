import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  LessonDraftContentSchema,
  projectLessonDraftContent,
  type LessonDraftContent,
} from "../lib/lessons/contracts.ts";
import {
  DEFAULT_QUESTION_BANK_PREFERENCES,
  QuestionBankMetadataSchema,
  projectStudentQuestion,
} from "../lib/question-bank/contracts.ts";
import {
  areQuestionsTooSimilar,
  calculateQuestionAnswer,
  fingerprintQuestionBank,
  getReviewedQuestionBank,
  validateQuestionBank,
} from "../lib/question-bank/validation.ts";
import {
  makeTeacherLesson,
  makeTeacherSourceReference,
} from "./fixtures/teacher-lesson.ts";

const teacherId = "11111111-1111-4111-8111-111111111111";
const lessonId = "22222222-2222-4222-8222-222222222222";
const sourceId = "33333333-3333-4333-8333-333333333333";

function bank(): LessonDraftContent {
  const draft: LessonDraftContent = makeTeacherLesson(
    makeTeacherSourceReference(sourceId, teacherId),
    lessonId,
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
      reasoning_error:
        index === 2
          ? "The student may be reversing the direction of the state change; this remains uncertain."
          : null,
      source_support: question.rubric.criteria.map(
        (criterion, criterionIndex) => ({
          passage_id: draft.passages![criterionIndex].id,
          quote: draft.passages![criterionIndex].text.split(". ")[0] + ".",
          criterion,
        }),
      ),
      calculation: null,
      review_status: "needs_review",
      review_notes: "",
      quality_issues: [],
    })),
    approval: null,
  });
  delete draft.approval;
  return draft;
}

function approve(draft: LessonDraftContent) {
  for (const item of draft.question_bank!.items)
    item.review_status = "reviewed";
  draft.question_bank!.approval = {
    reviewed_by: teacherId,
    reviewed_at: "2026-10-22T12:00:00Z",
    content_fingerprint: fingerprintQuestionBank(draft),
  };
}

function messages(draft: unknown) {
  return validateQuestionBank(draft)
    .map((issue) => issue.message)
    .join("\n");
}

test("question bank reuses approved multi-concept snapshots and private guidance without whole-lesson approval", () => {
  const draft = bank();
  delete draft.sequence;
  assert.deepEqual(validateQuestionBank(draft), []);
  assert.throws(() => getReviewedQuestionBank(draft), /Review every question/);
  approve(draft);
  const reviewed = getReviewedQuestionBank(draft);
  assert.deepEqual(reviewed.questions[0].concept_ids, [
    "evaporation",
    "condensation",
  ]);
  assert.equal(
    reviewed.items[2].reasoning_error,
    draft.question_bank!.items[2].reasoning_error,
  );
  assert.equal(reviewed.question_guidance[2].misconception_ids.length, 0);
  reviewed.questions[0].prompt_text = "Local preview edit";
  assert.notEqual(draft.questions![0].prompt_text, "Local preview edit");
});

test("approval binds source, objectives, preferences, teacher edits and delivery but permits separate sequence assembly", () => {
  const draft = bank();
  approve(draft);
  const previous = fingerprintQuestionBank(draft);
  draft.sequence!.sequence_id = "assembled-by-publication";
  for (const question of draft.questions!)
    question.sequence_id = "assembled-by-publication";
  assert.equal(fingerprintQuestionBank(draft), previous);
  assert.doesNotThrow(() => getReviewedQuestionBank(draft));
  draft.question_bank!.preferences.student_instructions =
    "Explain the starting and ending states.";
  assert.throws(
    () => getReviewedQuestionBank(draft),
    /explicit teacher approval/,
  );
  assert.notEqual(fingerprintQuestionBank(draft), previous);
  approve(draft);
  draft.question_bank!.delivery.fallback_message =
    "Revised teacher instructions.";
  assert.throws(
    () => getReviewedQuestionBank(draft),
    /explicit teacher approval/,
  );
});

test("unsupported source references, copied foreign snapshots and unapproved concepts are flagged", () => {
  const draft = bank();
  draft.questions![0].source_passage_ids = ["foreign-passage"];
  draft.questions![0].concept_ids = ["unknown-concept"];
  draft.questions![0].content_ref.content_version = "another-version";
  assert.match(messages(draft), /different lesson or source version/);
  assert.match(messages(draft), /Unknown question concept/);
  assert.match(messages(draft), /Unknown question passage/);
  const unapproved = bank();
  const invalid = {
    ...unapproved,
    concepts: unapproved.concepts!.map((concept) => ({
      ...concept,
      review_status: "draft",
    })),
  };
  assert.match(messages(invalid), /review_status/);
});

test("private answer criteria require actual supporting quotes, not merely valid passage IDs", () => {
  const draft = bank();
  draft.question_bank!.items[0].source_support[0].quote =
    "Evaporation turns gas directly into ice.";
  assert.match(messages(draft), /does not occur verbatim/);
  draft.questions![1].rubric.criteria = [];
  draft.questions![1].rubric.partial_credit_guidance = null;
  assert.match(messages(draft), /nonempty expected-answer criterion/);
  assert.match(messages(draft), /Partial-answer guidance/);
  draft.question_bank!.items[2].source_support.pop();
  assert.match(messages(draft), /has no supporting source quote/);
});

test("exact source identity and passage hash changes invalidate the reviewed bank", () => {
  const draft = bank();
  approve(draft);
  draft.passages![0].text += " A new teacher sentence.";
  assert.match(messages(draft), /mismatched text hash/);
  draft.passages![0].sha256 = createHash("sha256")
    .update(draft.passages![0].text)
    .digest("hex");
  assert.throws(
    () => getReviewedQuestionBank(draft),
    /explicit teacher approval/,
  );
  draft.passages![0].source_version = 2;
  assert.match(messages(draft), /exact source version/);
});

test("unknown misconceptions remain hypotheses and cannot become approved category references", () => {
  const draft = bank();
  assert.deepEqual(validateQuestionBank(draft), []);
  draft.question_guidance![2].misconception_ids = ["invented-reversal"];
  draft.question_bank!.preferences.misconception_ids = ["invented-reversal"];
  assert.match(messages(draft), /Unknown or out-of-scope misconception/);
  assert.match(
    messages(draft),
    /Keep unconfirmed reasoning errors as hypotheses/,
  );
});

test("retests require a complete family and meaningful mechanical variation", () => {
  const draft = bank();
  draft.questions![3].prompt_text =
    draft.questions![0].prompt_text.toUpperCase();
  assert.match(messages(draft), /Retest is too similar/);
  assert.equal(
    areQuestionsTooSimilar(
      "Calculate 10 divided by 2.",
      "Calculate 20 divided by 4.",
    ),
    true,
  );
  assert.equal(
    areQuestionsTooSimilar(
      "Explain how a wet towel dries.",
      "Predict where droplets might form near a cold glass and explain their origin.",
    ),
    false,
  );
  draft.question_bank!.items[2].role = "alternative";
  assert.match(messages(draft), /needs a diagnostic/);
});

test("different question formats need answerable choices or reviewed calculations", () => {
  const draft = bank();
  const question = draft.questions![0];
  const item = draft.question_bank!.items[0];
  item.format = "multiple_choice";
  assert.match(messages(draft), /distinct labeled choices/);
  question.prompt_text =
    "Which changes describe the puddle shrinking and droplets forming?\nA. Liquid to gas, then gas to liquid\nB. Gas to liquid, then liquid to gas\nExplain your choice.";
  assert.doesNotMatch(messages(draft), /distinct labeled choices/);
  item.format = "calculation";
  assert.match(messages(draft), /code-verifiable calculation/);
  question.prompt_text =
    "A container has 10 mL of water and 2 mL evaporates. Calculate the remaining liquid volume.";
  question.rubric.answer_guidance = "10 minus 2 leaves 8 mL of liquid water.";
  item.calculation = {
    operation: "subtract",
    operands: [10, 2],
    expected: 9,
    unit: "mL",
  };
  assert.match(messages(draft), /reviewed arithmetic gives 8/);
  item.calculation.expected = 8;
  assert.doesNotMatch(
    messages(draft),
    /calculation result|checked numerical|operand/,
  );
  item.calculation.operands = [10, 0];
  item.calculation.operation = "divide";
  assert.match(messages(draft), /Division by zero/);
});

test("bounded arithmetic computes in code and rejects nonfinite results", () => {
  const base = {
    operation: "add" as const,
    operands: [0.1, 0.2],
    expected: 0.3,
    unit: "L",
  };
  assert.ok(Math.abs(calculateQuestionAnswer(base) - 0.3) < 1e-12);
  assert.equal(
    calculateQuestionAnswer({
      ...base,
      operation: "divide",
      operands: [20, 2, 5],
    }),
    2,
  );
  assert.throws(
    () =>
      calculateQuestionAnswer({
        ...base,
        operation: "multiply",
        operands: [1e308, 1e308],
      }),
    /not finite/,
  );
});

test("educational review failures block approval even when the structural references are valid", () => {
  const draft = bank();
  draft.question_bank!.items[1].quality_issues = [
    "The expected answer contradicts the quoted passage.",
  ];
  approve(draft);
  assert.throws(
    () => getReviewedQuestionBank(draft),
    /contradicts the quoted passage/,
  );
});

test("student projection excludes rubrics, expected answers, private review and generation metadata", () => {
  const draft = bank();
  const projected = projectStudentQuestion(draft.questions![0]);
  assert.deepEqual(Object.keys(projected).sort(), [
    "concept_ids",
    "prompt_text",
    "question_id",
    "source_passage_ids",
  ]);
  assert.doesNotMatch(
    JSON.stringify(projected),
    /answer_guidance|criteria|review_notes|quality_issues|generation/,
  );
  projected.concept_ids.push("local-only");
  assert.equal(draft.questions![0].concept_ids.includes("local-only"), false);
});

test("draft-only metadata is retained by authoring schema and omitted from publication projection", () => {
  const draft = LessonDraftContentSchema.parse(bank());
  assert.ok(draft.question_bank);
  const publication = projectLessonDraftContent(draft);
  assert.equal("question_bank" in publication, false);
  assert.deepEqual(publication.questions, draft.questions);
});
