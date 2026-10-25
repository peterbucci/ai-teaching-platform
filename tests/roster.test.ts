import assert from "node:assert/strict";
import test from "node:test";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { buildClassFixture } from "../lib/evidence/class-fixture.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import {
  authorizedRosterSelection,
  conceptTrail,
  evaluationFor,
  linkedAssistance,
  participation,
  responseMark,
  studentInterventions,
  studentSessions,
  workEvents,
} from "../app/teacher/students/roster-model.ts";
import {
  parseRosterContext,
  rosterHref,
  rosterSessionHref,
} from "../app/teacher/students/roster-context.ts";
import type { InterventionReview } from "../lib/interventions/approval-contracts.ts";

const fixture = buildClassFixture(loadApprovedContent());
const data = {
  assignment_id: DEMO_IDS.assignmentId,
  class_id: DEMO_IDS.classId,
  students: fixture.enrollments.map((e) => ({
    student_id: e.student_id,
    display_name: e.student_id,
  })),
  evidence: fixture.sessions,
};
const ctx = parseRosterContext({
  assignment: data.assignment_id,
  student: DEMO_IDS.studentOne,
});

test("roster rejects foreign class, student, session, mismatched attempt and evaluation", () => {
  assert.ok(authorizedRosterSelection(data, ctx));
  assert.equal(
    authorizedRosterSelection(data, { ...ctx, student: DEMO_IDS.teacher }),
    false,
  );
  assert.equal(
    authorizedRosterSelection(data, {
      ...ctx,
      session: DEMO_IDS.correctSession,
    }),
    false,
  );
  assert.equal(
    authorizedRosterSelection(data, {
      ...ctx,
      session: DEMO_IDS.supportedSession,
      attempt: DEMO_IDS.correctRoot,
    }),
    false,
  );
  assert.equal(
    authorizedRosterSelection(data, {
      ...ctx,
      evaluation: fixture.sessions[0].evaluations[0].id,
    }),
    false,
  );
  assert.equal(
    authorizedRosterSelection(
      { ...data, class_id: DEMO_IDS.assignmentId },
      ctx,
    ),
    false,
  );
});

test("current accepted identity wins over later failed retry; historical accepted is never substituted", () => {
  const evidence = structuredClone(fixture.sessions[1]);
  const attempt = evidence.attempts[0];
  const accepted = evidence.evaluations[0];
  evidence.evaluations.push({
    ...accepted,
    id: "61000000-0000-4000-8000-000000000099",
    validation_status: "evaluation_failed",
    result: null,
    applied_result: null,
    evaluated_at: "2026-10-24T12:00:00Z",
  });
  assert.equal(
    evaluationFor(evidence, attempt)?.id,
    attempt.current_evaluation_id,
  );
  attempt.current_evaluation_id = null;
  assert.equal(
    responseMark(evidence, attempt, attempt.question.concept_ids[0]).state,
    "failed",
  );
  evidence.evaluations.pop();
  assert.equal(
    responseMark(evidence, attempt, attempt.question.concept_ids[0]).state,
    "pending",
  );
});

test("all sessions remain in a student log; a newer empty session cannot replace original work", () => {
  const selected = studentSessions(data, DEMO_IDS.studentOne);
  const empty = structuredClone(selected[0]);
  empty.session = {
    ...empty.session,
    id: "40000000-0000-4000-8000-000000000099",
    started_at: "2026-10-24T12:00:00Z",
  };
  empty.attempts = [];
  empty.evaluations = [];
  empty.interventions = [];
  const sessions = studentSessions(
    { ...data, evidence: [...data.evidence, empty] },
    DEMO_IDS.studentOne,
  );
  assert.equal(sessions.length, selected.length + 1);
  assert.equal(
    conceptTrail(sessions, "transmission_delay").length,
    conceptTrail(selected, "transmission_delay").length,
  );
  assert.equal(participation(sessions), "submitted");
  assert.equal(participation([empty]), "opened");
  assert.equal(participation([]), "missing");
});

