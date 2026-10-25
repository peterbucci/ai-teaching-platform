import assert from "node:assert/strict";
import test from "node:test";
import {
  materialRecoveryKey,
  parseMaterialRecovery,
  type MaterialImportDraft,
} from "./import-draft.ts";

const draft: MaterialImportDraft = {
  mode: "paste",
  text: "Original fictional reading.",
  filename: null,
  preview: {
    inputKind: "paste",
    originalFilename: null,
    mediaType: "text/plain",
    contentHash: "a".repeat(64),
    characterCount: 26,
    passages: [
      { passage_id: "p001", text: "Original fictional reading." },
      { passage_id: "p002", text: "Appendix." },
    ],
    warnings: [],
  },
  receipt: "signed-preview-request-identity",
  passages: [
    {
      passage_id: "p001",
      text: "Corrected fictional reading.",
      included: true,
    },
    { passage_id: "p002", text: "Appendix.", included: false },
  ],
  title: "Fictional source",
  authors: "Demo teacher",
  copyright: "Original example",
  license: "Teacher-created",
  sourceUrl: "",
};

test("material recovery retains original extraction, corrected and excluded passages, and retry identity", () => {
  assert.deepEqual(parseMaterialRecovery(JSON.stringify(draft)), draft);
  const recovered = parseMaterialRecovery(JSON.stringify(draft));
  assert.notEqual(
    recovered?.passages[0].text,
    recovered?.preview?.passages[0].text,
  );
  assert.equal(recovered?.passages[1].included, false);
  assert.equal(recovered?.receipt, draft.receipt);
});

test("material recovery is separated by teacher, source document, and expected version", () => {
  const key = materialRecoveryKey("teacher-a", "document-a", 2);
  assert.notEqual(key, materialRecoveryKey("teacher-b", "document-a", 2));
  assert.notEqual(key, materialRecoveryKey("teacher-a", "document-b", 2));
  assert.notEqual(key, materialRecoveryKey("teacher-a", "document-a", 3));
  assert.notEqual(key, materialRecoveryKey("teacher-a"));
});

test("recovery rejects shuffled or missing passage identities and a lost preview receipt", () => {
  for (const invalid of [
    { ...draft, passages: [...draft.passages].reverse() },
    { ...draft, passages: draft.passages.slice(0, 1) },
    { ...draft, receipt: "" },
    { ...draft, preview: null },
  ])
    assert.equal(parseMaterialRecovery(JSON.stringify(invalid)), null);
});

test("partial material recovery permits unfinished attribution and fails safely for damaged storage", () => {
  const unfinished = {
    ...draft,
    title: "",
    authors: "",
    preview: null,
    receipt: "",
    passages: [],
  };
  assert.deepEqual(
    parseMaterialRecovery(JSON.stringify(unfinished)),
    unfinished,
  );
  for (const invalid of [
    null,
    "",
    "{not json",
    JSON.stringify({ title: "Incomplete object" }),
    "x".repeat(2_000_001),
  ]) {
    assert.equal(parseMaterialRecovery(invalid), null);
  }
});
