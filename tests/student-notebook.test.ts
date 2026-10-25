import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { buildDemoFixture } from "../lib/evidence/demo.ts";
import {
  SessionEvidenceSchema,
  type SessionEvidence,
  type Intervention,
} from "../lib/evidence/contracts.ts";
import {
  OperationSchema,
  type DialogueOperation,
} from "../lib/dialogue/persistence.ts";
import {
  NotebookError,
  notebookTime,
  projectStudentNotebook,
  type NotebookInput,
  type NotebookAudit,
} from "../lib/evidence/student-notebook-project.ts";
import {
  StudentNotebookSchema,
  NOTEBOOK_LIMITS,
} from "../lib/evidence/student-notebook-contracts.ts";

function fixture(multiple = false) {
  const content = loadApprovedContent();
  const evidence = structuredClone(
    buildDemoFixture(content).sessions[multiple ? 0 : 1],
  );
  const input: Omit<NotebookInput, "evidence" | "operations" | "audit"> & {
    evidence: SessionEvidence;
    operations: DialogueOperation[];
    audit: NotebookAudit[];
  } = {
    actorId: evidence.session.student_id,
    evidence,
    content,
    lesson: {
      id: "network-performance-v1",
      version: "1",
      title: "Synthetic lesson",
    },
    operations: [],
    audit: [],
    readAt: "2026-10-25T12:00:00Z",
    relations: {
      links: new Map(),
      reviews: new Map(),
      followup: null,
      pendingEvaluationAttempts: new Set(),
    },
  };
  return input;
}
function message(f: ReturnType<typeof fixture>, text = "Please explain this.") {
  const a = f.evidence.attempts[0];
  const request_id = randomUUID();
  const op = OperationSchema.parse({
    request_id,
    session_id: a.session_id,
    attempt_id: a.id,
    actor_id: f.actorId,
    expected_revision: 0,
    lesson: {
      session_id: a.session_id,
      assignment_id: f.evidence.session.assignment_id,
      attempt_id: a.id,
      root_attempt_id: a.root_attempt_id,
      sequence_index: a.sequence_index,
      content_ref: a.question.content_ref,
    },
    payload: {
      version: "r7-conversation-v1",
      action: "send_message",
      request_id,
      session_id: a.session_id,
      attempt_id: a.id,
      expected_revision: 0,
      text,
    },
    message_request_id: null,
    status: "pending",
    proposed_intent: null,
    authorized_route: null,
    message: {
      request_id,
      attempt_id: a.id,
      expected_revision: 0,
      text,
      classification: null,
      outcome: { status: "pending" },
    },
    dialogue_request: null,
    intervention_id: null,
    created_at: a.presented_at,
  });
  f.operations.push(op);
  return op;
}
function audit(
  f: ReturnType<typeof fixture>,
  op: DialogueOperation,
  kind: string,
  payload: NotebookAudit["payload"],
) {
  const event: NotebookAudit = {
    sequence: String(BigInt("9007199254740992") + BigInt(f.audit.length)),
    event_id: randomUUID(),
    request_id: op.request_id,
    kind,
    payload,
    at: op.created_at,
  };
  f.audit.push(event);
  return event;
}
function help(f: ReturnType<typeof fixture>, displayed: boolean) {
  const a = f.evidence.attempts[0];
  const op = message(f);
  const content_id = randomUUID();
  const aid: Intervention = {
    id: randomUUID(),
    session_id: a.session_id,
    related_attempt_id: a.id,
    related_evaluation_id: null,
    type: "hint",
    text_shown: "Only acknowledged help may appear.",
    concept_ids: a.question.concept_ids,
    source_passage_ids: a.question.source_passage_ids,
    content_ref: a.question.content_ref,
    created_at: op.created_at,
    visible_at: displayed ? op.created_at : null,
    delivery_status: displayed ? "displayed" : "created",
  };
  f.evidence.interventions.push(aid);
  op.intervention_id = aid.id;
  op.dialogue_request = {
    version: "r7-v1",
    request_id: op.request_id,
    session_id: op.session_id,
    expected_revision: 0,
    lesson: op.lesson,
    requested_at: op.created_at,
    retry: null,
    trigger: {
      kind: "student",
      action: {
        version: "r7-v1",
        action: "ask_tutor",
        request_id: op.request_id,
        session_id: op.session_id,
        attempt_id: op.attempt_id,
        expected_revision: 0,
        purpose: "question",
        text: op.message!.text,
      },
    },
  };
  const b = { version: "r7-v1", request_id: op.request_id, at: op.created_at };
  audit(f, op, "dialogue", {
    ...b,
    event_id: randomUUID(),
    outcome: "requested",
  });
  audit(f, op, "dialogue", {
    ...b,
    event_id: randomUUID(),
    outcome: "generated",
    content: {
      kind: "help",
      content_id,
      text: aid.text_shown,
      assistance_type: aid.type,
      content_ref: aid.content_ref,
      concept_ids: aid.concept_ids,
      source_passage_ids: aid.source_passage_ids,
      generation: {
        model: "disabled-fixture",
        prompt_template_version: "PRIVATE_PROMPT",
        generated_at: op.created_at,
      },
    },
  });
  audit(f, op, "dialogue", {
    ...b,
    event_id: randomUUID(),
    outcome: "accepted",
    content_id,
    applied_attempt_id: null,
    applied_revision: 0,
  });
  if (displayed)
    audit(f, op, "dialogue", {
      ...b,
      event_id: randomUUID(),
      outcome: "displayed",
      content_id,
      intervention_id: aid.id,
      assessed_attempt_id: null,
    });
  return { op, aid };
}

