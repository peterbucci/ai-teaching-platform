import assert from "node:assert/strict";
import test from "node:test";
import { readingFixture } from "../app/study/notebook/reading/verification/data.ts";
import {
  notebookReadingContext,
  notebookHref,
} from "../app/study/notebook/index.ts";
import {
  matchesReadingContext,
  notebookPassageHref,
  readingPresentation,
} from "../app/study/notebook/reading/presentation.ts";
import { makeTeacherSourceReference } from "./fixtures/teacher-lesson.ts";

const sessionId = "20000000-0000-4000-8000-000000000001";
const attemptId = "30000000-0000-4000-8000-000000000001";
const citationId = "50000000-0000-4000-8000-000000000001";
function input() {
  const view = readingFixture();
  view.session = {
    id: sessionId,
    currentAttemptId: attemptId,
    pendingPassageId: "P08",
  };
  return { view, context: notebookReadingContext(view, true) };
}

test("N4 exact approved reading and session return remain unchanged", () => {
  const { view, context } = input();
  const before = structuredClone(view);
  const result = readingPresentation({
    state: { status: "ready", data: view },
    context: { status: "ready", data: context },
  });
  assert.equal(result.status, "resolved");
  assert.equal(matchesReadingContext(view, context), true);
  assert.equal(
    notebookHref(context.returnTo),
    `/study/assignments/${view.assignment.id}?tab=study&session=${sessionId}#question-${attemptId}`,
  );
  assert.deepEqual(view, before);
});

test("N4 mismatched assignment, version, source hash, session, question or passage fails closed", () => {
  const { view, context } = input();
  const changes = [
    { ...context, assignment: { ...context.assignment, id: citationId } },
    {
      ...context,
      contentRef: { ...context.contentRef, content_version: "newer" },
    },
    {
      ...context,
      contentRef: { ...context.contentRef, excerpt_sha256: "f".repeat(64) },
    },
    { ...context, session: { ...view.session!, id: citationId } },
    { ...context, session: { ...view.session!, currentAttemptId: citationId } },
    { ...context, passageId: "not-approved" },
    {
      ...context,
      returnTo: {
        kind: "assignment",
        assignmentId: view.assignment.id,
        tab: "study",
        sessionId,
        anchor: `question-${citationId}`,
      } as const,
    },
  ];
  for (const changed of changes) {
    assert.equal(matchesReadingContext(view, changed), false);
    assert.equal(
      readingPresentation({
        state: { status: "ready", data: view },
        context: { status: "ready", data: changed },
      }).status,
      "unavailable",
    );
    assert.equal(notebookPassageHref(view, changed, "P07"), null);
  }
});

test("N4 citation retains exact version, passage, assignment, session and server citation", () => {
  const { view, context } = input();
  const href = notebookPassageHref(view, context, "P08", citationId);
  assert.ok(href);
  const query = new URL(href, "https://example.com").searchParams;
  assert.equal(query.get("version"), view.reading.content_ref.content_version);
  assert.equal(query.get("passage"), "P08");
  assert.equal(query.get("assignment"), view.assignment.id);
  assert.equal(query.get("session"), sessionId);
  assert.equal(query.get("citation"), citationId);
  assert.equal(query.get("from"), "study");
  assert.equal(notebookPassageHref(view, context, "foreign"), null);
  assert.equal(notebookPassageHref(view, context, "P07", "invalid"), null);
});

test("N4 independent reading has no invented study return or citation session", () => {
  const view = readingFixture();
  const context = notebookReadingContext(view, false);
  assert.equal(
    notebookHref(context.returnTo),
    `/study/assignments/${view.assignment.id}?tab=overview`,
  );
  assert.equal(notebookPassageHref(view, context, "P07", citationId), null);
  const href = notebookPassageHref(view, context, "P07");
  assert.ok(href);
  assert.equal(
    new URL(href, "https://example.com").searchParams.has("from"),
    false,
  );
});

test("N4 absent current attempt preserves session without inventing a historical anchor", () => {
  const { view } = input();
  view.session!.currentAttemptId = null;
  const context = notebookReadingContext(view, true);
  assert.equal(matchesReadingContext(view, context), true);
  assert.equal(
    notebookHref(context.returnTo),
    `/study/assignments/${view.assignment.id}?tab=study&session=${sessionId}`,
  );
});

test("N4 historical uploaded source identity is never replaced by another version", () => {
  const { view } = input();
  view.reading.content_ref = {
    ...makeTeacherSourceReference(view.assignment.id, citationId),
    package_id: "teacher-lesson",
    content_version: "historical-v1",
  };
  const context = notebookReadingContext(view, true);
  assert.equal(matchesReadingContext(view, context), true);
  const href = notebookPassageHref(view, context, "P07");
  assert.ok(href);
  assert.equal(
    new URL(href, "https://example.com").searchParams.get("version"),
    "historical-v1",
  );
  view.reading.content_ref = { ...view.reading.content_ref, source_version: 2 };
  assert.equal(matchesReadingContext(view, context), false);
});

test("N4 pending retains the same authorized view; unavailable and unresolved states never mount it", () => {
  const { view, context } = input();
  const result = readingPresentation({
    state: { status: "pending", data: view, message: "Refreshing reading…" },
    context: { status: "ready", data: context },
  });
  assert.equal(result.status, "resolved");
  if (result.status === "resolved") {
    assert.equal(result.pending, true);
    assert.equal(result.view, view);
  }
  for (const status of ["empty", "unavailable"] as const) {
    assert.deepEqual(
      readingPresentation({
        state: { status, message: "Unavailable" },
        context: { status: "ready", data: context },
      }),
      { status, message: "Unavailable" },
    );
  }
  assert.equal(
    readingPresentation({
      state: { status: "loading" },
      context: { status: "ready", data: context },
    }).status,
    "loading",
  );
  assert.equal(
    readingPresentation({
      state: { status: "pending", data: null, message: "Resolving…" },
      context: { status: "ready", data: context },
    }).status,
    "pending",
  );
});
