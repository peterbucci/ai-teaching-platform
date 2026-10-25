import assert from "node:assert/strict";
import test from "node:test";
import { buildClassFixture } from "../lib/evidence/class-fixture.ts";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import {
  parseTeacherWorkspaceContext,
  teacherReturnHref,
  teacherWorkspaceHref,
} from "../lib/teacher/workspace-contracts.ts";
import { resolveTeacherSessionContext } from "../app/teacher/workspace-session-context.ts";
import { switchedAssignmentHref } from "../app/teacher/workspace-model.ts";

const content = loadApprovedContent();
const fixture = buildClassFixture(content);
const evidence = fixture.sessions[0];
const attempt = evidence.attempts[0];
const evaluation = evidence.evaluations.find(
  (item) => item.attempt_id === attempt.id,
)!;
const concept = attempt.question.concept_ids[0];
const category = [...content.misconceptions.keys()][0];
const foreign = "43cddbc7-76c0-46f5-8234-45304c7765d2";
const base = {
  assignment: evidence.session.assignment_id,
  origin: evidence.session.data_origin,
  student: evidence.session.student_id,
  session: evidence.session.id,
  attempt: attempt.id,
  evaluation: evaluation.id,
  concept,
};
const resolve = (params: Parameters<typeof resolveTeacherSessionContext>[0]) =>
  resolveTeacherSessionContext(
    params,
    evidence,
    new Set(content.concepts.keys()),
    new Set(),
    new Set(content.misconceptions.keys()),
  );
const url = (href: string) => new URL(href, "https://example.test");

test("R01 displayed Back restores the original roster filters and work-log position only", () => {
  const params = {
    ...base,
    returnTo: "students",
    q: "Ada & Bea",
    participation: "submitted",
    rosterPane: "main",
  };
  const outgoing = url(
    teacherWorkspaceHref(`/teacher/sessions/${base.session}`, params),
  );
  const resolved = resolve(Object.fromEntries(outgoing.searchParams));
  assert.ok(resolved);
  const back = url(teacherReturnHref(resolved));
  assert.equal(back.pathname, "/teacher/students");
  assert.deepEqual(Object.fromEntries(back.searchParams), {
    assignment: base.assignment,
    origin: base.origin,
    student: base.student,
    concept,
    returnTo: "students",
    q: "Ada & Bea",
    participation: "submitted",
    workspacePane: "main",
  });
  assert.equal(back.hash, `#roster-attempt-${attempt.id}`);
  assert.deepEqual(params, {
    ...base,
    returnTo: "students",
    q: "Ada & Bea",
    participation: "submitted",
    rosterPane: "main",
  });
});

test("R02 By idea and concern returns preserve origin and their original concept/category", () => {
  for (const returnTo of ["insights", "patterns"]) {
    const resolved = resolve({
      ...base,
      student: undefined,
      returnTo,
      misconception: category,
    });
    assert.ok(resolved);
    const back = url(teacherReturnHref(resolved));
    assert.equal(back.pathname, "/teacher/insights");
    assert.deepEqual(Object.fromEntries(back.searchParams), {
      assignment: base.assignment,
      origin: base.origin,
      concept,
      returnTo,
      misconception: category,
    });
    assert.equal(
      back.hash,
      returnTo === "patterns" ? "#patterns" : `#concept-${concept}`,
    );
  }
});

test("reloading a session URL and changing filters use URL context, never remembered stale filters", () => {
  const original = {
    ...base,
    returnTo: "students",
    q: "Ada",
    participation: "submitted",
    rosterPane: "main",
  };
  const opened = teacherWorkspaceHref(
    `/teacher/sessions/${base.session}`,
    original,
  );
  const restored = resolve(Object.fromEntries(url(opened).searchParams));
  assert.ok(restored);
  assert.equal(
    teacherReturnHref(restored),
    teacherReturnHref(resolve(original)!),
  );
  const changed = resolve({
    ...original,
    origin: "all",
    q: "Bea",
    participation: "all",
    rosterPane: "context",
  });
  assert.ok(changed);
  const back = url(teacherReturnHref(changed));
  assert.equal(back.searchParams.get("origin"), "all");
  assert.equal(back.searchParams.get("q"), "Bea");
  assert.equal(back.searchParams.get("participation"), "all");
  assert.equal(back.searchParams.get("workspacePane"), "context");
  assert.equal(back.hash, `#roster-student-${base.student}`);
});

