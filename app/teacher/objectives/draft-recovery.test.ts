import assert from "node:assert/strict";
import test from "node:test";
import {
  parseObjectiveRecovery,
  requestedApprovedSource,
} from "./draft-recovery.ts";

const source = {
  document_id: "a71c8ef1-914f-48e7-81d6-768d39b87e34",
  version: 2,
  file_name: "fictional-lesson.txt",
  review_status: "approved" as const,
  attribution: {
    title: "Fictional water cycle lesson",
    authors: ["Demo teacher"],
  },
  passages: [],
};
const recovery = {
  lessonId: "demo-lesson",
  sourceId: source.document_id,
  sourceVersion: 2,
  revision: 4,
  title: "  Lesson in progress  ",
  items: [
    {
      concept_id: "48358f25-c69c-41b5-b221-fe24881e24ce",
      concept_name: "",
      objective: "A student will explain  ",
      passage_ids: ["p-1"],
      emphasis: null,
      support_evidence: [{ passage_id: "p-1", quote: "  Water evaporates.  " }],
      support_note: "  Evidence notes in progress  ",
      teacher_verified: false,
    },
  ],
};

test("unfinished objective recovery preserves wording, stable IDs and original revision", () => {
  assert.deepEqual(
    parseObjectiveRecovery(JSON.stringify(recovery), "demo-lesson", source),
    recovery,
  );
  assert.equal(
    parseObjectiveRecovery(JSON.stringify(recovery), "demo-lesson", source)
      ?.revision,
    4,
    "recovery must retain the old revision so it cannot silently overwrite a newer server draft",
  );
});

test("recovery refuses a different lesson or exact source version", () => {
  const raw = JSON.stringify(recovery);
  assert.equal(parseObjectiveRecovery(raw, "another-lesson", source), null);
  assert.equal(
    parseObjectiveRecovery(raw, "demo-lesson", { ...source, version: 3 }),
    null,
  );
  assert.equal(
    parseObjectiveRecovery(raw, "demo-lesson", {
      ...source,
      document_id: "another-source",
    }),
    null,
  );
});

test("corrupt, oversized and server-owned recovery fields are rejected", () => {
  assert.equal(parseObjectiveRecovery("{partial", "demo-lesson", source), null);
  assert.equal(
    parseObjectiveRecovery(" ".repeat(4_000_001), "demo-lesson", source),
    null,
  );
  assert.equal(
    parseObjectiveRecovery(
      JSON.stringify({ ...recovery, approved_revision: 4 }),
      "demo-lesson",
      source,
    ),
    null,
  );
  assert.equal(
    parseObjectiveRecovery(
      JSON.stringify({
        ...recovery,
        items: [{ ...recovery.items[0], review: { reviewed_by: "other" } }],
      }),
      "demo-lesson",
      source,
    ),
    null,
  );
});

test("source handoff selects only an available approved exact version", () => {
  const sources = [
    source,
    { ...source, version: 3, review_status: "extracted" as const },
  ];
  assert.equal(
    requestedApprovedSource(sources, source.document_id, "2"),
    source,
  );
  assert.equal(
    requestedApprovedSource(sources, source.document_id, "3"),
    undefined,
  );
  assert.equal(
    requestedApprovedSource(sources, "unavailable-source", "2"),
    undefined,
  );
  for (const version of [
    "2.0",
    "2e0",
    "02",
    "-2",
    "0",
    "",
    "9007199254740993",
  ]) {
    assert.equal(
      requestedApprovedSource(sources, source.document_id, version),
      undefined,
    );
  }
});
