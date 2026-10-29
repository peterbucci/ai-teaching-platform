import assert from "node:assert/strict";
import test from "node:test";
import { buildDemoFixture } from "../../../lib/evidence/demo.ts";
import { loadApprovedContent } from "../../../lib/evidence/content.ts";
import { calculateClassMetrics } from "../../../lib/teacher/metrics.ts";
import { parseTeacherWorkspaceContext } from "../../../lib/teacher/workspace-contracts.ts";
import {
  overviewPriorities,
  recentActivity,
  progressHref,
  unfinishedLesson,
  type OverviewAssignment,
  type WorkItem,
} from "./model.ts";
import { loadOverview } from "./load.ts";

const content = loadApprovedContent();
function assignment(
  id = "30000000-0000-4000-8000-000000000001",
): OverviewAssignment {
  const fixture = buildDemoFixture(content);
  const students = fixture.enrollments.map((e) => ({
    student_id: e.student_id,
    display_name: fixture.profiles.find((p) => p.id === e.student_id)!
      .display_name,
  }));
  return {
    id,
    title: "Networking",
    class_name: "Class A",
    availability: "active",
    snapshot: {
      students,
      evidence: fixture.sessions,
      metrics: calculateClassMetrics(
        students.map((s) => s.student_id),
        [...content.concept_ids],
        fixture.sessions,
      ),
      conceptTitles: Object.fromEntries(
        [...content.concepts].map(([id, c]) => [id, c.title]),
      ),
    },
  };
}

test("workspace keeps concerns from both assignments without adding student denominators", () => {
  const a = assignment();
  const b = {
    ...assignment("30000000-0000-4000-8000-000000000002"),
    class_name: "Class B",
  };
  const before = JSON.stringify([a, b]);
  const items = overviewPriorities([a, b], [], "all");
  assert.ok(items.some((p) => p.where.startsWith("Class A")));
  assert.ok(items.some((p) => p.where.startsWith("Class B")));
  assert.equal(items.length, overviewPriorities([a], [], "all").length * 2);
  assert.equal(new Set(items.map((p) => p.id)).size, items.length);
  assert.equal(JSON.stringify([a, b]), before);
});

test("missing answers are separate from assessed concerns; inactive and unavailable evidence makes no learning priority", () => {
  const a = assignment();
  a.snapshot!.evidence = [];
  a.snapshot!.metrics = calculateClassMetrics(
    a.snapshot!.students.map((s) => s.student_id),
    [...content.concept_ids],
    [],
  );
  const items = overviewPriorities([a], [], "all");
  assert.equal(items.length, 1);
  assert.equal(items[0].group, "missing");
  assert.match(items[0].note, /not evidence/);
  assert.equal(
    overviewPriorities(
      [
        { ...a, availability: "inactive" },
        { ...a, snapshot: null },
      ],
      [],
      "all",
    ).length,
    0,
  );
});

test("links retain exact saved response and origin, clear unrelated selections, and open Progress explicitly", () => {
  const a = assignment();
  const recent = recentActivity([a], "synthetic_fixture");
  const url = new URL(recent[0].href, "http://example.invalid");
  assert.equal(url.searchParams.get("attempt"), recent[0].id);
  assert.equal(url.searchParams.get("origin"), "synthetic_fixture");
  assert.equal(url.searchParams.get("returnTo"), "desk");
  assert.ok(url.searchParams.get("session"));
  assert.equal(url.searchParams.get("seedAttempt"), null);
  assert.equal(
    new URL(progressHref(a.id, "all"), url).searchParams.get("view"),
    "progress",
  );
});

test("private, approved and delivered work remain different and published lessons are not unfinished", () => {
  const a = assignment();
  const base: WorkItem = {
    id: "work",
    title: "Review transmission",
    detail: "Saved",
    href: "/teacher/interventions",
    action: "Continue",
    kind: "private",
    assignmentId: a.id,
  };
  const decisions = overviewPriorities(
    [a],
    [
      base,
      { ...base, id: "approved", kind: "approved" },
      { ...base, id: "delivered", kind: "delivered" },
    ],
    "all",
  );
  assert.ok(!decisions.some((p) => p.id === "work"));
  assert.match(
    decisions.find((p) => p.id === "approved")!.note,
    /separate teacher action/,
  );
  assert.match(
    decisions.find((p) => p.id === "delivered")!.note,
    /does not establish retention/,
  );
  const lesson = {
    id: "lesson",
    title: "Water",
    revision: 2,
    approved_revision: 2,
    content_version: "1",
    published_versions: ["1"],
  };
  assert.equal(unfinishedLesson(lesson), false);
  assert.equal(unfinishedLesson({ ...lesson, content_version: "2" }), true);
});

test("explicit foreign assignment fails before any evidence or private draft read", async () => {
  let reads = 0;
  await assert.rejects(
    loadOverview(
      { actor: { profileId: "teacher", userId: "user" } },
      parseTeacherWorkspaceContext({
        assignment: "30000000-0000-4000-8000-000000000099",
      }),
      {
        teacherAssignments: async () => [
          { id: assignment().id, title: "Owned", class_name: "Class" },
        ],
        readInterventionDrafts: async () => {
          reads++;
          return [];
        },
      },
    ),
    /Assignment not found/,
  );
  assert.equal(reads, 0);
});

test("one unavailable assignment is retained with excluded counts; failures never look like empty saved work", async () => {
  const a = assignment();
  const result = await loadOverview(
    { actor: { profileId: "teacher", userId: "user" } },
    parseTeacherWorkspaceContext({}),
    {
      teacherAssignments: async () => [
        { id: a.id, title: a.title, class_name: a.class_name },
      ],
      assignmentReview: async () => {
        throw new Error("Unavailable version");
      },
      readInterventionDrafts: async () => {
        throw new Error("Store offline");
      },
      listTeacherLessons: async () => [],
    },
  );
  assert.equal(result.assignments.length, 1);
  assert.equal(result.assignments[0].snapshot, null);
  assert.equal(result.assignments[0].availability, "unavailable");
  assert.equal(result.notices.length, 2);
  assert.equal(
    overviewPriorities(result.assignments, result.work, "all").length,
    0,
  );
});
