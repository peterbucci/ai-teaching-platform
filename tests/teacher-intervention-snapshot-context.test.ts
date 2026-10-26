import assert from "node:assert/strict";
import test from "node:test";
import { buildClassFixture } from "../lib/evidence/class-fixture.ts";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import { buildInterventionEvidence } from "../lib/interventions/evidence.ts";
import { calculateClassMetrics } from "../lib/teacher/metrics.ts";
import {
  parseTeacherWorkspaceContext,
  teacherWorkspaceHref,
} from "../lib/teacher/workspace-contracts.ts";
import { resolveTeacherNavigationContext } from "../app/teacher/navigation-context.ts";
import {
  acknowledgedInterventionContext,
  interventionObservationHref,
  snapshotInterventionContext,
} from "../app/teacher/interventions/snapshot-context.ts";

const content = loadApprovedContent();
const fixture = buildClassFixture(content);
const students = fixture.enrollments.map((item) => ({
  student_id: item.student_id,
  display_name: fixture.profiles.find(
    (profile) => profile.id === item.student_id,
  )!.display_name,
}));
const evidence = buildInterventionEvidence(
  {
    assignment_id: DEMO_IDS.assignmentId,
    class_id: DEMO_IDS.classId,
    title: "Fictional assignment",
    class_name: "Fictional class",
    approved_misconception_ids: [...content.misconceptions.keys()],
    students,
    evidence: fixture.sessions,
    metrics: calculateClassMetrics(
      students.map((item) => item.student_id),
      [...content.concept_ids],
      fixture.sessions,
    ),
  },
  content,
  {
    assignment_id: DEMO_IDS.assignmentId,
    concept_id: "transmission_delay",
    origin: "synthetic_fixture",
    attempt_ids: [],
    misconception_id: null,
  },
);
const draft = { assignment_id: DEMO_IDS.assignmentId, evidence };
const first = evidence.observations[0];
const draftId = "70000000-0000-4000-8000-000000000001";

test("saved snapshot replaces conflicting filters and seeds without rewriting the snapshot", () => {
  for (const origin of ["synthetic_fixture", "live_demo"] as const) {
    const saved = structuredClone(draft);
    saved.evidence.selection.origin = origin;
    saved.evidence.observations.forEach((item) => {
      item.data_origin = origin;
    });
    saved.evidence.selection.attempt_ids = [first.attempt.id];
    const before = JSON.stringify(saved);
    const context = snapshotInterventionContext(
      parseTeacherWorkspaceContext({
        origin: origin === "live_demo" ? "synthetic_fixture" : "live_demo",
        concept: "stale-concept",
        misconception: "stale-insight",
        seedAttempt: [DEMO_IDS.classId],
        q: "unrelated search",
        returnTo: "patterns",
      }),
      saved,
    );
    assert.ok(context);
    assert.equal(context.assignment, saved.assignment_id);
    assert.equal(context.origin, origin);
    assert.equal(context.concept, saved.evidence.selection.concept_id);
    assert.equal(context.misconception, undefined);
    assert.deepEqual(context.seedAttempt, [first.attempt.id]);
    assert.equal(context.q, undefined);
    assert.equal(context.returnTo, "patterns");
    assert.equal(JSON.stringify(saved), before);
  }
});

test("saved draft rejects a different explicit assignment and inconsistent snapshot assignment", () => {
  assert.equal(
    snapshotInterventionContext(
      parseTeacherWorkspaceContext({ assignment: DEMO_IDS.classId }),
      draft,
    ),
    null,
  );
  assert.equal(
    snapshotInterventionContext(parseTeacherWorkspaceContext({}), {
      ...draft,
      assignment_id: DEMO_IDS.classId,
    }),
    null,
  );
});

test("only matching exact response identities survive saved draft navigation", () => {
  const exact = snapshotInterventionContext(
    parseTeacherWorkspaceContext({ attempt: first.attempt.id }),
    draft,
  );
  assert.ok(exact);
  assert.equal(exact.student, first.student_id);
  assert.equal(exact.session, first.session_id);
  assert.equal(exact.evaluation, first.evaluation.id);
  const stale = snapshotInterventionContext(
    parseTeacherWorkspaceContext({
      attempt: first.attempt.id,
      evaluation: DEMO_IDS.classId,
      student: first.student_id,
    }),
    draft,
  );
  assert.ok(stale);
  for (const field of ["student", "session", "attempt", "evaluation"] as const)
    assert.equal(stale[field], undefined);
});