test("display chronology uses visible timestamps and submission links, excluding unshown or later help", () => {
  const evidence = structuredClone(fixture.sessions[0]);
  const attempt = evidence.attempts.find(
    (a) => a.assistance?.intervention_ids.length,
  )!;
  assert.ok(attempt);
  const before = JSON.stringify(attempt);
  assert.ok(linkedAssistance(evidence, attempt).every((x) => x.record));
  const help = evidence.interventions.find((h) =>
    attempt.assistance!.intervention_ids.includes(h.id),
  )!;
  help.visible_at = "2026-10-25T12:00:00Z";
  assert.equal(
    linkedAssistance(evidence, attempt).find((x) => x.id === help.id)?.record,
    undefined,
  );
  help.delivery_status = "created";
  help.visible_at = null;
  assert.ok(
    workEvents(evidence).every(
      (e) => e.kind !== "help" || e.help.id !== help.id,
    ),
  );
  assert.equal(JSON.stringify(attempt), before);
});

test("markers preserve missing, uncertainty, pending and assistance distinctions per concept", () => {
  const all = data.evidence.flatMap((e) => e.attempts.map((a) => ({ e, a })));
  assert.ok(
    all.some(({ e, a }) =>
      a.question.concept_ids.some(
        (c) => responseMark(e, a, c).state === "uncertain",
      ),
    ),
  );
  assert.ok(
    all.some(({ e, a }) =>
      a.question.concept_ids.some((c) => responseMark(e, a, c).help === "help"),
    ),
  );
  assert.ok(
    all.some(({ e, a }) =>
      a.question.concept_ids.some(
        (c) => responseMark(e, a, c).state === "pending",
      ),
    ),
  );
  const { e, a } = all[0];
  const empty = {
    ...a,
    submitted_at: null,
    response_text: null,
    assistance: null,
    current_evaluation_id: null,
  };
  assert.equal(
    responseMark(e, empty, a.question.concept_ids[0]).state,
    "missing",
  );
});

test("only explicit approval and matching delivery recipients produce delivered indicators", () => {
  // Minimal structural test inputs: the real loader validates complete snapshots.
  const review = {
    draft: {
      id: "draft",
      status: "approved",
      evidence: { observations: [{ student_id: "evidence-only" }] },
    },
    approval: { id: "approval", recipient_ids: ["recipient"] },
    delivery: null,
  } as unknown as InterventionReview;
  assert.equal(
    studentInterventions([review], "recipient")[0].status,
    "Approved · not delivered",
  );
  review.delivery = {
    id: "delivery",
    approval_id: "approval",
    delivered_by: "teacher",
    delivered_at: "2026-10-25T12:00:00Z",
    recipient_ids: ["recipient"],
  };
  assert.equal(
    studentInterventions([review], "recipient")[0].status,
    "Delivered",
  );
  assert.equal(
    studentInterventions([review], "evidence-only")[0].status,
    "Evidence only · not a recipient",
  );
  review.delivery.approval_id = "other";
  assert.equal(
    studentInterventions([review], "recipient")[0].status,
    "Approved · not delivered",
  );
});

test("bounded outgoing links preserve roster context and exact identities, never arbitrary return URLs", () => {
  const context = parseRosterContext({
    ...ctx,
    q: "Maya",
    participation: "submitted",
    rosterPane: "main",
    concept: "transmission_delay",
  });
  const url = new URL(
    rosterSessionHref(
      context,
      DEMO_IDS.supportedSession,
      DEMO_IDS.supportedRoot,
    ),
    "https://test.local",
  );
  assert.equal(url.searchParams.get("returnTo"), "students");
  assert.equal(url.searchParams.get("participation"), "submitted");
  assert.equal(url.searchParams.get("q"), "Maya");
  assert.equal(url.searchParams.get("student"), DEMO_IDS.studentOne);
  assert.equal(url.hash, `#attempt-${DEMO_IDS.supportedRoot}`);
  const roster = new URL(
    rosterHref(context, {}, `roster-attempt-${DEMO_IDS.supportedRoot}`),
    "https://test.local",
  );
  assert.equal(roster.searchParams.get("workspacePane"), "main");
  assert.throws(() => parseRosterContext({ student: "not-an-id" }));
  assert.throws(() => parseRosterContext({ q: "x".repeat(121) }));
  assert.throws(() =>
    parseRosterContext({ participation: ["all", "missing"] }),
  );
  assert.throws(() =>
    parseRosterContext({ rosterPane: "https://elsewhere.test" }),
  );
});
