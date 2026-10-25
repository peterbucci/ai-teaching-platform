import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveTeacherNavigationContext,
  teacherNavigationHref,
} from "../app/teacher/navigation-context.ts";
import {
  parseTeacherWorkspaceContext,
  teacherWorkspaceHref,
} from "../lib/teacher/workspace-contracts.ts";

const assignment = "30000000-0000-4000-8000-000000000001";
const otherAssignment = "30000000-0000-4000-8000-000000000002";
const attempt = "50000000-0000-4000-8000-000000000001";
const otherAttempt = "50000000-0000-4000-8000-000000000002";
const session = "40000000-0000-4000-8000-000000000001";
const evaluation = "60000000-0000-4000-8000-000000000001";

const savedContext = parseTeacherWorkspaceContext({
  assignment,
  origin: "synthetic_fixture",
  concept: "transmission_delay",
  misconception: "delay_vs_rate",
  student: "fictional-student",
  session,
  attempt,
  evaluation,
  seedAttempt: [attempt],
  returnTo: "patterns",
});

function query(href: string) {
  return new URL(href, "https://example.test").searchParams;
}

test("authoritative saved draft navigation ignores every conflicting raw URL field", () => {
  const before = structuredClone(savedContext);
  const actual = resolveTeacherNavigationContext(
    savedContext,
    {
      assignment: otherAssignment,
      origin: "live_demo",
      concept: "bandwidth_throughput",
      misconception: "unrelated-insight",
      student: "unrelated-student",
      session: otherAttempt,
      attempt: otherAttempt,
      evaluation: otherAttempt,
      seedAttempt: [otherAttempt],
      q: "unrelated search",
      returnTo: "students",
      draft: "unrelated-draft",
      request: "unrelated-request",
    },
    true,
  );
  assert.deepEqual(actual, savedContext);
  assert.deepEqual(savedContext, before);
  const result = query(teacherNavigationHref("/teacher/evidence", actual));
  assert.equal(result.get("origin"), "synthetic_fixture");
  assert.equal(result.get("concept"), "transmission_delay");
  assert.equal(result.has("draft"), false);
  assert.equal(result.has("request"), false);
});

test("authoritative context keeps absent identities absent instead of filling them from stale URL fields", () => {
  const canonical = parseTeacherWorkspaceContext({
    assignment,
    origin: "synthetic_fixture",
    concept: "transmission_delay",
  });
  assert.deepEqual(
    resolveTeacherNavigationContext(
      canonical,
      {
        student: "unrelated-student",
        session,
        attempt,
        evaluation,
        seedAttempt: [attempt],
        misconception: "unrelated-insight",
        q: "unrelated search",
      },
      true,
    ),
    canonical,
  );
});

test("authoritative saved seeds survive a URL without seeds", () => {
  assert.deepEqual(
    resolveTeacherNavigationContext(savedContext, {}, true).seedAttempt,
    [attempt],
  );
});

test("ordinary investigations follow URL selection changes and explicit seed removal", () => {
  const changed = resolveTeacherNavigationContext(savedContext, {
    origin: "live_demo",
    concept: "bandwidth_throughput",
    seedAttempt: [otherAttempt],
  });
  assert.equal(changed.assignment, assignment);
  assert.equal(changed.origin, "live_demo");
  assert.equal(changed.concept, "bandwidth_throughput");
  assert.deepEqual(changed.seedAttempt, [otherAttempt]);
  assert.deepEqual(
    resolveTeacherNavigationContext(savedContext, {}).seedAttempt,
    [],
  );
});

test("an acknowledged draft URL replaces stale pre-generation context, including identities absent from the saved snapshot", () => {
  const acknowledged = parseTeacherWorkspaceContext({
    assignment,
    origin: "live_demo",
    concept: "bandwidth_throughput",
    seedAttempt: [otherAttempt],
  });
  const params = query(
    teacherWorkspaceHref("/teacher/interventions", acknowledged),
  );
  params.set("draft", "70000000-0000-4000-8000-000000000001");
  const actual = resolveTeacherNavigationContext(savedContext, {
    ...Object.fromEntries(params),
    seedAttempt: params.getAll("seedAttempt"),
  });
  assert.deepEqual(actual, acknowledged);
  for (const field of ["student", "session", "attempt", "evaluation"])
    assert.equal(
      query(teacherNavigationHref("/teacher/evidence", actual)).has(field),
      false,
    );
});

test("invalid ordinary URL parameters fall back to the server context", () => {
  assert.deepEqual(
    resolveTeacherNavigationContext(savedContext, {
      assignment: [assignment, otherAssignment],
    }),
    savedContext,
  );
});

test("Lessons, Materials, and Objectives receive no investigation parameters", () => {
  for (const path of [
    "/teacher/lessons",
    "/teacher/materials",
    "/teacher/objectives",
  ] as const)
    assert.equal(teacherNavigationHref(path, savedContext), path);
});

test("Assignments retains only the assignment supported by its loader", () => {
  assert.deepEqual(
    [...query(teacherNavigationHref("/teacher/assignments", savedContext))],
    [["assignment", assignment]],
  );
  assert.equal(
    teacherNavigationHref(
      "/teacher/assignments",
      parseTeacherWorkspaceContext({}),
    ),
    "/teacher/assignments",
  );
});

test("Teaching Desk receives assignment and origin without an old investigation", () => {
  assert.deepEqual(
    [...query(teacherNavigationHref("/teacher", savedContext))],
    [
      ["assignment", assignment],
      ["origin", "synthetic_fixture"],
    ],
  );
});

test("Students receives assignment, origin, and optional student without response filters or search", () => {
  assert.deepEqual(
    [
      ...query(
        teacherNavigationHref("/teacher/students", {
          ...savedContext,
          q: "an answer phrase, not a student name",
        }),
      ),
    ],
    [
      ["assignment", assignment],
      ["origin", "synthetic_fixture"],
      ["student", "fictional-student"],
    ],
  );
});

test("Evidence and Interventions preserve the complete selected investigation", () => {
  for (const path of ["/teacher/evidence", "/teacher/interventions"] as const) {
    const params = query(teacherNavigationHref(path, savedContext));
    assert.deepEqual(
      parseTeacherWorkspaceContext({
        ...Object.fromEntries(params),
        seedAttempt: params.getAll("seedAttempt"),
      }),
      savedContext,
    );
  }
});
