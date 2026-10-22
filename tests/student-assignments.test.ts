import assert from "node:assert/strict";
import test from "node:test";
import type { DashboardLesson } from "../lib/tutoring/dashboard-model.ts";
import {
  assignmentScopeOptions,
  continuingAssignment,
  matchesAssignment,
  normalizeAssignmentScope,
  practiceCategory,
  practiceStatus,
  scopeAssignments,
  sourceLocationKey,
  type AssignmentScope,
} from "../app/study/assignments/presentation.ts";

const all: AssignmentScope = { classId: "", sourceKey: "", locationKey: "" };
const sourcePath: DashboardLesson["sourcePath"] = [
  { number: "1", title: "Foundation", kind: "chapter" },
  { number: "1.5", title: "Performance", kind: "section" },
  { number: "1.5.1", title: "Bandwidth and Latency", kind: "section" },
];

function lesson(
  id: string,
  classId: string,
  status: NonNullable<DashboardLesson["session"]>["status"] | null = null,
): DashboardLesson {
  return {
    id,
    classId,
    className: "Same class name",
    title: "Packet delays",
    teacherApprovedAt: "2026-10-21T12:00:00Z",
    sourceTitle: "A networking textbook",
    sourceKey: "networking-textbook",
    sourceSection: "Approved reading",
    sourcePath,
    approval_label: "Approved by your teacher",
    session: status ? { id: `session-${id}`, status } : null,
    latestSessionStartedAt: null,
    lastCompletedAt: null,
    lastPracticedAt: null,
    topics: [
      {
        id: "transmission",
        title: "Transmission delay",
        objectives: [],
        passageIds: [],
        practiced: false,
        responseCount: 0,
        latestSessionId: null,
      },
    ],
  };
}

test("assignment categories preserve pending/support states and never infer assignment completion from topic counts", () => {
  for (const status of ["active", "pending_evaluation", "unevaluated"] as const)
    assert.equal(
      practiceCategory(lesson(status, "class", status)),
      "In progress",
    );
  assert.equal(practiceCategory(lesson("new", "class")), "To start");
  const completed = lesson("done", "class", "completed");
  assert.equal(practiceCategory(completed), "Completed");
  assert.equal(practiceStatus(completed), "Completed");
  assert.equal(
    practiceStatus(lesson("pending", "class", "pending_evaluation")),
    "Evaluation pending",
  );
  assert.equal(
    practiceStatus(lesson("support", "class", "unevaluated")),
    "Teacher support needed",
  );
  completed.topics[0].practiced = true;
  completed.session = null;
  assert.equal(practiceCategory(completed), "To start");
});

test("resume selects the newest unfinished saved session without hiding or changing other assignments", () => {
  const older = {
    ...lesson("older", "class-a", "active"),
    latestSessionStartedAt: "2026-10-20T12:00:00Z",
  };
  const latest = {
    ...lesson("latest", "class-b", "pending_evaluation"),
    latestSessionStartedAt: "2026-10-21T12:00:00Z",
  };
  const complete = {
    ...lesson("complete", "class-b", "completed"),
    latestSessionStartedAt: "2026-10-22T12:00:00Z",
  };
  const unstarted = lesson("new", "class-a");
  const lessons = [older, complete, unstarted, latest];
  const before = structuredClone(lessons);
  assert.equal(continuingAssignment(lessons)?.session?.id, "session-latest");
  assert.equal(continuingAssignment([...lessons].reverse())?.id, "latest");
  assert.deepEqual(lessons, before);
  assert.equal(continuingAssignment([complete, unstarted]), null);
  assert.equal(continuingAssignment([]), null);
  const support = lesson("support", "class-a", "unevaluated");
  assert.equal(continuingAssignment([support]), support);
});

test("class and source filters keep distinct identities without dropping assignments that share reading", () => {
  const first = lesson("one", "class-a");
  const second = lesson("two", "class-b");
  const third = {
    ...lesson("three", "class-a"),
    sourceKey: "another-textbook",
    sourceTitle: "Another textbook",
  };
  const lessons = [first, second, lesson("four", "class-a"), third];
  assert.deepEqual(assignmentScopeOptions(lessons, all).classes, [
    { value: "class-a", label: "Same class name" },
    { value: "class-b", label: "Same class name" },
  ]);
  assert.deepEqual(
    assignmentScopeOptions(lessons, { ...all, classId: "class-b" }).sources,
    [{ value: "networking-textbook", label: "A networking textbook" }],
  );
  assert.deepEqual(
    scopeAssignments(lessons, {
      classId: "class-a",
      sourceKey: "networking-textbook",
      locationKey: sourceLocationKey(sourcePath.slice(0, 1)),
    }).map(({ id }) => id),
    ["one", "four"],
  );
  assert.deepEqual(scopeAssignments(lessons, all), lessons);
});

