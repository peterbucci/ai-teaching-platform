import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type {
  DashboardLesson,
  StudentDashboard,
} from "../lib/tutoring/dashboard-model.ts";
import {
  allLearning,
  learningCategory,
  learningStatus,
  learningStatusNote,
  learningView,
  overviewHref,
  practiceCoverage,
  savedWorkHref,
} from "../app/study/notebook/learning/presentation.ts";

function lesson(
  id: string,
  status: NonNullable<DashboardLesson["session"]>["status"] | null = null,
): DashboardLesson {
  return {
    id,
    title: `Fictional lesson ${id}`,
    instructions: "Keep the original directions.\nExplain your thinking.",
    classId: "class-a",
    className: "Fictional class",
    sourceKey: "source-a",
    sourceTitle: "Fictional reading",
    sourceSection: "Approved excerpt",
    sourcePath: [],
    teacherApprovedAt: "2026-10-20T12:00:00Z",
    approval_label: "Approved by your teacher",
    latestSessionStartedAt: status ? "2026-10-23T12:00:00Z" : null,
    lastCompletedAt: status === "completed" ? "2026-10-23T13:00:00Z" : null,
    lastPracticedAt: null,
    session: status ? { id: `session-${id}`, status } : null,
    topics: [false, true].map((practiced, index) => ({
      id: `topic-${index}`,
      title: `Topic ${index}`,
      objectives: ["A real configured objective"],
      passageIds: ["passage"],
      practiced,
      responseCount: practiced ? 3 : 0,
      latestSessionId: practiced ? "historical-session" : null,
    })),
  };
}
function dashboard(
  lessons: DashboardLesson[],
  currentAssignmentId: string | null = null,
): StudentDashboard {
  return { displayName: "Fictional Learner", lessons, currentAssignmentId };
}

test("empty learning has no invented categories, assignments or continuation", () => {
  assert.deepEqual(learningView(dashboard([])), {
    groups: [],
    filters: ["All"],
    visibleCount: 0,
    continuing: null,
  });
});

test("new, active, completed and attention states reflect saved session status only", () => {
  const states = [
    null,
    "active",
    "completed",
    "pending_evaluation",
    "unevaluated",
  ] as const;
  assert.deepEqual(
    states.map((state) => learningCategory(lesson("a", state))),
    [
      "To start",
      "In progress",
      "Completed",
      "Needs attention",
      "Needs attention",
    ],
  );
  assert.equal(
    learningStatus(lesson("a", "pending_evaluation")),
    "Evaluation pending",
  );
  assert.equal(
    learningStatus(lesson("a", "unevaluated")),
    "Teacher support needed",
  );
  assert.match(
    learningStatusNote(lesson("a", "pending_evaluation")),
    /waiting for an evaluation/,
  );
  assert.equal(
    learningCategory(lesson("all-practiced", "active")),
    "In progress",
  );
});

test("practice coverage counts configured practiced topics once, never response counts or source concepts", () => {
  const input = lesson("a", "completed");
  assert.deepEqual(practiceCoverage(input), { practiced: 1, total: 2 });
  input.topics[1].responseCount = 99;
  assert.deepEqual(practiceCoverage(input), { practiced: 1, total: 2 });
  assert.deepEqual(practiceCoverage({ topics: [] }), {
    practiced: 0,
    total: 0,
  });
});

test("class and source grouping retains distinct identities even when labels match", () => {
  const a = lesson("a");
  const b = { ...lesson("b"), classId: "class-b" };
  const c = { ...lesson("c"), sourceKey: "source-b" };
  const view = learningView(dashboard([a, b, c]));
  assert.deepEqual(
    view.groups.map((group) => group.lessons.map((item) => item.id)),
    [["a"], ["b"], ["c"]],
  );
  assert.deepEqual(
    learningView(dashboard([a, b, c]), {
      ...allLearning,
      classId: "class-a",
      sourceKey: "source-b",
    }).groups[0].lessons,
    [c],
  );
  assert.equal(
    learningView(dashboard([a]), { ...allLearning, classId: "foreign" })
      .visibleCount,
    0,
  );
});

test("filters and search never mutate saved assignment/session/topic evidence", () => {
  const input = dashboard(
    [
      lesson("new"),
      lesson("active", "active"),
      lesson("complete", "completed"),
      lesson("pending", "pending_evaluation"),
    ],
    "active",
  );
  const before = structuredClone(input);
  for (const filter of [
    "All",
    "To start",
    "In progress",
    "Needs attention",
    "Completed",
  ] as const) {
    const view = learningView(input, { ...allLearning, filter });
    assert.equal(view.visibleCount, filter === "All" ? 4 : 1);
  }
  assert.equal(
    learningView(input, { ...allLearning, search: "  topic 1  " }).visibleCount,
    4,
  );
  assert.equal(
    learningView(input, { ...allLearning, search: "not present" }).visibleCount,
    0,
  );
  assert.deepEqual(input, before);
});

test("continuation preserves the authoritative unfinished assignment and exact current session", () => {
  const active = lesson("active", "active");
  const pending = lesson("pending", "pending_evaluation");
  const complete = lesson("complete", "completed");
  const input = dashboard([active, pending, complete], "pending");
  assert.equal(learningView(input).continuing, pending);
  assert.equal(
    learningView(input, { ...allLearning, search: "absent" }).continuing
      ?.session?.id,
    "session-pending",
  );
  assert.equal(learningView(dashboard([complete])).continuing, null);
  assert.equal(learningView(dashboard([active], "foreign")).continuing, null);
  assert.equal(learningView(dashboard([lesson("new")])).continuing, null);
});

test("overview and saved-work deep links encode identities and retain explicit historical sessions", () => {
  assert.equal(overviewHref("a/b"), "/study/assignments/a%2Fb?tab=overview");
  const link = new URL(
    savedWorkHref("a/b", "session + old"),
    "https://example.test",
  );
  assert.equal(link.pathname, "/study/assignments/a%2Fb");
  assert.equal(link.searchParams.get("tab"), "work");
  assert.equal(link.searchParams.get("session"), "session + old");
});

test("N2 delegates writes to AssignmentAction and does not install an intervention or assessment controller", () => {
  for (const name of [
    "my-learning.tsx",
    "assignment-overview.tsx",
    "shared.tsx",
    "presentation.ts",
  ]) {
    const source = readFileSync(
      new URL(`../app/study/notebook/learning/${name}`, import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(
      source,
      /\bfetch\s*\(|useEffect\s*\(|localStorage|sessionStorage|\/api\/|acknowledge\s*\(/,
    );
  }
  const home = readFileSync(
    new URL("../app/study/notebook/learning/my-learning.tsx", import.meta.url),
    "utf8",
  );
  assert.match(home, /<AssignmentAction/);
  assert.match(home, /data-notebook-slot="teacher-reviews"/);
  const overview = readFileSync(
    new URL(
      "../app/study/notebook/learning/assignment-overview.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(overview, /savedWork\?\.assignmentId === lesson.id/);
  assert.match(overview, /reader\?\.assignment.id === lesson.id/);
  assert.match(overview, /assignmentStudyHref\(lesson.id, session.id\)/);
});
