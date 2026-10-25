import test from "node:test";
import assert from "node:assert/strict";
import {
  AssignmentWorkspaceSchema,
  assignmentHref,
  filterAssignments,
} from "../app/teacher/assignments/workspace-model.ts";

const first = "20000000-0000-4000-8000-000000000001";
const second = "20000000-0000-4000-8000-000000000002";
test("class and availability filtering uses identities, including unavailable assignments", () => {
  const rows = [
    { class_id: first, status: "active" as const },
    { class_id: second, status: "inactive" as const },
    { class_id: first, status: "unavailable" as const },
  ];
  assert.equal(
    filterAssignments(rows, { class: first, status: "all" }).length,
    2,
  );
  assert.deepEqual(
    filterAssignments(rows, { class: first, status: "unavailable" }),
    [rows[2]],
  );
  assert.deepEqual(
    filterAssignments(rows, { class: second, status: "active" }),
    [],
  );
  assert.equal(AssignmentWorkspaceSchema.parse({ class: "" }).class, undefined);
  assert.throws(() =>
    AssignmentWorkspaceSchema.parse({ class: "other-class" }),
  );
});
test("assignment navigation resets incompatible record selection but retains view filters", () => {
  const context = AssignmentWorkspaceSchema.parse({
    assignment: first,
    student: first,
    concept: "latency",
    origin: "synthetic_fixture",
    view: "progress",
  });
  const changed = new URL(
    assignmentHref(context, { assignment: second }),
    "https://example.test",
  );
  assert.equal(changed.searchParams.get("assignment"), second);
  assert.equal(changed.searchParams.get("student"), null);
  assert.equal(changed.searchParams.get("concept"), null);
  assert.equal(changed.searchParams.get("origin"), "synthetic_fixture");
  const same = new URL(
    assignmentHref(context, { view: "preview" }),
    "https://example.test",
  );
  assert.equal(same.searchParams.get("student"), first);
  assert.equal(same.searchParams.get("concept"), "latency");
  assert.throws(() =>
    AssignmentWorkspaceSchema.parse({ assignment: [first, second] }),
  );
});
