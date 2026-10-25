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
    true,
  );
  assert.equal(selected.assignment?.id, secondId);
  assert.equal(selected.assignment?.class_name, "Networks B");
  assert.equal(selected.context.assignment, secondId);
  assert.equal(selected.context.origin, "live_demo");
  const absent = resolveWorkspaceSelection(
    {},
    parseTeacherWorkspaceContext({ assignment: unknownId }),
    assignments,
    true,
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

test("authoritative snapshot omissions clear stale URL response identities and search", () => {
  // Saved intervention snapshots intentionally omit identities that were not
  // matched to their persisted evidence; omissions are not URL fallback slots.
  const saved = {
    assignment: secondId,
    origin: "synthetic_fixture" as const,
    concept: "latency",
    seedAttempt: [attemptId],
    returnTo: "evidence" as const,
  };
  const selected = resolveWorkspaceSelection(
    {
      assignment: firstId,
      origin: "live_demo",
      concept: "unrelated-concept",
      misconception: "unrelated-pattern",
      student: "unrelated-student",
      session: sessionId,
      attempt: unknownId,
      evaluation: firstId,
      q: "unrelated search",
      seedAttempt: [unknownId],
    },
    saved,
    assignments,
    true,
  );
  assert.equal(selected.assignment?.id, secondId);
  assert.equal(selected.context.concept, "latency");
  assert.equal(selected.context.origin, "synthetic_fixture");
  assert.deepEqual(selected.context.seedAttempt, [attemptId]);
  const navigation = query(
    workspaceNavigationHref("/teacher/evidence", selected.context),
  );
  for (const field of [
    "misconception",
    "student",
    "session",
    "attempt",
    "evaluation",
    "q",
  ] as const) {
    assert.equal(selected.context[field], undefined, field);
    assert.equal(navigation.has(field), false, field);
  }
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

test("ordinary selection follows URL updates but acknowledged drafts clear omitted preparation identities", () => {
  const preparation = parseTeacherWorkspaceContext({
    assignment: firstId,
    origin: "synthetic_fixture",
    student: "fictional-student",
    attempt: attemptId,
    seedAttempt: [attemptId],
  });
  const changed = resolveWorkspaceSelection(
    { assignment: secondId, origin: "live_demo" },
    preparation,
    assignments,
  );
  assert.equal(changed.assignment?.id, secondId);
  assert.equal(changed.context.origin, "live_demo");
  assert.deepEqual(changed.context.seedAttempt, []);
  const acknowledged = resolveWorkspaceSelection(
    { assignment: secondId, origin: "live_demo", draft: unknownId },
    preparation,
    assignments,
  );
  assert.equal(acknowledged.assignment?.id, secondId);
  assert.equal(acknowledged.context.student, undefined);
  assert.equal(acknowledged.context.attempt, undefined);
  assert.deepEqual(acknowledged.context.seedAttempt, []);
  assert.equal(
    query(
      workspaceNavigationHref("/teacher/evidence", acknowledged.context),
    ).has("draft"),
    false,
  );
});

test("course destinations accept only their supported scope while explicit Progress retains investigation filters", () => {
  const context = parseTeacherWorkspaceContext({
    assignment: firstId,
    origin: "synthetic_fixture",
    student: "fictional-student",
    concept: "latency",
    q: "answer text must not become a roster name search",
    attempt: attemptId,
  });
  for (const path of [
    "/teacher/lessons",
    "/teacher/materials",
    "/teacher/objectives",
  ])
    assert.equal(workspaceNavigationHref(path, context), path);
  assert.deepEqual(
    [...query(workspaceNavigationHref("/teacher/assignments", context))],
    [["assignment", firstId]],
  );
  assert.deepEqual(
    [...query(workspaceNavigationHref("/teacher", context))],
    [
      ["assignment", firstId],
      ["origin", "synthetic_fixture"],
    ],
  );
  assert.deepEqual(
    [...query(workspaceNavigationHref("/teacher/students", context))],
    [
      ["assignment", firstId],
      ["origin", "synthetic_fixture"],
      ["student", "fictional-student"],
    ],
  );
  const progress = query(
    workspaceNavigationHref("/teacher/assignments", context, "progress"),
  );
  assert.equal(progress.get("view"), "progress");
  assert.equal(progress.get("assignment"), firstId);
  assert.equal(progress.get("origin"), "synthetic_fixture");
  assert.equal(progress.get("student"), "fictional-student");
  assert.equal(progress.get("concept"), "latency");
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
