import assert from "node:assert/strict";
import test from "node:test";
import {
  assignmentDraftKey,
  assignmentRequest,
  assertUnchangedDraft,
  confirmedAssignment,
  definitelyRejectedAssignment,
  readAssignmentDraft,
  type AssignmentDraft,
} from "../app/teacher/assignments/create-model.ts";

const classId = "20000000-0000-4000-8000-000000000001";
const requestId = "40000000-0000-4000-8000-000000000001";
const otherRequest = "40000000-0000-4000-8000-000000000002";
const assignmentId = "30000000-0000-4000-8000-000000000001";
const draft = (): AssignmentDraft => ({
  schema_version: 1,
  fields: {
    class_id: classId,
    title: "  Reading practice  ",
    instructions: "Explain your reasoning.\nKeep the original wording. ",
  },
  pending: null,
  created_id: null,
});

test("draft recovery separates accounts and exact lesson versions without delimiter collisions", () => {
  const keys = [
    assignmentDraftKey("teacher-a", "lesson", "1"),
    assignmentDraftKey("teacher-b", "lesson", "1"),
    assignmentDraftKey("teacher-a", "lesson", "2"),
    assignmentDraftKey("teacher-a", "lesson:1", "2"),
    assignmentDraftKey("teacher-a", "lesson", "1:2"),
  ];
  assert.equal(new Set(keys).size, keys.length);
});

test("unsent fields survive reload exactly, including an incomplete title and multiline instructions", () => {
  const unsent = draft();
  unsent.fields.title = "";
  assert.deepEqual(readAssignmentDraft(JSON.stringify(unsent)), unsent);
  assert.equal(readAssignmentDraft(null), null);
  assert.throws(() => readAssignmentDraft("{"), /could not be read/);
  assert.throws(
    () => readAssignmentDraft(JSON.stringify({ fields: unsent.fields })),
    /could not be read/,
  );
});

test("an uncertain retry retains its request identity and frozen fields after reload", () => {
  const unsent = draft();
  const pending = assignmentRequest(unsent, requestId);
  assert.equal(pending.title, "Reading practice");
  assert.equal(unsent.fields.title, "  Reading practice  ");
  const waiting: AssignmentDraft = {
    ...unsent,
    fields: {
      class_id: pending.class_id,
      title: pending.title,
      instructions: pending.instructions,
    },
    pending,
  };
  const restored = readAssignmentDraft(JSON.stringify(waiting));
  assert.ok(restored);
  assert.deepEqual(assignmentRequest(restored, otherRequest), pending);
  assert.throws(
    () =>
      readAssignmentDraft(
        JSON.stringify({
          ...waiting,
          fields: { ...waiting.fields, title: "Changed while pending" },
        }),
      ),
    /could not be read/,
  );
});

test("cross-tab checks reject stale edits even when another tab cleared or confirmed a request", () => {
  assert.doesNotThrow(() => assertUnchangedDraft(null, null));
  assert.doesNotThrow(() => assertUnchangedDraft("same", "same"));
  for (const [current, expected] of [
    ["newer", "older"],
    [null, "older"],
    ["created", null],
  ] as const)
    assert.throws(() => assertUnchangedDraft(current, expected), /Another tab/);
});

test("a successful response must confirm the expected class and exact published version", () => {
  const pending = assignmentRequest(draft(), requestId);
  const result = {
    id: assignmentId,
    class_id: classId,
    lesson_id: "water",
    lesson_version: "2",
  };
  assert.equal(
    confirmedAssignment(result, pending, "water", "2"),
    assignmentId,
  );
  for (const change of [
    { id: "not-an-id" },
    { class_id: "20000000-0000-4000-8000-000000000002" },
    { lesson_id: "another-lesson" },
    { lesson_version: "3" },
  ])
    assert.throws(() =>
      confirmedAssignment({ ...result, ...change }, pending, "water", "2"),
    );
  assert.throws(() =>
    confirmedAssignment({ id: assignmentId }, pending, "water", "2"),
  );
});

test("confirmed creation survives reload and blocks another request until an explicit reset", () => {
  const saved = { ...draft(), created_id: assignmentId };
  const restored = readAssignmentDraft(JSON.stringify(saved));
  assert.ok(restored);
  assert.equal(restored.created_id, assignmentId);
  assert.throws(
    () => assignmentRequest(restored, otherRequest),
    /already saved/,
  );
});

test("conflicts and uncertain failures cannot be treated as proof that creation failed", () => {
  for (const status of [400, 401, 403, 404])
    assert.equal(definitelyRejectedAssignment(status), true);
  for (const status of [200, 409, 429, 500, 503])
    assert.equal(definitelyRejectedAssignment(status), false);
});
