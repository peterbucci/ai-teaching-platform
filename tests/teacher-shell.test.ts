import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveWorkspaceSelection,
  switchedAssignmentHref,
  workspaceDestination,
  workspaceNavigationHref,
} from "../app/teacher/workspace-model.ts";
import { parseTeacherWorkspaceContext } from "../lib/teacher/workspace-contracts.ts";

const firstId = "b2dbbc74-af0c-4e4d-a365-dc2cb73a3a91";
const secondId = "7424c83a-7dc5-4a6e-b4e0-e9ed0bb9c8e4";
const unknownId = "43cddbc7-76c0-46f5-8234-45304c7765d2";
const attemptId = "946850b3-aec5-4de2-93b7-d060352e2e29";
const sessionId = "7d91cdf8-c272-4981-b755-65a9443d0fb1";
const assignments = [
  { id: firstId, title: "Network performance", class_name: "Networks A" },
  { id: secondId, title: "Latency investigation", class_name: "Networks B" },
];

function query(href: string) {
  return new URL(href, "https://example.test").searchParams;
}

test("explicit unknown or malformed assignment IDs cannot silently select another class", () => {
  const unknown = resolveWorkspaceSelection(
    { assignment: unknownId },
    undefined,
    assignments,
  );
  assert.equal(unknown.assignment, undefined);
  assert.equal(unknown.context.assignment, unknownId);
  for (const assignment of ["not-an-id", "", [firstId, secondId]]) {
    assert.throws(() =>
      resolveWorkspaceSelection({ assignment }, undefined, assignments),
    );
  }
  assert.equal(
    resolveWorkspaceSelection({}, undefined, assignments).assignment?.id,
    firstId,
  );
  assert.equal(
    resolveWorkspaceSelection({}, undefined, []).assignment,
    undefined,
  );
});

test("the page's server-resolved assignment wins over a stale URL without inventing authorization", () => {
  const resolved = parseTeacherWorkspaceContext({
    assignment: secondId,
    origin: "live_demo",
  });
  const selected = resolveWorkspaceSelection(
    { assignment: firstId, origin: "synthetic_fixture" },
    resolved,
    assignments,
  );
  assert.equal(selected.assignment?.id, secondId);
  assert.equal(selected.assignment?.class_name, "Networks B");
  assert.equal(selected.context.assignment, secondId);
  assert.equal(selected.context.origin, "live_demo");
  const absent = resolveWorkspaceSelection(
    {},
    parseTeacherWorkspaceContext({ assignment: unknownId }),
    assignments,
  );
  assert.equal(absent.assignment, undefined);
  assert.equal(absent.context.assignment, unknownId);
});

test("switching assignment starts Progress with only the new scope and origin", () => {
  const href = switchedAssignmentHref(secondId, "synthetic_fixture");
  const selected = query(href);
  assert.equal(
    new URL(href, "https://example.test").pathname,
    "/teacher/assignments",
  );
  assert.equal(selected.get("assignment"), secondId);
  assert.equal(selected.get("view"), "progress");
  assert.equal(selected.get("origin"), "synthetic_fixture");
  for (const crossScope of [
    "student",
    "concept",
    "misconception",
    "attempt",
    "evaluation",
    "session",
    "q",
    "seedAttempt",
    "draft",
    "request",
    "workspacePane",
  ])
    assert.equal(
      selected.has(crossScope),
      false,
      `${crossScope} must not leak into another assignment`,
    );
});

test("shared navigation preserves investigation scope while removing mutation and intervention seed state", () => {
  const context = {
    ...parseTeacherWorkspaceContext({
      assignment: firstId,
      origin: "synthetic_fixture",
      concept: "latency",
      attempt: attemptId,
      session: sessionId,
      seedAttempt: [attemptId],
    }),
    draft: "unsaved-draft",
    request: "mutation-request",
    workspacePane: "context",
    response: "private response text",
  };
  const selected = query(workspaceNavigationHref("/teacher/evidence", context));
  assert.equal(selected.get("assignment"), firstId);
  assert.equal(selected.get("origin"), "synthetic_fixture");
  assert.equal(selected.get("concept"), "latency");
  assert.equal(selected.get("attempt"), attemptId);
  assert.equal(selected.get("session"), sessionId);
  for (const key of [
    "seedAttempt",
    "draft",
    "request",
    "workspacePane",
    "response",
  ])
    assert.equal(selected.has(key), false);
  assert.deepEqual(
    context.seedAttempt,
    [attemptId],
    "navigation cannot modify page-owned selections",
  );
});

test("approved course and assignment hierarchy retains all existing teacher destinations", () => {
  const destinations = [
    ["/teacher", undefined, "Overview"],
    ["/teacher/assignments", undefined, "Assignments"],
    ["/teacher/assignments", "progress", "Progress"],
    ["/teacher/assignments", "review", "Progress"],
    ["/teacher/assignments", "preview", "Progress"],
    ["/teacher/assignments/new", "progress", "Assignments"],
    ["/teacher/lessons", undefined, "Lessons"],
    ["/teacher/lessons/lesson-id/questions", undefined, "Lessons"],
    ["/teacher/materials", undefined, "Lessons"],
    ["/teacher/objectives", undefined, "Lessons"],
    ["/teacher/evidence", undefined, "Student work"],
    ["/teacher/insights", undefined, "Student work"],
    ["/teacher/patterns", undefined, "Student work"],
    ["/teacher/sessions/session-id", undefined, "Student work"],
    ["/teacher/interventions", undefined, "Interventions"],
    ["/teacher/students/student-id", undefined, "Roster"],
  ] as const;
  for (const [path, view, expected] of destinations)
    assert.equal(workspaceDestination(path, view), expected, path);
});
