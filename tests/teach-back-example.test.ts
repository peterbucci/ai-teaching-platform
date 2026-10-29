import assert from "node:assert/strict";
import test from "node:test";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { makeTeachBackExample } from "../lib/dialogue/teach-back-example.ts";

test("fictional learner fixture probes an omission and keeps private source criteria separate", () => {
  const content = loadApprovedContent();
  const example = makeTeachBackExample(content);

  assert.equal(example.kind, "synthetic_fixture");
  assert.deepEqual(example.content_ref, content.content_ref);
  assert.match(example.studentVisible.modeLabel, /fictional AI learner/);
  assert.match(example.studentVisible.disclosure, /AI playing a fictional learner/);
  assert.match(example.studentVisible.fictionalLearnerFollowUp, /what determines/);
  assert.doesNotMatch(
    example.studentVisible.fictionalLearnerFollowUp,
    /packet size and bandwidth determine/i,
  );
  assert.deepEqual(example.evaluatorPrivate.sourcePassageIds, ["P07", "P08"]);
  assert.deepEqual(example.flawedExplanationExercise.sourcePassageIds, [
    "P07",
    "P08",
  ]);
  assert.match(example.flawedExplanationExercise.label, /intentionally flawed/);
  assert.match(example.flawedExplanationExercise.correctionDebrief, /Correction:/);
  for (const id of example.evaluatorPrivate.sourcePassageIds)
    assert.equal(content.passages.has(id), true);
});