test("D1-01/02: immutable attempt identities survive duplicate answer text; only exact submission identity links a message", () => {
  const f = fixture();
  const a = f.evidence.attempts[0];
  const next = structuredClone(a);
  Object.assign(next, {
    id: randomUUID(),
    parent_attempt_id: a.id,
    sequence_index: 1,
    submission_key: randomUUID(),
    current_evaluation_id: null,
    outcome: null,
  });
  f.evidence.attempts.push(next);
  const op = message(f, a.response_text!);
  let view = projectStudentNotebook(f);
  assert.equal(view.pages.length, 2);
  assert.notEqual(
    view.pages[0].submission?.answer_id,
    view.pages[1].submission?.answer_id,
  );
  assert.equal(view.pages[0].submission?.message_request_id, null);
  a.submission_key = op.request_id;
  op.message!.outcome = { status: "answer", submission_key: op.request_id };
  view = projectStudentNotebook(f);
  assert.equal(view.pages[0].submission?.message_request_id, op.request_id);
  assert.equal(
    view.pages[0].events.find((e) => e.kind === "student_message")?.content
      .kind,
    "submitted_answer_reference",
  );
  assert.equal(view.pages[1].submission?.message_request_id, null);
});

test("D1-03: clarification and cancellation require explicit audit records, with no invented wording", () => {
  const f = fixture();
  const op = message(f);
  op.message!.outcome = { status: "clarification" };
  let view = projectStudentNotebook(f);
  assert.ok(
    !view.pages[0].events.some(
      (e) => e.kind === "intent_clarification_requested",
    ),
  );
  audit(f, op, "intent_review", {
    authorized_route: "clarify",
    proposal: { rationale: "PRIVATE_INTENT" },
  });
  const cancellation = {
    ...op,
    request_id: randomUUID(),
    message: null,
    message_request_id: op.request_id,
  };
  cancellation.payload = {
    version: "r7-conversation-v1",
    action: "cancel_message",
    request_id: cancellation.request_id,
    session_id: op.session_id,
    attempt_id: op.attempt_id,
    expected_revision: 0,
    message_request_id: op.request_id,
  };
  f.operations.push(cancellation);
  audit(f, op, "cancelled", {
    cancellation_request_id: cancellation.request_id,
  });
  view = projectStudentNotebook(f);
  assert.equal(
    view.pages[0].events.filter(
      (e) => e.kind === "intent_clarification_requested",
    ).length,
    1,
  );
  assert.equal(
    view.pages[0].events.filter((e) => e.kind === "message_cancelled").length,
    1,
  );
  assert.ok(!JSON.stringify(view).includes("PRIVATE_INTENT"));
});

test("D1-04/05: accepted help remains hidden until its own validated display chain agrees with the intervention", () => {
  const f = fixture();
  const { aid } = help(f, false);
  assert.ok(
    !JSON.stringify(projectStudentNotebook(f)).includes(aid.text_shown),
  );
  aid.visible_at = aid.created_at;
  aid.delivery_status = "displayed";
  assert.equal(
    projectStudentNotebook(f).pages[0].pending_deliveries[0].state,
    "display_unconfirmed",
  );
  const good = fixture();
  const shown = help(good, true);
  assert.ok(
    JSON.stringify(projectStudentNotebook(good)).includes(shown.aid.text_shown),
  );
  good.audit.at(-1)!.payload.intervention_id = randomUUID();
  assert.ok(
    !JSON.stringify(projectStudentNotebook(good)).includes(
      shown.aid.text_shown,
    ),
  );
});

