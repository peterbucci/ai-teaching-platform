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

const content = loadApprovedContent();
const fixture = buildClassFixture(content);
const evidence = fixture.sessions.find(
  (item) => new Set(item.evaluations.map((value) => value.attempt_id)).size > 1,
);
assert.ok(evidence);
const evaluation = evidence.evaluations[0];
const attempt = evidence.attempts.find(
  (item) => item.id === evaluation.attempt_id,
);
assert.ok(attempt);
const concepts = new Set(content.concepts.keys());
const roster = new Set(
  fixture.enrollments
    .filter((item) => item.class_id === evidence.session.class_id)
    .map((item) => item.student_id),
);
const foreign = "43cddbc7-76c0-46f5-8234-45304c7765d2";
const base = {
  assignment: evidence.session.assignment_id,
  origin: evidence.session.data_origin,
  student: evidence.session.student_id,
  concept: attempt.question.concept_ids[0],
  session: evidence.session.id,
  attempt: attempt.id,
  evaluation: evaluation.id,
  returnTo: "progress",
  progressView: "grid",
  progressStudent: evidence.session.student_id,
  progressConcept: attempt.question.concept_ids[0],
  pane: "details",
  class: evidence.session.class_id,
  status: "active",
};

test("Class Progress return carries only bounded selection and display context", () => {
  const resolved = resolveTeacherSessionContext(
    {
      ...base,
      seedAttempt: [attempt.id],
      q: "answer search must not leak into the return",
      draft: foreign,
      request: foreign,
      response: "private response",
      returnUrl: "https://example.test/redirect",
      focus: "arbitrary-selector",
    },
    evidence,
    concepts,
    roster,
  );
  assert.ok(resolved);
  const url = new URL(teacherReturnHref(resolved), "https://example.test");
  assert.equal(url.pathname, "/teacher/assignments");
  assert.equal(url.hash, "#cell-evidence");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    assignment: base.assignment,
    view: "progress",
    origin: base.origin,
    student: base.progressStudent,
    concept: base.progressConcept,
    progressView: "grid",
    pane: "details",
    class: base.class,
    status: "active",
  });
});

test("concept-column and whole-class returns do not invent the opened session's student selection", () => {
  const resolved = resolveTeacherSessionContext(
    { ...base, progressStudent: undefined },
    evidence,
    concepts,
    roster,
  );
  assert.ok(resolved);
  assert.equal(resolved.progressStudent, undefined);
  let url = new URL(teacherReturnHref(resolved), "https://example.test");
  assert.equal(url.searchParams.has("student"), false);
  const wholeClass = resolveTeacherSessionContext(
    {
      ...base,
      progressStudent: undefined,
      progressConcept: undefined,
      pane: "grid",
    },
    evidence,
    concepts,
    roster,
  );
  assert.ok(wholeClass);
  url = new URL(teacherReturnHref(wholeClass), "https://example.test");
  assert.equal(url.searchParams.has("student"), false);
  assert.equal(url.searchParams.has("concept"), false);
  assert.equal(url.hash, "#progress-main");
});

test("focus is derived from the visible progress subview instead of a caller selector", () => {
  for (const [progressView, expected] of [
    ["grid", `ap-selection-${base.progressStudent}-${base.progressConcept}`],
    ["concepts", `ap-selection-all-${base.progressConcept}`],
    ["questions", "progress-main"],
    ["sessions", "progress-main"],
  ]) {
    const url = new URL(
      teacherReturnHref(
        parseTeacherWorkspaceContext({ ...base, progressView, pane: "grid" }),
      ),
      "https://example.test",
    );
    assert.equal(decodeURIComponent(url.hash.slice(1)), expected);
    assert.equal(url.searchParams.get("progressView"), progressView);
  }
});

test("authorized session records reject unrelated return identities and pinned-version concepts", () => {
  for (const patch of [
    { assignment: foreign },
    { class: foreign },
    { student: foreign },
    { progressStudent: foreign },
    { session: foreign },
    { attempt: foreign },
    { evaluation: foreign },
    { origin: base.origin === "live_demo" ? "synthetic_fixture" : "live_demo" },
    { progressConcept: "concept-from-another-version" },
    {
      evaluation: evidence.evaluations.find(
        (item) => item.attempt_id !== attempt.id,
      )!.id,
    },
  ])
    assert.equal(
      resolveTeacherSessionContext(
        { ...base, ...patch },
        evidence,
        concepts,
        roster,
      ),
      null,
      JSON.stringify(patch),
    );
  assert.ok(
    resolveTeacherSessionContext(
      { ...base, origin: "all" },
      evidence,
      concepts,
      roster,
    ),
  );
});

test("ambiguous or arbitrary progress return fields are rejected, and other pages keep their own parameter contracts", () => {
  for (const patch of [
    { assignment: undefined },
    { progressView: "anything" },
    { pane: "source" },
    { class: "not-a-class" },
    { status: "published" },
    { student: "not-a-student-id" },
    { progressStudent: "not-a-student-id" },
    { progressStudent: [base.student, foreign] },
    { pane: ["grid", "details"] },
    { progressView: ["grid", "sessions"] },
    { returnTo: "//example.test" },
  ])
    assert.throws(() => parseTeacherWorkspaceContext({ ...base, ...patch }));
  const ordinary = parseTeacherWorkspaceContext({
    assignment: base.assignment,
    pane: "page-owned-pane",
    class: "",
    status: "page-owned-status",
    progressView: "page-owned-view",
  });
  for (const key of [
    "pane",
    "class",
    "status",
    "progressView",
    "progressStudent",
    "progressConcept",
  ])
    assert.equal(
      new URL(
        teacherWorkspaceHref("/teacher/evidence", ordinary),
        "https://example.test",
      ).searchParams.has(key),
      false,
    );
});

test("legacy direct session URLs and allowlisted Evidence/Insights returns retain their existing destinations", () => {
  const direct = resolveTeacherSessionContext({}, evidence, concepts, roster);
  assert.ok(direct);
  assert.equal(direct.returnTo, "insights");
  assert.equal(direct.assignment, base.assignment);
  for (const [returnTo, path] of [
    ["evidence", "/teacher/evidence"],
    ["insights", "/teacher/insights"],
    ["patterns", "/teacher/insights"],
  ]) {
    const legacy = resolveTeacherSessionContext(
      { ...base, returnTo },
      evidence,
      concepts,
      roster,
    );
    assert.ok(legacy);
    const url = new URL(teacherReturnHref(legacy), "https://example.test");
    assert.equal(url.pathname, path);
    assert.equal(url.searchParams.has("progressView"), false);
    assert.equal(url.searchParams.has("pane"), false);
    if (returnTo === "patterns") assert.equal(url.hash, "#patterns");
  }
});

test("assignment-wide questions and sessions preserve a different authorized originating student", () => {
  const progressStudent = [...roster].find((id) => id !== base.student);
  assert.ok(progressStudent);
  for (const progressView of ["questions", "sessions"]) {
    const resolved = resolveTeacherSessionContext(
      {
        ...base,
        student: undefined,
        progressStudent,
        progressView,
        pane: "grid",
      },
      evidence,
      concepts,
      roster,
    );
    assert.ok(resolved);
    const url = new URL(teacherReturnHref(resolved), "https://example.test");
    assert.equal(url.searchParams.get("student"), progressStudent);
    assert.equal(url.searchParams.get("concept"), base.progressConcept);
    assert.equal(url.hash, "#progress-main");
    assert.equal(url.searchParams.has("attempt"), false);
  }
});
