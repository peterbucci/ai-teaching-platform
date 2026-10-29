import test from "node:test";
import assert from "node:assert/strict";
import {
  AssignmentWorkspaceSchema,
  assignmentHref,
  assignmentListHref,
  assignmentTree,
  filterAssignments,
} from "../app/teacher/assignments/workspace-model.ts";

const first = "20000000-0000-4000-8000-000000000001";
const second = "20000000-0000-4000-8000-000000000002";
test("discovery has no implicit assignment and legacy assignment links open review", () => {
  const discovery = AssignmentWorkspaceSchema.parse({});
  assert.equal(discovery.assignment, undefined);
  assert.equal(discovery.view, "review");
  assert.equal(discovery.progressView, "grid");
  assert.equal(discovery.pane, undefined);
  assert.equal(
    AssignmentWorkspaceSchema.parse({ assignment: first }).view,
    "review",
  );
  assert.equal(
    AssignmentWorkspaceSchema.parse({ view: "progress" }).assignment,
    undefined,
  );
  for (const progressView of ["grid", "concepts", "questions", "sessions"])
    assert.equal(
      AssignmentWorkspaceSchema.parse({ progressView, pane: "details" })
        .progressView,
      progressView,
    );
  assert.equal(AssignmentWorkspaceSchema.parse({ pane: "grid" }).pane, "grid");
  assert.throws(() =>
    AssignmentWorkspaceSchema.parse({ progressView: "scores" }),
  );
  assert.throws(() => AssignmentWorkspaceSchema.parse({ pane: "student" }));
});

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
    progressView: "questions",
    pane: "details",
    class: second,
    status: "inactive",
  });
  const changed = new URL(
    assignmentHref(context, { assignment: second }),
    "https://example.test",
  );
  assert.equal(changed.searchParams.get("assignment"), second);
  assert.equal(changed.searchParams.get("student"), null);
  assert.equal(changed.searchParams.get("concept"), null);
  assert.equal(changed.searchParams.get("pane"), null);
  assert.equal(changed.searchParams.get("origin"), "synthetic_fixture");
  assert.equal(changed.searchParams.get("class"), second);
  assert.equal(changed.searchParams.get("status"), "inactive");
  const same = new URL(
    assignmentHref(context, { view: "preview" }),
    "https://example.test",
  );
  assert.equal(same.searchParams.get("student"), first);
  assert.equal(same.searchParams.get("concept"), "latency");
  assert.equal(same.searchParams.get("pane"), "details");
  const cleared = new URL(
    assignmentHref(context, { assignment: undefined }),
    "https://example.test",
  );
  for (const key of ["assignment", "student", "concept", "pane"])
    assert.equal(cleared.searchParams.get(key), null);
  assert.throws(() =>
    AssignmentWorkspaceSchema.parse({ assignment: [first, second] }),
  );
});

test("returning to discovery retains only the class and availability filters", () => {
  const context = AssignmentWorkspaceSchema.parse({
    assignment: first,
    class: second,
    status: "inactive",
    view: "progress",
    origin: "synthetic_fixture",
    student: first,
    concept: "latency",
    progressView: "sessions",
    pane: "details",
  });
  assert.equal(
    assignmentListHref(context),
    `/teacher/assignments?class=${second}&status=inactive`,
  );
  assert.equal(
    assignmentListHref({ ...context, class: undefined, status: "all" }),
    "/teacher/assignments",
  );
});

