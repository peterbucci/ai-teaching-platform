import assert from "node:assert/strict";
import test from "node:test";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { assignedReading } from "../lib/assignments/reading.ts";
import { deriveAssistance } from "../lib/evidence/rules.ts";
import { getCuratedQuestion } from "../lib/evidence/content.ts";
import { InterventionSchema } from "../lib/evidence/contracts.ts";
import { randomUUID } from "node:crypto";
import { ReadingSchema } from "../lib/assignments/contracts.ts";
import { hydrateLessonContent } from "../lib/lessons/validate.ts";
import { sourcePath } from "../lib/reading/source-path.ts";
import {
  makeTeacherLesson,
  makeTeacherSourceReference,
  teacherSourcePassages,
} from "./fixtures/teacher-lesson.ts";

test("prepared reading resolves only the pinned assigned passages and retains editorial notes", () => {
  const content = loadApprovedContent();
  const reading = assignedReading(content.content_ref);
  assert.deepEqual(
    reading.sections.map((s) => s.id),
    [...content.passage_ids],
  );
  assert.match(
    reading.sections.find((s) => s.id === "P08")!.text,
    /Project teaching note/,
  );
  assert.match(
    reading.sections.find((s) => s.id === "P10")!.text,
    /Project editorial note/,
  );
  assert.throws(
    () =>
      assignedReading({
        ...content.content_ref,
        content_version: "unavailable",
      }),
    /Unknown content/,
  );
});

test("teacher-provided reading projects its own ordered passages without private guidance or borrowed textbook metadata", () => {
  const source = makeTeacherSourceReference(randomUUID(), randomUUID());
  const content = hydrateLessonContent(
    makeTeacherLesson(source, randomUUID(), "water-v1"),
  );
  const reading = ReadingSchema.parse(
    assignedReading(content.content_ref, content),
  );
  assert.deepEqual(
    reading.sections.map((section) => section.id),
    ["water-01", "water-02"],
  );
  assert.deepEqual(
    reading.sections.map((section) => section.text),
    teacherSourcePassages.map((passage) => passage.text),
  );
  assert.deepEqual(
    reading.sections.map((section) => section.title),
    ["Evaporation", "Condensation"],
  );
  assert.equal(reading.attribution.title, "Water changing state");
  assert.equal(reading.attribution.url, null);
  assert.equal(reading.attribution.license_url, null);
  assert.equal("questions" in reading, false);
  assert.equal("rubric" in reading, false);
  assert.deepEqual(
    sourcePath(reading.attribution.section, reading.content_ref),
    [{ number: null, title: "Evaporation and condensation", kind: "section" }],
  );
});

test("reading keeps a saved teacher lesson version and rejects a reference from a newer publication", () => {
  const source = makeTeacherSourceReference(randomUUID(), randomUUID());
  const lessonId = randomUUID();
  const oldContent = hydrateLessonContent(
    makeTeacherLesson(source, lessonId, "water-v1"),
  );
  const nextContent = hydrateLessonContent(
    makeTeacherLesson(source, lessonId, "water-v2"),
  );
  assert.throws(
    () => assignedReading(nextContent.content_ref, oldContent),
    /Unknown content/,
  );
  assert.equal(
    assignedReading(oldContent.content_ref, oldContent).content_ref
      .content_version,
    "water-v1",
  );
  assert.equal(
    assignedReading(nextContent.content_ref, nextContent).content_ref
      .content_version,
    "water-v2",
  );
});

test("reading counts only after display and only for supported concepts; later reading cannot rewrite prior performance", () => {
  const content = loadApprovedContent();
  const question = getCuratedQuestion(content, "NP-TX-01");
  const reading = InterventionSchema.parse({
    id: randomUUID(),
    session_id: randomUUID(),
    related_attempt_id: randomUUID(),
    related_evaluation_id: null,
    type: "reading",
    text_shown: "Prepared source passage",
    concept_ids: ["transmission_delay"],
    source_passage_ids: ["P05"],
    content_ref: content.content_ref,
    created_at: "2026-10-21T10:00:01Z",
    visible_at: null,
    delivery_status: "created",
  });
  const derive = (
    items: (typeof reading)[],
    submitted = "2026-10-21T10:00:10Z",
  ) =>
    deriveAssistance(
      question,
      "initial_retrieval",
      "2026-10-21T10:00:00Z",
      submitted,
      items,
    );
  assert.equal(derive([reading]).assistance_level, "none_recorded");
  const displayed = InterventionSchema.parse({
    ...reading,
    visible_at: "2026-10-21T10:00:02Z",
    delivery_status: "displayed",
  });
  const result = derive([displayed]);
  assert.equal(result.assistance_level, "reading");
  assert.deepEqual(result.independent_retrieval_eligible_by_concept, {
    transmission_delay: false,
    propagation_delay: true,
  });
  assert.equal(
    derive([displayed], "2026-10-21T10:00:01Z").assistance_level,
    "none_recorded",
  );
  assert.equal(
    derive([InterventionSchema.parse({ ...displayed, concept_ids: [] })])
      .assistance_level,
    "none_recorded",
  );
});