test("full-session inspection links use saved evidence rather than conflicting URL scope", () => {
  const href = interventionObservationHref(
    parseTeacherWorkspaceContext({
      assignment: DEMO_IDS.classId,
      origin: "live_demo",
      concept: "wrong-concept",
      misconception: "wrong-insight",
      seedAttempt: [DEMO_IDS.classId],
      q: "unrelated search",
    }),
    evidence,
    first.attempt.id,
  );
  const url = new URL(href, "https://example.test");
  assert.equal(
    url.searchParams.get("assignment"),
    evidence.selection.assignment_id,
  );
  assert.equal(url.searchParams.get("origin"), evidence.selection.origin);
  assert.equal(url.searchParams.get("concept"), evidence.selection.concept_id);
  assert.equal(url.searchParams.get("misconception"), null);
  assert.equal(url.searchParams.get("q"), null);
  assert.deepEqual(
    url.searchParams.getAll("seedAttempt"),
    evidence.selection.attempt_ids,
  );
  assert.equal(url.searchParams.get("student"), first.student_id);
  assert.equal(url.searchParams.get("session"), first.session_id);
  assert.equal(url.searchParams.get("attempt"), first.attempt.id);
  assert.equal(url.searchParams.get("evaluation"), first.evaluation.id);
  assert.equal(url.hash, `#evaluation-${first.evaluation.id}`);
  assert.throws(
    () =>
      interventionObservationHref(
        parseTeacherWorkspaceContext({}),
        evidence,
        DEMO_IDS.classId,
      ),
    /saved evidence/,
  );
});

test("acknowledged request A replaces stale recovery scope B before shared navigation", () => {
  const initialContext = parseTeacherWorkspaceContext({
    assignment: DEMO_IDS.assignmentId,
    origin: "live_demo",
    concept: "bandwidth_throughput",
    misconception: "unrelated-insight",
    student: "unrelated-student",
    session: DEMO_IDS.classId,
    attempt: DEMO_IDS.classId,
    evaluation: DEMO_IDS.classId,
    seedAttempt: [DEMO_IDS.classId],
    q: "unrelated search",
    returnTo: "patterns",
  });
  const saved = structuredClone({ ...draft, id: draftId });
  saved.evidence.selection.attempt_ids = [first.attempt.id];
  const canonical = acknowledgedInterventionContext(
    { ...initialContext, request: DEMO_IDS.classId },
    saved,
    draftId,
  );
  assert.equal(canonical.origin, saved.evidence.selection.origin);
  assert.equal(canonical.concept, saved.evidence.selection.concept_id);
  assert.deepEqual(canonical.seedAttempt, [first.attempt.id]);
  for (const field of [
    "student",
    "session",
    "attempt",
    "evaluation",
    "misconception",
    "q",
  ] as const)
    assert.equal(canonical[field], undefined);

  const params = new URL(
    teacherWorkspaceHref("/teacher/interventions", canonical),
    "https://example.test",
  ).searchParams;
  params.set("draft", draftId);
  const navigated = resolveTeacherNavigationContext(initialContext, {
    ...Object.fromEntries(params),
    seedAttempt: params.getAll("seedAttempt"),
  });
  assert.deepEqual(navigated, parseTeacherWorkspaceContext(canonical));
});

test("acknowledged request cannot replace a different draft or assignment", () => {
  const saved = { ...draft, id: draftId };
  assert.throws(
    () => acknowledgedInterventionContext({}, saved, DEMO_IDS.classId),
    /another draft/,
  );
  assert.throws(
    () =>
      acknowledgedInterventionContext(
        { assignment: DEMO_IDS.classId },
        saved,
        draftId,
      ),
    /does not match this assignment/,
  );
  assert.throws(
    () =>
      acknowledgedInterventionContext(
        {},
        { ...saved, assignment_id: DEMO_IDS.classId },
        draftId,
      ),
    /does not match this assignment/,
  );
  assert.equal(
    acknowledgedInterventionContext({}, saved, draftId).assignment,
    saved.assignment_id,
  );
});
