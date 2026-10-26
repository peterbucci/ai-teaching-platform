import test from "node:test";
import assert from "node:assert/strict";
import {
  makeTeacherLesson,
  makeTeacherSourceReference,
} from "../../../../../tests/fixtures/teacher-lesson.ts";
import { projectStudentQuestion } from "../../../../../lib/question-bank/contracts.ts";
import {
  bankNavigationWarning,
  currentBankQuestion,
  groupBankQuestions,
  shouldGuardBankNavigation,
  questionReadingPassages,
  exactQuoteSegments,
} from "./workbench-state.ts";

function questions() {
  const lesson = makeTeacherLesson(
    makeTeacherSourceReference(
      "33333333-3333-4333-8333-333333333333",
      "11111111-1111-4111-8111-111111111111",
    ),
    "22222222-2222-4222-8222-222222222222",
    "1",
  );
  assert.ok(lesson.questions?.length);
  return lesson.questions.slice(0, 3);
}

test("multi-concept grouping keeps each question once and retains exact private criteria and source identity", () => {
  const bank = questions();
  bank[0].concept_ids = ["evaporation", "condensation"];
  bank[1].concept_ids = ["condensation"];
  bank[2].concept_ids = ["evaporation"];
  const original = structuredClone(bank);
  const groups = groupBankQuestions(bank, [
    { id: "evaporation", title: "Evaporation" },
    { id: "condensation", title: "Condensation" },
  ]);
  assert.deepEqual(
    groups.map((group) => group.questions.map((entry) => entry.index)),
    [[0, 2], [1]],
  );
  assert.equal(groups.flatMap((group) => group.questions).length, bank.length);
  assert.equal(groups[0].questions[0].question, bank[0]);
  assert.deepEqual(bank, original);
  const student = projectStudentQuestion(groups[0].questions[0].question);
  assert.equal("rubric" in student, false);
  assert.equal("answer_guidance" in student, false);
  assert.deepEqual(student.concept_ids, ["evaporation", "condensation"]);
});

test("questions with missing or unknown concepts remain reachable for correction", () => {
  const bank = questions();
  bank[0].concept_ids = [];
  bank[1].concept_ids = ["removed-concept"];
  bank[2].concept_ids = ["valid"];
  const groups = groupBankQuestions(bank, [
    { id: "valid", title: "Reviewed objective" },
  ]);
  assert.deepEqual(
    groups.map((group) => [
      group.id,
      group.questions.map((entry) => entry.index),
    ]),
    [
      ["valid", [2]],
      ["unassigned", [0, 1]],
    ],
  );
});

test("selection follows the stable ID through reorder and falls back safely after removal", () => {
  const bank = questions();
  const selected = bank[1];
  assert.equal(
    currentBankQuestion([bank[2], bank[1], bank[0]], selected.question_id),
    selected,
  );
  assert.equal(
    currentBankQuestion([bank[2], bank[0]], selected.question_id),
    bank[2],
  );
  assert.equal(currentBankQuestion([], selected.question_id), null);
});

test("reading follows the selected question while retaining source order, identity and usage", () => {
  const lesson = makeTeacherLesson(
    makeTeacherSourceReference(
      "33333333-3333-4333-8333-333333333333",
      "11111111-1111-4111-8111-111111111111",
    ),
    "22222222-2222-4222-8222-222222222222",
    "1",
  );
  const selected = lesson.questions[0];
  selected.source_passage_ids = [lesson.passages[1].id];
  const original = structuredClone(lesson);
  const reading = questionReadingPassages(
    lesson.passages,
    lesson.questions,
    lesson.concepts,
    selected.question_id ?? null,
    [],
  );
  assert.equal(reading[0].passage, lesson.passages[1]);
  assert.equal(reading[0].index, 1);
  assert.equal(reading[0].linked, true);
  assert.ok(reading[0].uses.includes("Q1"));
  assert.ok(reading[0].uses.every((usage) => /^[OQ]\d+$/.test(usage)));
  assert.deepEqual(lesson, original);
  const overview = questionReadingPassages(
    lesson.passages,
    lesson.questions,
    lesson.concepts,
    null,
    [],
  );
  assert.deepEqual(
    overview.map((item) => item.passage.id),
    lesson.passages.map((item) => item.id),
  );
  assert.ok(overview.every((item) => !item.linked));
});

test("quote highlighting preserves exact text and does not mark unsupported wording", () => {
  const text =
    "Water vapor becomes liquid. <script> remains ordinary source text.";
  const parts = exactQuoteSegments(text, [
    "Water vapor",
    "vapor becomes liquid",
    "not in the source",
    "",
    "<script>",
  ]);
  assert.equal(parts.map((part) => part.text).join(""), text);
  assert.deepEqual(
    parts.filter((part) => part.marked).map((part) => part.text),
    ["Water vapor becomes liquid", "<script>"],
  );
  assert.deepEqual(exactQuoteSegments(text, ["different wording"]), [
    { text, marked: false },
  ]);
});

test("dirty-navigation guard protects page changes without blocking recovery downloads or source inspection", () => {
  const click = {
    href: "https://example.test/teacher/lessons",
    currentHref: "https://example.test/teacher/lessons/lesson-1/questions",
    target: "",
    download: false,
    modified: false,
    button: 0,
  };
  assert.equal(shouldGuardBankNavigation(click), true);
  for (const safe of [
    { download: true },
    { target: "_blank" },
    { modified: true },
    { button: 1 },
    { href: "blob:https://example.test/recovery" },
    { href: click.currentHref + "#question-1" },
  ])
    assert.equal(shouldGuardBankNavigation({ ...click, ...safe }), false);
  assert.match(bankNavigationWarning(false), /edits will be lost/);
  assert.doesNotMatch(bankNavigationWarning(false), /copy stays/);
  assert.match(bankNavigationWarning(true), /copy stays in this tab/);
});
