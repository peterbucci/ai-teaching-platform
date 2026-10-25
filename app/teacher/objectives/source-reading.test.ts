import assert from "node:assert/strict";
import test from "node:test";
import { evidenceSegments } from "./source-reading.ts";

test("exact quotes highlight every occurrence without changing source text", () => {
  const source = "Water becomes vapor. Water remains matter.";
  const segments = evidenceSegments(source, ["Water"]);
  assert.equal(segments.map((segment) => segment.text).join(""), source);
  assert.deepEqual(
    segments
      .filter((segment) => segment.highlighted)
      .map((segment) => segment.text),
    ["Water", "Water"],
  );
});

test("overlapping evidence quotes combine without duplicating or losing source words", () => {
  const source = "Liquid water changes to vapor.";
  const segments = evidenceSegments(source, ["Liquid water", "water changes"]);
  assert.equal(segments.map((segment) => segment.text).join(""), source);
  assert.deepEqual(
    segments
      .filter((segment) => segment.highlighted)
      .map((segment) => segment.text),
    ["Liquid water changes"],
  );
});

test("unsupported wording and empty quotes cannot create false evidence highlights", () => {
  assert.deepEqual(
    evidenceSegments("Water is matter.", ["water", "", "Water is energy."]),
    [{ text: "Water is matter.", highlighted: false }],
  );
  assert.deepEqual(
    evidenceSegments("<script>Untrusted source text</script>", ["<script>"]),
    [
      { text: "<script>", highlighted: true },
      { text: "Untrusted source text</script>", highlighted: false },
    ],
  );
});
