import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { workspaceAssignmentMetadata } from "../app/teacher/workspace-metadata.ts";
import { EvidenceError } from "../lib/evidence/store.ts";
import { loadApprovedContent } from "../lib/evidence/content.ts";

const owned = {
  id: "30000000-0000-4000-8000-000000000001",
  title: "Networking practice",
  class_name: "Networking A",
};
const review = {
  content_ref: loadApprovedContent().content_ref,
  teacher_approved_at: "2026-10-25T10:00:00Z",
};

test("one invalid pinned assignment stays unavailable without breaking the owned workspace list", async () => {
  const broken = { ...owned, id: "30000000-0000-4000-8000-000000000002" };
  const invalid = z
    .object({ approval: z.object({ status: z.literal("approved") }) })
    .safeParse({ approval: { status: "unavailable_fixture" } });
  assert.equal(invalid.success, false);
  const [available, unavailable] = await Promise.all([
    workspaceAssignmentMetadata(owned, async () => review),
    workspaceAssignmentMetadata(broken, async () => {
      throw invalid.error;
    }),
  ]);
  assert.deepEqual(available, {
    ...owned,
    version: review.content_ref.content_version,
    availability: "active",
  });
  assert.deepEqual(unavailable, { ...broken, availability: "unavailable" });
  assert.equal(unavailable.version, undefined);
  assert.deepEqual(
    await workspaceAssignmentMetadata(owned, async () => ({
      ...review,
      teacher_approved_at: null,
    })),
    {
      ...owned,
      version: review.content_ref.content_version,
      availability: "inactive",
    },
  );
});

test("metadata fallback retains existing unavailable cases and propagates unexpected service failures", async () => {
  for (const status of [403, 404, 409] as const) {
    const item = await workspaceAssignmentMetadata(owned, async () => {
      throw new EvidenceError(status, "Unavailable pinned assignment");
    });
    assert.deepEqual(item, { ...owned, availability: "unavailable" });
  }
  for (const error of [
    new EvidenceError(503, "Service unavailable"),
    new Error("Unexpected review failure"),
  ])
    await assert.rejects(
      workspaceAssignmentMetadata(owned, async () => {
        throw error;
      }),
      (caught) => caught === error,
    );
});
