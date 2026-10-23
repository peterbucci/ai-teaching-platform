import assert from "node:assert/strict";
import test from "node:test";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import {
  validConceptGraph,
  validPacketExperiment,
  validSequenceDiagram,
} from "../lib/visual/examples.ts";

const approved = loadApprovedContent();

test("approved curated content still loads with the visual contracts present", () => {
  assert.ok(approved.concepts.size > 0);
});

for (const [name, example] of [
  ["concept graph", validConceptGraph],
  ["sequence diagram", validSequenceDiagram],
  ["packet experiment", validPacketExperiment],
] as const) {
  test(`${name} example links to the approved source version`, () => {
    assert.deepEqual(
      {
        package_id: example.source.package_id,
        content_version: example.source.content_version,
        source_id: example.source.source_id,
        source_commit: example.source.source_commit,
        excerpt_sha256: example.source.excerpt_sha256,
      },
      approved.content_ref,
    );
  });

  test(`${name} example uses only curated concept IDs`, () => {
    for (const conceptId of example.concept_ids) {
      assert.ok(
        approved.concepts.has(conceptId),
        `Unknown curated concept: ${conceptId}`,
      );
    }
  });
}
