import assert from "node:assert/strict";
import test from "node:test";
import type { ContentRef } from "../lib/evidence/contracts.ts";
import { followupConceptLabel } from "../app/teacher/interventions/concept-label.ts";

const curated: ContentRef = {
  package_id: "network-performance-v1",
  content_version: "1",
  source_id: "network-performance",
  source_commit: "a".repeat(40),
  excerpt_sha256: "b".repeat(64),
};
const uploaded: ContentRef = {
  source_kind: "uploaded",
  package_id: "lesson:water-cycle",
  content_version: "1",
  source_id: "48bae4f7-63a2-4876-bc6d-b5b2d99a6b9f",
  source_version: 1,
  document_sha256: "c".repeat(64),
  excerpt_sha256: "d".repeat(64),
  attribution: {
    title: "Water cycle fixture",
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
    id: "94d2ba56-7792-499e-a7d1-57849660864d",
    title: "Evaporation",
    objectives: ["Explain evaporation."],
    boundaries: [],
    source_passage_ids: ["p001"],
  };
  const related = {
    ...concept,
    id: "5296f5a5-a1b9-4aa3-a647-4518ad78dbfa",
    title: "Condensation",
  };
  return {
    comparison: {
      content_ref,
      original_evidence: {
        content_ref,
        concept,
        related_concepts: [related],
      },
    },
    question: { content_ref, concept_ids: [concept.id, related.id] },
    concept,
    related,
  };
}

test("follow-up labels use primary and related names from the saved source for both content kinds", () => {
  for (const content of [curated, uploaded]) {
    const { comparison, question, concept, related } = fixture(content);
    const before = JSON.stringify({ comparison, question });
    assert.equal(
      followupConceptLabel(comparison, question, concept.id),
      "Evaporation",
    );
    assert.equal(
      followupConceptLabel(comparison, question, related.id),
      "Condensation",
    );
    assert.equal(JSON.stringify({ comparison, question }), before);
    // Key order is not a source/version difference.
    const { package_id, ...otherFields } = content;
    assert.equal(
      followupConceptLabel(
        comparison,
        {
          ...question,
          content_ref: { ...otherFields, package_id },
        },
        concept.id,
      ),
      "Evaporation",
    );
  }
});

test("a reused concept ID cannot borrow its name from another lesson or source version", () => {
  for (const content of [curated, uploaded]) {
    const { comparison, question, concept } = fixture(content);
    const mismatches: ContentRef[] = [
      { ...content, package_id: "another-lesson" },
      { ...content, content_version: "2" },
      { ...content, excerpt_sha256: "e".repeat(64) },
      "source_commit" in content
        ? { ...content, source_commit: "f".repeat(40) }
        : { ...content, source_version: 2 },
    ];
    for (const content_ref of mismatches) {
      assert.equal(
        followupConceptLabel(
          comparison,
          { ...question, content_ref },
          concept.id,
        ),
        "Concept name unavailable",
      );
      assert.equal(
        followupConceptLabel(
          { ...comparison, content_ref },
          question,
          concept.id,
        ),
        "Concept name unavailable",
      );
    }
  }
});

test("uploaded labels retain the exact saved document and teacher scope", () => {
  const { comparison, question, concept } = fixture(uploaded);
  for (const content_ref of [
    { ...uploaded, document_sha256: "f".repeat(64) },
    {
      ...uploaded,
      access_scope: { teacher_id: "22222222-2222-4222-8222-222222222222" },
    },
  ]) {
    assert.equal(
      followupConceptLabel(
        comparison,
        { ...question, content_ref },
        concept.id,
      ),
      "Concept name unavailable",
    );
  }
});

test("missing question, unsaved concept names and out-of-question results use an honest fallback", () => {
  const { comparison, question, concept, related } = fixture(uploaded);
  assert.equal(
    followupConceptLabel(comparison, null, concept.id),
    "Concept name unavailable",
  );
  assert.equal(
    followupConceptLabel(
      comparison,
      { ...question, concept_ids: ["not-in-saved-scope"] },
      "not-in-saved-scope",
    ),
    "Concept name unavailable",
  );
  assert.equal(
    followupConceptLabel(
      comparison,
      { ...question, concept_ids: [concept.id] },
      related.id,
    ),
    "Concept name unavailable",
  );
  comparison.original_evidence.related_concepts = [];
  assert.equal(
    followupConceptLabel(comparison, question, related.id),
    "Concept name unavailable",
  );
});
