import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { z } from "zod";
import { evaluationPrompt } from "../lib/evaluation/evaluate.ts";
import { buildDemoFixture } from "../lib/evidence/demo.ts";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import {
  AttemptSchema,
  QuestionSnapshotSchema,
} from "../lib/evidence/contracts.ts";
import {
  deriveAssistance,
  toStudentSessionView,
} from "../lib/evidence/rules.ts";
import { hydrateLessonContent } from "../lib/lessons/validate.ts";
import {
  makeTeacherLesson,
  makeTeacherSourceReference,
} from "./fixtures/teacher-lesson.ts";

function uploadedAttempt() {
  const prepared = buildDemoFixture(loadApprovedContent()).sessions[0];
  const published = makeTeacherLesson(
    makeTeacherSourceReference(randomUUID(), randomUUID()),
    randomUUID(),
    "water-v1",
  );
  const content = hydrateLessonContent(published);
  const authored = content.questions.get("WC-DIAGNOSTIC");
  assert.ok(authored);
  const question = QuestionSnapshotSchema.parse({
    ...authored,
    origin: "generated",
    question_id: randomUUID(),
    controller_node_id: "WC-DIAGNOSTIC",
    prompt_text:
      "Explain where the liquid water from a drying puddle goes and where droplets on a cold glass come from.",
    rubric: {
      ...authored.rubric,
      answer_guidance:
        "PRIVATE_GENERATED_GUIDANCE: Water changes state; it does not cease to exist.",
    },
    generation: {
      model: "fixture-only",
      prompt_template_version: "uploaded-evaluation-test",
      generated_at: "2026-10-23T12:00:00Z",
    },
  });
  const original = prepared.attempts[0];
  assert.ok(original.submitted_at);
  const attempt = AttemptSchema.parse({
    ...original,
    intent: "diagnostic_followup",
    question,
    response_text:
      "The puddle water became vapor. Water vapor from the air condensed onto the cold glass.",
    assistance: deriveAssistance(
      question,
      "diagnostic_followup",
      original.presented_at,
      original.submitted_at,
      [],
    ),
    current_evaluation_id: null,
    outcome: null,
  });
  return { prepared, content, attempt, published };
}

test("uploaded generated attempts use their immutable private rubric and exact source version in the existing evaluator", () => {
  const { prepared, content, attempt } = uploadedAttempt();
  const before = structuredClone(attempt);
  assert.equal(content.questions.has(attempt.question.question_id!), false);
  const prompt = evaluationPrompt(content, attempt);
  const input = z
    .object({
      question: QuestionSnapshotSchema,
      question_assumptions: z.array(z.string()),
      concepts: z.array(z.object({ id: z.string() })),
      passages: z.array(
        z.object({ id: z.string(), source_version: z.number() }),
      ),
      student_response: z.string(),
    })
    .parse(JSON.parse(prompt.input));
  assert.deepEqual(input.question, attempt.question);
  assert.equal(input.student_response, attempt.response_text);
  assert.deepEqual(
    input.question_assumptions,
    [],
    "Generated UUID cannot inherit guidance from an authored slot",
  );
  assert.deepEqual(input.concepts.map((c) => c.id).sort(), [
    "condensation",
    "evaporation",
  ]);
  assert.ok(
    input.passages.every(
      (p) => p.source_version === 1 && p.id.startsWith("water-"),
    ),
  );
  assert.ok(prompt.input.includes("PRIVATE_GENERATED_GUIDANCE"));
  assert.equal(prompt.input.includes("transmission_delay"), false);
  assert.match(prompt.instructions, /source[\s\S]*untrusted data/);
  assert.deepEqual(attempt, before);
  const publicView = toStudentSessionView({
    ...prepared,
    attempts: [attempt],
    evaluations: [],
    interventions: [],
  });
  assert.equal(
    JSON.stringify(publicView).includes("PRIVATE_GENERATED_GUIDANCE"),
    false,
  );
  assert.equal(JSON.stringify(publicView).includes('"rubric"'), false);
});

test("uploaded evaluation rejects replacement source versions and out-of-scope concepts before model work", () => {
  const { content, attempt, published } = uploadedAttempt();
  const newer = hydrateLessonContent(
    makeTeacherLesson(
      makeTeacherSourceReference(randomUUID(), randomUUID(), 2),
      published.content_ref.package_id,
      "water-v2",
    ),
  );
  assert.throws(() => evaluationPrompt(newer, attempt), /Unknown content/);
  const changed = structuredClone(attempt);
  if (!("source_kind" in changed.question.content_ref))
    throw new Error("Expected uploaded reference");
  changed.question.content_ref.access_scope.teacher_id = randomUUID();
  assert.throws(() => evaluationPrompt(content, changed), /Unknown content/);
  const foreignConcept = structuredClone(attempt);
  foreignConcept.question.concept_ids = ["transmission_delay"];
  assert.throws(
    () => evaluationPrompt(content, foreignConcept),
    /Unknown question concept/,
  );
});
