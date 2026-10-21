import assert from "node:assert/strict";
import test from "node:test";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { assignedReading } from "../lib/assignments/reading.ts";
import { deriveAssistance } from "../lib/evidence/rules.ts";
import { getCuratedQuestion } from "../lib/evidence/content.ts";
import { InterventionSchema } from "../lib/evidence/contracts.ts";
import { randomUUID } from "node:crypto";

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