test("D1-06: later display does not rewrite assistance; sub-millisecond future assistance is rejected", () => {
  const f = fixture();
  const a = f.evidence.attempts[0];
  const saved = structuredClone(a.assistance);
  const { aid } = help(f, true);
  aid.visible_at =
    new Date(Date.parse(a.submitted_at!)).toISOString().slice(0, -1) + "001Z";
  f.audit.at(-1)!.payload.at = aid.visible_at;
  const view = projectStudentNotebook(f);
  assert.deepEqual(view.pages[0].submission?.assistance_at_submission, saved);
  assert.equal(
    view.pages[0].events.find((e) => e.kind === "help_displayed")?.aid
      .counted_at_submission,
    false,
  );
  a.assistance!.intervention_ids.push(aid.id);
  assert.throws(() => projectStudentNotebook(f), NotebookError);
  assert.equal(
    notebookTime("2026-10-25T12:00:00.000002Z") -
      notebookTime("2026-10-25T12:00:00.000001Z"),
    BigInt(1),
  );
});

test("D1-07/08: accepted pointer survives later failure; only explicit supersession is accepted history", () => {
  const f = fixture();
  const first = f.evidence.evaluations[0];
  const correction = structuredClone(first);
  Object.assign(correction, {
    id: randomUUID(),
    supersedes_id: first.id,
    applied_result: null,
  });
  correction.result!.uncertainty_reason = "PRIVATE_UNCERTAINTY";
  f.evidence.evaluations.push(correction);
  f.evidence.attempts[0].current_evaluation_id = correction.id;
  f.evidence.evaluations.push({
    ...correction,
    id: randomUUID(),
    supersedes_id: null,
    validation_status: "evaluation_failed",
    result: null,
    failure_reason: "PRIVATE_FAILURE",
  });
  const view = projectStudentNotebook(f);
  assert.deepEqual(view.pages[0].assessment, {
    status: "accepted",
    current_evaluation_id: correction.id,
  });
  assert.equal(
    view.pages[0].events.filter((e) => e.kind === "assessment_recorded").length,
    2,
  );
  assert.ok(
    view.pages[0].events.some(
      (e) =>
        e.kind === "assessment_recorded" &&
        e.assessment.is_current &&
        e.assessment.uncertainty_recorded,
    ),
  );
  assert.ok(!JSON.stringify(view).includes("PRIVATE_"));
  f.evidence.attempts[0].current_evaluation_id = null;
  assert.equal(
    projectStudentNotebook(f).pages[0].assessment.status,
    "unavailable",
  );
});

test("D1-09: exact Unicode/whitespace and empty submissions differ from no saved answer", () => {
  const f = fixture();
  const a = f.evidence.attempts[0];
  f.evidence.evaluations = [];
  a.current_evaluation_id = null;
  for (const value of ["  π🙂\r\n\tanswer  ", ""]) {
    a.response_text = value;
    assert.equal(
      projectStudentNotebook(f).pages[0].submission?.response_text,
      value,
    );
  }
  Object.assign(a, {
    submitted_at: null,
    response_text: null,
    submission_key: null,
    assistance: null,
  });
  const view = projectStudentNotebook(f);
  assert.equal(view.pages[0].submission, null);
  assert.equal(view.pages[0].assessment.status, "not_submitted");
});

test("D1-10: exact timestamps, offsets, stable ties and audit bigint sequences", () => {
  const f = fixture();
  const op = message(f);
  audit(f, op, "service_unavailable", { reason: "PRIVATE_PROVIDER" });
  const view = projectStudentNotebook(f);
  assert.ok(view.pages[0].events.some((e) => e.order_basis === "stable_tie"));
  assert.equal(
    notebookTime("2026-10-25T08:00:00.123456-04:00"),
    notebookTime("2026-10-25T12:00:00.123456Z"),
  );
  assert.deepEqual(
    projectStudentNotebook({ ...f, audit: [...f.audit].reverse() }).pages,
    view.pages,
  );
});

test("D1-11/12: whole-attempt paging, exact selector, stable hash and stale/tampered/foreign cursors", () => {
  const f = fixture(true);
  const first = projectStudentNotebook(f, { limit: 1 });
  const destination = `/study/assignments/${f.evidence.session.assignment_id}?tab=study&session=${f.evidence.session.id}`;
  assert.equal(first.session.resume_href, destination);
  assert.equal(first.paging.next?.href, destination);
  assert.ok(first.paging.next_cursor);
  const second = projectStudentNotebook(f, {
    cursor: first.paging.next_cursor,
    limit: 1,
  });
  assert.equal(second.pages[0].attempt_id, f.evidence.attempts[1].id);
  assert.equal(
    projectStudentNotebook({ ...f, readAt: "2026-10-25T13:00:00Z" }).snapshot
      .id,
    first.snapshot.id,
  );
  assert.equal(
    projectStudentNotebook(f, { attempt_id: f.evidence.attempts[2].id }).pages
      .length,
    1,
  );
  message(f);
  assert.throws(
    () => projectStudentNotebook(f, { cursor: first.paging.next_cursor }),
    (e: unknown) => e instanceof NotebookError && e.code === "SNAPSHOT_CHANGED",
  );
  assert.throws(
    () => projectStudentNotebook(f, { cursor: "{}" }),
    (e: unknown) => e instanceof NotebookError && e.code === "INVALID_CURSOR",
  );
  assert.throws(
    () =>
      projectStudentNotebook(fixture(), { cursor: first.paging.next_cursor }),
    NotebookError,
  );
  assert.throws(() => projectStudentNotebook(f, { attempt_id: randomUUID() }));
});

