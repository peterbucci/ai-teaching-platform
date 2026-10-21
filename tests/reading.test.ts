import assert from "node:assert/strict";
import test from "node:test";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { assignedReading } from "../lib/assignments/reading.ts";

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
