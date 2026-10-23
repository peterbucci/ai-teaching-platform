import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { ContentRefSchema } from "../lib/evidence/contracts.ts";
import {
  loadApprovedContent,
  validateContentRef,
  validateQuestionSnapshot,
} from "../lib/evidence/content.ts";
import {
  hydrateLessonContent,
  serializeLessonContent,
} from "../lib/lessons/validate.ts";
import {
  makeTeacherLesson,
  makeTeacherSourceReference,
} from "./fixtures/teacher-lesson.ts";

const fixture = () =>
  makeTeacherLesson(
    makeTeacherSourceReference(randomUUID(), randomUUID()),
    randomUUID(),
    "1",
  );
test("curated source IDs survive serialization and uploaded refs need no fabricated Git hash", () => {
  const curated = loadApprovedContent();
  assert.deepEqual(
    hydrateLessonContent(serializeLessonContent(curated)).content_ref,
    curated.content_ref,
  );
  const data = fixture();
  const resolved = hydrateLessonContent(data);
  assert.equal("source_commit" in resolved.content_ref, false);
  assert.equal(resolved.misconceptions.size, 0);
  assert.equal(resolved.questions.get("WC-01")?.concept_ids.length, 2);
  assert.throws(() =>
    ContentRefSchema.parse({
      ...data.content_ref,
      source_commit: "a".repeat(40),
    }),
  );
  validateContentRef(resolved, JSON.parse(JSON.stringify(data.content_ref)));
});
test("published content rejects foreign versions, passage scope, hashes and duplicate IDs", () => {
  const mutations: ((data: ReturnType<typeof fixture>) => void)[] = [
    (d) => {
      d.questions[0].content_ref.content_version = "wrong";
    },
    (d) => {
      d.questions[0].source_passage_ids = ["P01"];
    },
    (d) => {
      d.passages[0].source_id = randomUUID();
    },
    (d) => {
      d.passages[0].text = "Changed without source review";
    },
    (d) => {
      d.concepts.push(d.concepts[0]);
    },
    (d) => {
      d.sequence.diagnostic_options[0].misconception_id =
        "transmission_depends_on_distance";
    },
    (d) => {
      d.questions[0].rubric.answer_guidance = "";
    },
  ];
  for (const change of mutations) {
    const data = structuredClone(fixture());
    change(data);
    assert.throws(() => hydrateLessonContent(data));
  }
});
test("publication rejects unsupported or incomplete fallback sequences", () => {
  for (const change of [
    (d: ReturnType<typeof fixture>) => {
      d.sequence.nodes.find((n) => n.node_id === "WC-RETEST-2")!.next_node_id =
        "WC-RETEST-1";
    },
    (d: ReturnType<typeof fixture>) => {
      d.sequence.nodes.find(
        (n) => n.kind === "corrective_feedback",
      )!.next_node_id = "WC-RETEST-2";
    },
    (d: ReturnType<typeof fixture>) => {
      d.activity_policy.allowed_actions = ["END_SESSION"];
    },
  ]) {
    const data = fixture();
    change(data);
    assert.throws(() => hydrateLessonContent(data));
  }
});
test("feedback cannot reuse an already answered prompt as its fresh retest", () => {
  const data = fixture();
  data.questions.find((q) => q.question_id === "WC-RETEST-1")!.prompt_text =
    data.questions[0].prompt_text;
  data.sequence.nodes.find((n) => n.node_id === "WC-RETEST-1")!.prompt =
    data.questions[0].prompt_text;
  assert.throws(() => hydrateLessonContent(data), /retest must differ/);
});

test("runtime generated snapshots can be validated without catalog registration but cannot replace a saved question", () => {
  const content = hydrateLessonContent(fixture());
  const question = structuredClone(content.questions.get("WC-01")!);
  question.origin = "generated";
  question.question_id = randomUUID();
  question.generation = {
    model: "fixture-only",
    prompt_template_version: "test",
    generated_at: "2026-10-22T12:00:00Z",
  };
  assert.deepEqual(validateQuestionSnapshot(content, question), question);
  question.question_id = "WC-01";
  assert.throws(() => validateQuestionSnapshot(content, question));
});

test("diagnostic mappings must assess their misconception's concrete concept", () => {
  const data = fixture();
  data.misconceptions.push({
    id: "evaporation_disappears",
    concept_id: "evaporation",
    definition: "Evaporated water no longer exists.",
  });
  data.sequence.diagnostic_options = [
    {
      misconception_id: "evaporation_disappears",
      question_id: "WC-DIAGNOSTIC",
    },
  ];
  const diagnostic = data.questions.find(
    (q) => q.question_id === "WC-DIAGNOSTIC",
  )!;
  diagnostic.concept_ids = ["condensation"];
  assert.throws(
    () => hydrateLessonContent(data),
    /Diagnostic must assess its mapped misconception's concept/,
  );
  diagnostic.concept_ids = ["evaporation"];
  assert.doesNotThrow(() => hydrateLessonContent(data));
  diagnostic.concept_ids.push("condensation");
  assert.doesNotThrow(() => hydrateLessonContent(data));
  data.misconceptions[0].concept_id = null;
  assert.deepEqual(
    serializeLessonContent(hydrateLessonContent(data)),
    data,
    "Global category mappings remain readable without changing saved content",
  );
  data.sequence.diagnostic_options[0].misconception_id = null;
  assert.doesNotThrow(() => hydrateLessonContent(data));
});