test("D1-12: limits reject incomplete chronologies instead of dropping events or attempts", () => {
  const f = fixture();
  for (let i = 0; i < NOTEBOOK_LIMITS.events_per_attempt; i++) message(f);
  assert.throws(
    () => projectStudentNotebook(f),
    (e: unknown) => e instanceof NotebookError && e.code === "NOTEBOOK_LIMIT",
  );
  assert.throws(() => projectStudentNotebook(fixture(), { limit: 26 }));
});

test("D1-13/14: wrong source/actor/operation cannot be projected", () => {
  const f = fixture();
  assert.throws(
    () => projectStudentNotebook({ ...f, actorId: randomUUID() }),
    NotebookError,
  );
  const op = message(f);
  op.actor_id = randomUUID();
  assert.throws(() => projectStudentNotebook(f), NotebookError);
  f.operations = [];
  f.evidence.attempts[0].question.content_ref.content_version =
    "missing-historical-version";
  assert.throws(() => projectStudentNotebook(f));
});

test("D1-16: saved review display may predate fresh-check session; no completion is invented", () => {
  const f = fixture();
  const a = f.evidence.attempts[0];
  const approvalId = randomUUID();
  f.relations.followup = {
    approval_id: approvalId,
    attempt_id: a.id,
    displayed_at: "2020-01-01T00:00:00Z",
  };
  f.evidence.interventions.push({
    id: randomUUID(),
    session_id: a.session_id,
    related_attempt_id: a.id,
    related_evaluation_id: null,
    type: "corrective_feedback",
    text_shown: "Displayed review",
    concept_ids: a.question.concept_ids,
    source_passage_ids: a.question.source_passage_ids,
    content_ref: a.question.content_ref,
    created_at: "2020-01-01T00:00:00Z",
    visible_at: "2020-01-01T00:00:00Z",
    delivery_status: "displayed",
  });
  const view = projectStudentNotebook(f);
  assert.equal(view.session.resume_href, `/study/interventions/${approvalId}`);
  assert.equal(view.pages[0].events[0].kind, "help_displayed");
  assert.ok(!("completed" in view.pages[0].teacher_reviews));
});

test("D1-17/18: projection is pure and strictly excludes private evidence and undisplayed content", () => {
  const f = fixture(true);
  const before = JSON.stringify(f.evidence);
  const view = projectStudentNotebook(f);
  assert.equal(JSON.stringify(f.evidence), before);
  assert.deepEqual(projectStudentNotebook(f), view);
  const serialized = JSON.stringify(view);
  for (const key of [
    "rubric",
    "answer_guidance",
    "hypothesis",
    "reasoning_observed",
    "generation",
    "evaluator",
    "failure_reason",
    "teacher_id",
  ])
    assert.ok(!serialized.includes(`"${key}"`), key);
  assert.throws(() =>
    StudentNotebookSchema.parse({ ...view, private_output: "secret" }),
  );
  assert.throws(() =>
    StudentNotebookSchema.parse({
      ...view,
      pages: [{ ...view.pages[0], rubric: "secret" }],
    }),
  );
});

test("D1-03/08: interrupted reservations stay unknown and orphan accepted records never become authoritative", () => {
  const f = fixture();
  const a = f.evidence.attempts[0];
  a.current_evaluation_id = null;
  const evaluation = f.evidence.evaluations[0];
  Object.assign(evaluation, {
    validation_status: "pending_review",
    result: null,
    applied_result: null,
  });
  SessionEvidenceSchema.parse(f.evidence);
  assert.deepEqual(projectStudentNotebook(f).pages[0].assessment, {
    status: "pending",
    outcome: "unknown",
  });
  f.evidence.evaluations = [];
  f.relations.pendingEvaluationAttempts.add(a.id);
  assert.equal(projectStudentNotebook(f).pages[0].assessment.status, "pending");
  const op = message(f);
  const unknown = projectStudentNotebook({
    ...f,
    providerCalls: [{ request_id: op.request_id, status: "unknown" }],
  });
  assert.equal(unknown.pages[0].messages[0].execution, "outcome_unknown");
  assert.equal(
    projectStudentNotebook({
      ...f,
      providerCalls: [{ request_id: op.request_id, status: "reserved" }],
    }).pages[0].messages[0].execution,
    "pending",
  );
  assert.ok(
    !unknown.pages[0].events.some(
      (event) => event.kind === "message_unavailable",
    ),
  );
});
