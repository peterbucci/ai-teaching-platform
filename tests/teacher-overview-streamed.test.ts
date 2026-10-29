import assert from "node:assert/strict";
import test from "node:test";
import { assertUploadedOverview } from "../scripts/assert-uploaded-overview.ts";

test("Overview service regression rejects a shell or fallback even when RSC scripts mention resolved content", () => {
  const fixture = {
    assignmentId: "assignment",
    assignmentTitle: "No categories",
    otherAssignmentId: "other-assignment",
    otherAssignmentTitle: "Reserved category",
    concepts: [],
    evidence: [],
  };
  for (const html of [
    "<nav>Overview</nav><h1>Overview</h1><p>Loading authorized assignments and saved teaching work…</p>",
    '<h1>Overview</h1><script><h1 id="overview-title">Overview</h1></script>',
    '<h1 id="overview-title">Overview</h1><p>Overview unavailable</p>',
  ]) {
    assert.throws(() => assertUploadedOverview(html, fixture));
  }
});
