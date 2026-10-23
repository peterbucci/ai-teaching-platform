import assert from "node:assert/strict";
import test from "node:test";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { sourcePath } from "../lib/reading/source-path.ts";
import {
  currentAssignmentId,
  topicProgress,
  type DashboardLesson,
} from "../lib/tutoring/dashboard-model.ts";

test("source navigation uses verified ancestors only for the retained textbook version", () => {
  const content = loadApprovedContent();
  const section = content.attribution.section;
  assert.deepEqual(sourcePath(section, content.content_ref), [
    { number: "1", title: "Foundation", kind: "chapter" },
    { number: "1.5", title: "Performance", kind: "section" },
    { number: "1.5.1", title: "Bandwidth and Latency", kind: "section" },
  ]);
  for (const reference of [
    { ...content.content_ref, source_id: "another-source" },
    { ...content.content_ref, source_commit: "another-version" },
  ])
    assert.deepEqual(sourcePath(section, reference), [
      { number: "1.5.1", title: "Bandwidth and Latency", kind: "section" },
    ]);
  assert.deepEqual(
    sourcePath("An unnumbered article", {
      ...content.content_ref,
      source_id: "article",
    }),
    [{ number: null, title: "An unnumbered article", kind: "section" }],
  );
});

test("topic practice counts distinct approved concepts from submitted responses, not completion or judgments", () => {
  const topics = ["transmission", "propagation", "queuing"].map((id) => ({
    id,
    title: id,
    objectives: [],
    passageIds: [],
  }));
  const first = {
    id: "first",
    sessionId: "older",
    submittedAt: "2026-10-20T12:00:00Z",
    conceptIds: ["transmission", "propagation"],
  };
  const progress = topicProgress(topics, [
    first,
    first,
    {
      ...first,
      id: "second",
      sessionId: "newer",
      submittedAt: "2026-10-21T12:00:00Z",
      conceptIds: ["transmission", "not-approved"],
    },
  ]);
  assert.equal(progress.filter((topic) => topic.practiced).length, 2);
  assert.deepEqual(
    progress.map((topic) => [topic.responseCount, topic.latestSessionId]),
    [
      [2, "newer"],
      [1, "older"],
      [0, null],
    ],
  );
  assert.equal(
    topicProgress(topics, []).some((topic) => topic.practiced),
    false,
  );
});

function lesson(
  id: string,
  status: NonNullable<DashboardLesson["session"]>["status"] | null,
  date = "2026-10-21T12:00:00Z",
): DashboardLesson {
  return {
    id,
    title: id,
    instructions: "",
    approval_label: "Approved by your teacher",
    session: status ? { id: `session-${id}`, status } : null,
    latestSessionStartedAt: status ? date : null,
    lastCompletedAt: status === "completed" ? date : null,
    lastPracticedAt: null,
    classId: "class-id",
    className: "Class",
    teacherApprovedAt: "2026-10-17T12:00:00Z",
    sourceKey: "reading-source",
    sourceTitle: "Reading",
    sourceSection: "Section",
    sourcePath: [{ number: null, title: "Section", kind: "section" }],
    topics: [],
  };
}

test("current work retains active and pending saved work ahead of new or complete assignments", () => {
  const complete = lesson("complete", "completed");
  const unstarted = lesson("new", null);
  for (const status of [
    "active",
    "pending_evaluation",
    "unevaluated",
  ] as const) {
    const saved = lesson("saved", status, "2026-10-18T12:00:00Z");
    assert.equal(currentAssignmentId([complete, unstarted, saved]), "saved");
  }
  assert.equal(currentAssignmentId([complete, unstarted]), "new");
  assert.equal(currentAssignmentId([complete]), "complete");
  assert.equal(currentAssignmentId([]), null);
});

test("current work is deterministic by newest saved session then stable IDs without mutating input", () => {
  const older = lesson("older", "active", "2026-10-18T12:00:00Z");
  const latest = lesson("latest", "pending_evaluation");
  const lessons = [older, latest];
  assert.equal(currentAssignmentId(lessons), "latest");
  assert.deepEqual(lessons, [older, latest]);
  assert.equal(
    currentAssignmentId([lesson("b", null), lesson("a", null)]),
    "a",
  );
  const ties = [lesson("a", "active"), lesson("b", "active")];
  assert.equal(
    currentAssignmentId(ties),
    currentAssignmentId([...ties].reverse()),
  );
});
