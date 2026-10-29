import assert from "node:assert/strict";
import test from "node:test";
import {
  availableTeacherWorkspacePanes,
  resolveTeacherWorkspacePane,
  teacherWorkspacePaneHref,
  teacherWorkspacePaneKeyboardTarget,
} from "../app/teacher/workspace-panes-model.ts";

const threePanes = availableTeacherWorkspacePanes(true, true);

test("pane selection only accepts one available fixed presentation token", () => {
  assert.deepEqual(threePanes, ["navigation", "main", "context"]);
  assert.equal(
    resolveTeacherWorkspacePane(
      new URLSearchParams("workspacePane=context"),
      threePanes,
    ),
    "context",
  );
  for (const query of [
    "workspacePane=student-response",
    "workspacePane=https://outside.example/",
    "workspacePane=context&workspacePane=main",
    "workspacePane=",
  ]) {
    assert.equal(
      resolveTeacherWorkspacePane(new URLSearchParams(query), threePanes),
      "main",
    );
  }
  assert.equal(
    resolveTeacherWorkspacePane(
      new URLSearchParams("workspacePane=context"),
      availableTeacherWorkspacePanes(true, false),
    ),
    "main",
  );
  assert.equal(
    resolveTeacherWorkspacePane(new URLSearchParams(), ["main"], "navigation"),
    "main",
  );
});

test("pane links retain current assignment, repeated evidence identities and hash without mutating their source", () => {
  const current = new URL(
    "https://example.test/teacher/evidence?assignment=assignment-id&seedAttempt=a&seedAttempt=b&workspacePane=main&workspacePane=context#responses",
  );
  const next = new URL(
    teacherWorkspacePaneHref(current, "navigation"),
    current.origin,
  );
  assert.equal(next.pathname, current.pathname);
  assert.equal(next.searchParams.get("assignment"), "assignment-id");
  assert.deepEqual(next.searchParams.getAll("seedAttempt"), ["a", "b"]);
  assert.deepEqual(next.searchParams.getAll("workspacePane"), ["navigation"]);
  assert.equal(next.hash, "#responses");
  assert.deepEqual(current.searchParams.getAll("workspacePane"), [
    "main",
    "context",
  ]);
});

test("pane URL round trips support refresh and browser history without storing page data", () => {
  const original = new URL(
    "https://example.test/teacher/lessons?assignment=assignment-id",
  );
  const opened = new URL(
    teacherWorkspacePaneHref(original, "context"),
    original.origin,
  );
  const returned = new URL(
    teacherWorkspacePaneHref(opened, "main"),
    original.origin,
  );
  assert.equal(
    resolveTeacherWorkspacePane(opened.searchParams, threePanes),
    "context",
  );
  assert.equal(
    resolveTeacherWorkspacePane(returned.searchParams, threePanes),
    "main",
  );
  assert.deepEqual(
    [...opened.searchParams.keys()],
    ["assignment", "workspacePane"],
  );
  assert.equal(
    resolveTeacherWorkspacePane(original.searchParams, threePanes),
    "main",
  );
});

test("pane keyboard focus wraps only through supplied panes and supports Home and End", () => {
  const twoPanes = availableTeacherWorkspacePanes(false, true);
  assert.deepEqual(twoPanes, ["main", "context"]);
  assert.equal(
    teacherWorkspacePaneKeyboardTarget(twoPanes, "main", "ArrowLeft"),
    "context",
  );
  assert.equal(
    teacherWorkspacePaneKeyboardTarget(twoPanes, "context", "ArrowRight"),
    "main",
  );
  assert.equal(
    teacherWorkspacePaneKeyboardTarget(threePanes, "main", "Home"),
    "navigation",
  );
  assert.equal(
    teacherWorkspacePaneKeyboardTarget(threePanes, "main", "End"),
    "context",
  );
  assert.equal(
    teacherWorkspacePaneKeyboardTarget(twoPanes, "navigation", "ArrowRight"),
    undefined,
  );
  assert.equal(
    teacherWorkspacePaneKeyboardTarget(twoPanes, "main", "Enter"),
    undefined,
  );
});
