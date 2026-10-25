import assert from "node:assert/strict";
import test from "node:test";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { hydrateLessonContent } from "../lib/lessons/validate.ts";
import {
  assignmentLessonCoverage,
  projectStudentLearningPreview,
} from "../app/teacher/assignments/preview-model.ts";
import {
  makeTeacherLesson,
  makeTeacherSourceReference,
  teacherSourcePassages,
} from "./fixtures/teacher-lesson.ts";

const source = makeTeacherSourceReference(
  "33333333-3333-4333-8333-333333333333",
  "11111111-1111-4111-8111-111111111111",
);
function teacherContent(version = "water-v1") {
  return hydrateLessonContent(
    makeTeacherLesson(source, "22222222-2222-4222-8222-222222222222", version),
  );
}

test("assignment coverage includes sequence-only questions and counts each prepared question once", () => {
  const content = loadApprovedContent();
  const coverage = assignmentLessonCoverage(content, content.content_ref);
  const sequenceOnly = content.sequence.nodes.filter(
    (node) =>
      node.node_id !== content.sequence.initial_question_id &&
      content.questions.has(node.node_id),
  );
  assert.ok(sequenceOnly.length > 0);
  assert.equal(coverage.questionCount, content.questions.size);
  assert.equal(coverage.sequenceQuestionCount, sequenceOnly.length + 1);
  assert.equal(coverage.passageCount, content.passages.size);
  const concept = coverage.concepts.find(
    (item) => item.id === "transmission_delay",
  );
  assert.ok(concept);
  assert.ok(concept.questionCount > sequenceOnly.length);
  assert.equal(
    concept.questionCount,
    [...content.questions.values()].filter((question) =>
      question.concept_ids.includes(concept.id),
    ).length,
  );
});

test("uploaded lessons retain all objectives and multi-concept coverage without treating concept totals as distinct questions", () => {
  const content = teacherContent();
  const coverage = assignmentLessonCoverage(content, content.content_ref);
  assert.equal(coverage.questionCount, 5);
  assert.equal(coverage.sequenceQuestionCount, 5);
  assert.equal(coverage.passageCount, 2);
  assert.deepEqual(
    coverage.concepts.map((concept) => ({
      id: concept.id,
      questionCount: concept.questionCount,
      passageIds: concept.passageIds,
      objectives: concept.objectives,
    })),
    [
      {
        id: "evaporation",
        questionCount: 5,
        passageIds: ["water-01"],
        objectives: ["Explain liquid water changing to water vapor."],
      },
      {
        id: "condensation",
        questionCount: 5,
        passageIds: ["water-02"],
        objectives: ["Explain water vapor changing to liquid water."],
      },
    ],
  );
});

test("student preview allowlist excludes every private question, rubric, hypothesis and future feedback field", () => {
  const content = teacherContent();
  const privateMarker = "PRIVATE-CONTENT-MUST-NOT-LEAVE-SERVER";
  for (const question of content.questions.values()) {
    question.prompt_text = `${privateMarker}: unrevealed question`;
    question.rubric.answer_guidance = `${privateMarker}: answer guidance`;
    question.rubric.criteria = [`${privateMarker}: grading criteria`];
    question.rubric.acceptable_variations = [`${privateMarker}: variations`];
    question.rubric.partial_credit_guidance = `${privateMarker}: partial credit`;
  }
  content.sequence.hypothesis_id = `${privateMarker}: hypothesis`;
  content.sequence.interpretation_rules = [`${privateMarker}: interpretation`];
  for (const node of content.sequence.nodes) {
    node.prompt = `${privateMarker}: diagnostic prompt`;
    node.expected_answer = `${privateMarker}: expected answer`;
    node.feedback = `${privateMarker}: future feedback`;
    node.feedback_variants = { example: `${privateMarker}: feedback variant` };
  }
  for (const concept of content.concepts.values()) {
    concept.boundaries = [`${privateMarker}: teacher boundary`];
    concept.common_misconceptions = [
      {
        id: "private-pattern",
        definition: `${privateMarker}: misconception`,
        evidence_that_may_support: `${privateMarker}: evidence`,
        diagnostic_caution: `${privateMarker}: caution`,
      },
    ];
  }
  const preview = projectStudentLearningPreview(content, content.content_ref);
  const serialized = JSON.stringify(preview);
  assert.equal(serialized.includes(privateMarker), false);
  for (const key of [
    "rubric",
    "questions",
    "hypothesis_id",
    "expected_answer",
    "feedback_variants",
    "interpretation_rules",
    "common_misconceptions",
    "scoring_policy",
  ])
    assert.equal(serialized.includes(`"${key}"`), false, key);
  assert.deepEqual(
    preview.reading.sections.map((section) => section.text),
    teacherSourcePassages.map((passage) => passage.text),
  );
  assert.deepEqual(preview.contentRef, content.content_ref);
  assert.deepEqual(preview.reading.content_ref, content.content_ref);
  assert.equal(preview.concepts.length, 2);
  assert.ok(preview.interactions.length > 2);
});

test("review and student preview reject a different publication or source version instead of silently substituting content", () => {
  const content = teacherContent();
  const newer = teacherContent("water-v2");
  for (const project of [
    assignmentLessonCoverage,
    projectStudentLearningPreview,
  ]) {
    assert.throws(
      () => project(content, newer.content_ref),
      /Unknown content\/source version/,
    );
    if (!("source_version" in content.content_ref))
      throw new Error("Expected an uploaded fixture");
    assert.throws(
      () => project(content, { ...content.content_ref, source_version: 2 }),
      /Unknown content\/source version/,
    );
    assert.throws(
      () =>
        project(content, {
          ...content.content_ref,
          excerpt_sha256: "0".repeat(64),
        }),
      /Unknown content\/source version/,
    );
  }
  const curated = loadApprovedContent();
  assert.throws(
    () => projectStudentLearningPreview(curated, content.content_ref),
    /Unknown content\/source version/,
  );
});