test("chapter filters include descendant sections but do not cross sources with matching chapter labels", () => {
  const first = lesson("one", "class-a");
  const sibling = {
    ...lesson("two", "class-a"),
    sourcePath: [
      ...sourcePath.slice(0, 2),
      {
        number: "1.5.2",
        title: "Delay × Bandwidth Product",
        kind: "section" as const,
      },
    ],
  };
  const anotherChapter = {
    ...lesson("three", "class-a"),
    sourcePath: [
      { number: "2", title: "Direct Links", kind: "chapter" as const },
    ],
  };
  const anotherSource = { ...first, id: "four", sourceKey: "another-textbook" };
  const lessons = [first, sibling, anotherChapter, anotherSource];
  const scope = {
    ...all,
    sourceKey: first.sourceKey,
    locationKey: sourceLocationKey(sourcePath.slice(0, 1)),
  };
  assert.deepEqual(
    scopeAssignments(lessons, scope).map(({ id }) => id),
    ["one", "two"],
  );
  assert.deepEqual(
    scopeAssignments(lessons, {
      ...scope,
      locationKey: sourceLocationKey(sourcePath),
    }).map(({ id }) => id),
    ["one"],
  );
  assert.deepEqual(
    scopeAssignments(lessons, {
      ...scope,
      sourceKey: anotherSource.sourceKey,
    }).map(({ id }) => id),
    ["four"],
  );
  // A chapter is not a global filter when a source has not been selected.
  assert.deepEqual(
    scopeAssignments(lessons, { ...scope, sourceKey: "" }),
    lessons,
  );
  assert.deepEqual(
    assignmentScopeOptions(lessons, scope).locations.map(
      ({ label, depth }) => ({ label, depth }),
    ),
    [
      { label: "Chapter 1: Foundation", depth: 0 },
      { label: "1.5 Performance", depth: 1 },
      { label: "1.5.1 Bandwidth and Latency", depth: 2 },
      { label: "1.5.2 Delay × Bandwidth Product", depth: 2 },
      { label: "Chapter 2: Direct Links", depth: 0 },
    ],
  );
});

test("location identity includes ancestors and supports unnumbered sections", () => {
  const first = lesson("one", "class-a");
  const second = lesson("two", "class-a");
  first.sourcePath = [
    sourcePath[0],
    { number: null, title: "Review", kind: "section" },
  ];
  second.sourcePath = [
    { number: "2", title: "Direct Links", kind: "chapter" },
    { number: null, title: "Review", kind: "section" },
  ];
  const scope = {
    ...all,
    sourceKey: first.sourceKey,
    locationKey: sourceLocationKey(first.sourcePath),
  };
  assert.deepEqual(scopeAssignments([first, second], scope), [first]);
  assert.equal(
    assignmentScopeOptions([first, second], scope).locations.length,
    4,
  );
});

test("articles and empty projections never invent chapters", () => {
  const article = {
    ...lesson("article", "class"),
    sourceKey: "article",
    sourceTitle: "A standalone article",
    sourcePath: [],
  };
  assert.deepEqual(
    assignmentScopeOptions([article], { ...all, sourceKey: article.sourceKey })
      .locations,
    [],
  );
  assert.deepEqual(assignmentScopeOptions([article], all).locations, []);
  assert.deepEqual(assignmentScopeOptions([], all), {
    classes: [],
    sources: [],
    locations: [],
  });
  assert.deepEqual(scopeAssignments([], all), []);
});

test("scope normalization removes unavailable class, source, and chapter selections", () => {
  const first = lesson("one", "class-a");
  const second = {
    ...lesson("two", "class-b"),
    sourceKey: "another-textbook",
    sourceTitle: "Another textbook",
    sourcePath: [],
  };
  const lessons = [first, second];
  const selected = {
    classId: first.classId,
    sourceKey: first.sourceKey,
    locationKey: sourceLocationKey(sourcePath),
  };
  assert.deepEqual(normalizeAssignmentScope(lessons, selected), selected);
  assert.deepEqual(
    normalizeAssignmentScope(lessons, { ...selected, classId: "missing" }),
    all,
  );
  assert.deepEqual(
    normalizeAssignmentScope(lessons, { ...selected, classId: second.classId }),
    { classId: second.classId, sourceKey: "", locationKey: "" },
  );
  assert.deepEqual(
    normalizeAssignmentScope(lessons, {
      ...all,
      sourceKey: second.sourceKey,
      locationKey: selected.locationKey,
    }),
    { ...all, sourceKey: second.sourceKey },
  );
  assert.deepEqual(
    normalizeAssignmentScope(lessons, { ...selected, sourceKey: "" }),
    { classId: first.classId, sourceKey: "", locationKey: "" },
  );
  assert.deepEqual(normalizeAssignmentScope([], selected), all);
});

test("assignment search trims input and matches actual titles, class, source, chapter, section, and approved topics", () => {
  const assignment = lesson("one", "class-a");
  for (const search of [
    " PACKET ",
    "same class",
    "networking",
    "APPROVED",
    "Transmission",
    "chapter 1",
    "Foundation",
    "1.5 performance",
    "Bandwidth and Latency",
    "",
  ])
    assert.equal(matchesAssignment(assignment, search), true);
  assert.equal(
    matchesAssignment(assignment, "fictional title that does not exist"),
    false,
  );
});
