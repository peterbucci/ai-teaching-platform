import assert from "node:assert/strict";
import test from "node:test";
import { sourceReviewPassages } from "./source-review-model.ts";

test("source inspector pairs reviewed text by stable identity while retaining original order and excluded passages", () => {
  const extraction = [
    { passage_id: "p001", text: "First original.", page_number: 1 },
    { passage_id: "p002", text: "Excluded appendix.", page_number: 2 },
    { passage_id: "p003", text: "Third original.", page_number: 3 },
  ];
  const reviewed = [
    { passage_id: "p003", text: "Third original.", page_number: 3 },
    { passage_id: "p001", text: "First corrected.", page_number: 1 },
  ];
  const result = sourceReviewPassages({ extraction, passages: reviewed });
  assert.deepEqual(
    result.map(({ id, number, status }) => ({ id, number, status })),
    [
      { id: "p001", number: 1, status: "corrected" },
      { id: "p002", number: 2, status: "excluded" },
      { id: "p003", number: 3, status: "unchanged" },
    ],
  );
  assert.equal(result[0].original.text, "First original.");
  assert.equal(result[0].reviewed?.text, "First corrected.");
  assert.equal(result[1].reviewed, undefined);
  assert.equal(result[2].original.page_number, 3);
  assert.deepEqual(
    extraction.map((passage) => passage.text),
    ["First original.", "Excluded appendix.", "Third original."],
  );
});

test("source inspector cannot substitute a different passage with the same displayed position", () => {
  const result = sourceReviewPassages({
    extraction: [{ passage_id: "p001", text: "Original source." }],
    passages: [{ passage_id: "p999", text: "Foreign passage." }],
  });
  assert.equal(result[0].status, "excluded");
  assert.equal(result[0].reviewed, undefined);
  assert.equal(result[0].original.text, "Original source.");
});