test("omitted original selections remain absent and direct deep links retain safe legacy defaults", () => {
  const direct = resolve({});
  assert.ok(direct);
  const back = url(teacherReturnHref(direct));
  assert.equal(back.pathname, "/teacher/insights");
  assert.equal(back.hash, "#responses");
  assert.equal(back.searchParams.get("assignment"), base.assignment);
  for (const field of [
    "student",
    "concept",
    "misconception",
    "q",
    "session",
    "attempt",
    "evaluation",
  ])
    assert.equal(back.searchParams.has(field), false);
  const roster = resolve({ returnTo: "students" });
  assert.ok(roster);
  assert.equal(url(teacherReturnHref(roster)).hash, "#roster-main");
});

test("unauthorized, stale and cross-assignment identities cannot enter contextual returns", () => {
  for (const returnTo of ["students", "insights", "patterns"]) {
    for (const patch of [
      { assignment: foreign },
      { student: foreign },
      { session: foreign },
      { attempt: foreign },
      { evaluation: foreign },
      {
        origin:
          base.origin === "synthetic_fixture"
            ? "live_demo"
            : "synthetic_fixture",
      },
      { concept: "removed-or-other-version-concept" },
      { misconception: "removed-or-other-version-category" },
    ])
      assert.equal(
        resolve({ ...base, returnTo, ...patch }),
        null,
        JSON.stringify({ returnTo, patch }),
      );
  }
});

test("bounded roster fields reject ambiguity and are ignored by other return contracts", () => {
  for (const patch of [
    { participation: "passed" },
    { rosterPane: "dialog" },
    { student: "not-a-uuid" },
    { q: "x".repeat(121) },
    { rosterPane: ["main", "context"] },
    { participation: ["all", "missing"] },
    { returnTo: "https://example.test" },
  ])
    assert.throws(() =>
      parseTeacherWorkspaceContext({ ...base, returnTo: "students", ...patch }),
    );
  for (const returnTo of [
    "evidence",
    "insights",
    "patterns",
    "progress",
    "desk",
  ]) {
    const parsed = parseTeacherWorkspaceContext({
      ...base,
      returnTo,
      rosterPane: "arbitrary",
      participation: "arbitrary",
    });
    assert.equal(parsed.rosterPane, undefined);
    assert.equal(parsed.participation, undefined);
  }
});

test("displayed return strips target records, mutation identities and arbitrary destinations", () => {
  for (const returnTo of ["students", "insights", "patterns"]) {
    const resolved = resolve({
      ...base,
      returnTo,
      seedAttempt: [attempt.id],
      response: "private original answer",
      request: foreign,
      draft: foreign,
      returnUrl: "https://example.test/steal",
      focus: "arbitrary-selector",
    });
    assert.ok(resolved);
    const back = url(teacherReturnHref(resolved));
    for (const field of [
      "session",
      "attempt",
      "evaluation",
      "seedAttempt",
      "response",
      "request",
      "draft",
      "returnUrl",
      "focus",
    ])
      assert.equal(back.searchParams.has(field), false);
    assert.equal(back.origin, "https://example.test");
    assert.equal(back.href.includes("private"), false);
  }
});

test("assignment switching clears the complete originating investigation", () => {
  const switched = url(switchedAssignmentHref(foreign, "all"));
  assert.deepEqual(Object.fromEntries(switched.searchParams), {
    assignment: foreign,
    origin: "all",
    returnTo: "evidence",
    view: "progress",
  });
});
