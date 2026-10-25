import assert from "node:assert/strict";
import test from "node:test";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import type { ContentRef } from "../lib/evidence/contracts.ts";
import { freshCheckConceptNames } from "../lib/interventions/student-concept-names.ts";

const curated = loadApprovedContent().content_ref;
const uploaded: ContentRef = {
  source_kind: "uploaded",
  package_id: "fictional-water-cycle",
  content_version: "1",
  source_id: "48bae4f7-63a2-4876-bc6d-b5b2d99a6b9f",
  source_version: 1,
  document_sha256: "c".repeat(64),
  excerpt_sha256: "d".repeat(64),
  attribution: {
    title: "Fictional water cycle",
    authors: ["Fictional teacher"],
    copyright: "Synthetic test material",
    section: "Evaporation",
    url: null,
    license: "Synthetic test material",
    license_url: null,
    cautions: [],
  },
  access_scope: { teacher_id: "11111111-1111-4111-8111-111111111111" },
};
function fixture(content_ref: ContentRef) {
  const concept = {
    id: "d1edb362-fa58-4e34-b8af-08c1f685e583",
    title: "Evaporation",
    objectives: ["Explain evaporation."],
    boundaries: [],
    review_status: "approved" as const,
    common_misconceptions: [],
    source_passage_ids: ["p001"],
  };
  const related = { ...concept, id: "condensation", title: "Condensation" };
  const question = {
    question_id: "fresh-check",
    prompt_text: "Explain the change of state.",
    concept_ids: [concept.id, related.id],
    source_passage_ids: ["p001"],
  };
  const intervention = {
    content_ref,
    activity: {
      title: "Review",
      learning_objective: "Explain changes of state.",
      explanation: "Fictional explanation",
      exercise_text: "Fictional exercise",
      practice_questions: [],
      fresh_check: question,
      source_references: [],
    },
  };
  return {
    concept,
    related,
    question,
    intervention,
    content: {
      content_ref,
      concepts: new Map([
        [concept.id, concept],
        [related.id, related],
      ]),
    },
  };
}

test("the accepted follow-up uses pinned public names without changing evidence", () => {
  for (const ref of [curated, uploaded]) {
    const f = fixture(ref);
    const saved = {
      evaluation_status: "accepted",
      results: [
        { concept_id: f.concept.id, correctness: "correct" },
        { concept_id: f.related.id, correctness: "partially_correct" },
      ],
      uncertain: true,
      assistance: {
        assistance_level: "corrective_feedback",
        intervention_ids: ["saved-help"],
      },
      content_ref: ref,
    };
    const before = JSON.stringify({ saved, intervention: f.intervention });
    const names = freshCheckConceptNames(f.content, f.intervention);
    // N7 does not include the teacher Workbench helper from the source PR base.
    // Assert the public names directly; combined browser checks compare the
    // authenticated teacher and student views of the same accepted evaluation.
    assert.equal(names[f.concept.id], "Evaporation");
    assert.equal(names[f.related.id], "Condensation");
    assert.equal(
      JSON.stringify({ saved, intervention: f.intervention }),
      before,
    );
    assert.deepEqual(
      Object.keys(names).sort(),
      f.question.concept_ids.toSorted(),
    );
  }
});

test("a newer lesson or different source cannot relabel the saved follow-up", () => {
  for (const ref of [curated, uploaded]) {
    const f = fixture(ref);
    const mismatches: ContentRef[] = [
      { ...ref, package_id: "different-lesson" },
      { ...ref, content_version: "2" },
      { ...ref, excerpt_sha256: "e".repeat(64) },
      { ...ref, source_id: "22222222-2222-4222-8222-222222222222" },
      ...("source_commit" in ref
        ? [{ ...ref, source_commit: "f".repeat(40) }]
        : [
            { ...ref, source_version: 2 },
            { ...ref, document_sha256: "f".repeat(64) },
            {
              ...ref,
              access_scope: {
                teacher_id: "22222222-2222-4222-8222-222222222222",
              },
            },
            {
              ...ref,
              attribution: { ...ref.attribution, title: "Changed attribution" },
            },
          ]),
    ];
    for (const content_ref of mismatches) {
      assert.deepEqual(
        freshCheckConceptNames(
          {
            ...f.content,
            content_ref,
            concepts: new Map([
              [f.concept.id, { ...f.concept, title: "New label" }],
            ]),
          },
          f.intervention,
        ),
        {},
      );
    }
  }
});

test("missing, blank and out-of-question concepts have no verified label", () => {
  const f = fixture(uploaded);
  f.content.concepts.delete(f.concept.id);
  f.content.concepts.set(f.related.id, { ...f.related, title: "  " });
  f.content.concepts.set("other", {
    ...f.concept,
    id: "other",
    title: "Not assessed",
  });
  assert.deepEqual(freshCheckConceptNames(f.content, f.intervention), {});
});

test("source identity field order does not hide valid saved labels", () => {
  const f = fixture(uploaded);
  const { package_id, ...rest } = uploaded;
  assert.equal(
    freshCheckConceptNames(
      {
        ...f.content,
        content_ref: { ...rest, package_id },
      },
      f.intervention,
    )[f.concept.id],
    "Evaporation",
  );
});