test("discovery groups exact lesson and version identities while retaining every class assignment", () => {
  const catalog = [
    {
      id: first,
      title: "Network performance",
      revision: 3,
      approved_revision: 2,
      content_version: "v3-draft",
      published_versions: ["v1", "v2", "v2-unassigned"],
    },
    {
      id: second,
      title: "Network performance",
      revision: 1,
      approved_revision: 1,
      content_version: "v1",
      published_versions: ["v1"],
    },
  ];
  const rows = [
    {
      id: "first-class-v1",
      class_id: first,
      lesson_id: first,
      lesson_title: "Network performance",
      lesson_version: "v1",
    },
    {
      id: "second-class-v1",
      class_id: second,
      lesson_id: first,
      lesson_title: "Network performance",
      lesson_version: "v1",
    },
    {
      id: "first-class-v2",
      class_id: first,
      lesson_id: first,
      lesson_title: "Network performance",
      lesson_version: "v2",
    },
    {
      id: "different-lesson-v1",
      class_id: first,
      lesson_id: second,
      lesson_title: "Network performance",
      lesson_version: "v1",
    },
    {
      id: "curated-class",
      class_id: second,
      lesson_id: "curated-network",
      lesson_title: "Network performance",
      lesson_version: "v1",
    },
  ];
  const before = structuredClone({ rows, catalog });
  const tree = assignmentTree(rows, catalog);
  assert.equal(
    tree.length,
    3,
    "Identical titles must not merge lesson identities.",
  );
  assert.deepEqual(
    tree.map((lesson) => lesson.id),
    [first, second, "curated-network"],
  );
  assert.deepEqual(
    tree[0].versions.map((version) => version.version),
    ["v1", "v2", "v2-unassigned"],
  );
  assert.deepEqual(tree[0].versions[0].assignments, [rows[0], rows[1]]);
  assert.deepEqual(tree[0].versions[1].assignments, [rows[2]]);
  assert.deepEqual(tree[0].versions[2].assignments, []);
  assert.equal(
    tree[0].draftRevision,
    3,
    "An unpublished draft must not become an assignable version.",
  );
  assert.deepEqual(tree[1].versions[0].assignments, [rows[3]]);
  assert.equal(tree[1].draftRevision, undefined);
  assert.equal(tree[1].owned, true);
  assert.equal(tree[2].owned, false);
  assert.deepEqual(tree[2].versions[0].assignments, [rows[4]]);
  assert.deepEqual(
    { rows, catalog },
    before,
    "Grouping must not change authorized catalog or assignment data.",
  );
});

test("filtered discovery retains lesson ownership without showing unassigned catalog versions", () => {
  const catalog = [
    {
      id: first,
      title: "Owned lesson",
      revision: 2,
      approved_revision: 2,
      content_version: "v2",
      published_versions: ["v1", "v2"],
    },
    {
      id: second,
      title: "Unassigned lesson",
      revision: 1,
      approved_revision: null,
      content_version: "draft",
      published_versions: [],
    },
  ];
  const assignment = {
    lesson_id: first,
    lesson_title: "Owned lesson",
    lesson_version: "v1",
    class_id: first,
  };
  const filtered = assignmentTree([assignment], catalog, {
    includeUnassigned: false,
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, first);
  assert.equal(filtered[0].owned, true);
  assert.equal(
    filtered[0].draftRevision,
    undefined,
    "A newer publication outside the filter is not an unpublished draft.",
  );
  assert.deepEqual(filtered[0].versions, [
    { version: "v1", assignments: [assignment] },
  ]);
  assert.deepEqual(
    assignmentTree([], catalog, { includeUnassigned: false }),
    [],
  );
  assert.equal(
    assignmentTree([], catalog).length,
    2,
    "Unfiltered discovery still shows authorized lessons before assignment.",
  );
});

test("discovery puts assigned publications before unassigned versions and drafts without changing identities", () => {
  const draft = {
    id: first,
    title: "Draft first in catalog",
    revision: 1,
    approved_revision: null,
    content_version: "draft",
    published_versions: [] as string[],
  };
  const published = {
    ...draft,
    id: second,
    title: "Published lesson",
    published_versions: ["immutable-older", "immutable-newer"],
  };
  const assigned = {
    lesson_id: "curated",
    lesson_title: "Assigned lesson",
    lesson_version: "exact-immutable-version",
  };
  const catalog = [draft, published];
  const original = structuredClone(catalog);
  const tree = assignmentTree([assigned], catalog);
  assert.deepEqual(
    tree.map((item) => item.id),
    ["curated", second, first],
  );
  assert.deepEqual(
    tree[1].versions.map((item) => item.version),
    published.published_versions,
  );
  assert.deepEqual(tree[0].versions[0].assignments, [assigned]);
  assert.deepEqual(catalog, original);
});
