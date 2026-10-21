import assert from "node:assert/strict";
import test from "node:test";
import {
  loadApprovedContent,
  validateQuestionSnapshot,
} from "../lib/evidence/content.ts";
import { deriveAssistance } from "../lib/evidence/rules.ts";
import { makeDialogueExamples } from "../lib/dialogue/examples.ts";
import {
  DIALOGUE_LIMITS,
  DIALOGUE_VERSION,
  DialogueHistorySchema,
  DialogueRequestSchema,
  DisplayDialogueSchema,
  GeneratedDialogueSchema,
  StudentActionSchema,
  StudentQuestionSchema,
  type DialogueEvent,
  type DialogueRequest,
  type DialogueState,
  type GeneratedDialogue,
} from "../lib/dialogue/contracts.ts";
import {
  appendDialogueEvent,
  assertProviderAttemptAllowed,
  dialogueFallback,
  dialogueIntervention,
  restoreLessonDraft,
  toStudentDialogueContent,
  validateDialogueEvents,
  validateDialogueRetry,
  validateGeneratedDialogue,
  validateStudentAction,
} from "../lib/dialogue/rules.ts";

const content = loadApprovedContent();
const f = makeDialogueExamples(content);
const id = (n: number) =>
  `72000000-0000-4000-9000-${String(n).padStart(12, "0")}`;
const at = (seconds: number) =>
  new Date(Date.parse("2026-10-21T12:00:00Z") + seconds * 1_000).toISOString();
const acceptance = { content, scope: f.scope, review: f.review };
function reserved(request = f.studentRequest): DialogueState {
  return { ...f.state, active_request_id: request.request_id, turns_used: 1 };
}
function event(
  request: DialogueRequest,
  n: number,
): Pick<DialogueEvent, "version" | "event_id" | "request_id" | "at"> {
  return {
    version: DIALOGUE_VERSION,
    event_id: id(n),
    request_id: request.request_id,
    at: new Date(Date.parse(request.requested_at) + n * 1_000).toISOString(),
  };
}
function generated(
  request = f.studentRequest,
  candidate = f.help,
  state = reserved(request),
) {
  let events = appendDialogueEvent(
    request,
    [],
    { ...event(request, 1), outcome: "requested" },
    state,
  );
  events = appendDialogueEvent(
    request,
    events,
    { ...event(request, 2), outcome: "generated", content: candidate },
    state,
  );
  return events;
}
function acceptedHelp() {
  return appendDialogueEvent(
    f.studentRequest,
    generated(),
    {
      ...event(f.studentRequest, 3),
      outcome: "accepted",
      content_id: f.help.content_id,
      applied_attempt_id: null,
      applied_revision: 0,
    },
    reserved(),
    acceptance,
  );
}

test("asking and returning preserve the unanswered activity and draft; only explicit submit delegates an answer", () => {
  const before = structuredClone(f);
  for (const action of Object.values(f.asks)) {
    const plan = validateStudentAction(action, f.state);
    assert.equal(plan.kind, "ask_tutor");
    assert.equal("answer" in plan, false);
    assert.equal(restoreLessonDraft(f.draft, f.state), f.draft.text);
  }
  const pending = reserved();
  assert.deepEqual(validateStudentAction(f.returnToLesson, pending), {
    kind: "return_to_lesson",
    cancel_request_id: f.studentRequest.request_id,
  });
  const submit = validateStudentAction(f.submit, pending);
  assert.equal(submit.kind, "submit_answer");
  assert.equal(f.submit.action, "submit_answer");
  if (submit.kind === "submit_answer" && f.submit.action === "submit_answer") {
    assert.deepEqual(submit.answer, f.submit.answer);
    assert.equal(
      submit.cancel_request_id,
      f.studentRequest.request_id,
      "An unsettled help call cannot block the core lesson",
    );
  }
  assert.deepEqual(f, before);
  assert.equal(f.unansweredAttempt.response_text, null);
  assert.deepEqual(
    validateQuestionSnapshot(content, f.curatedQuestion),
    f.curatedQuestion,
  );
});

test("strict actions reject inferred intent, private fields, stale/cross-session requests and overlapping asks", () => {
  for (const action of [
    f.invalid.unsupportedAction,
    f.invalid.unsupportedVersion,
    f.invalid.privateActionField,
    { ...f.asks.question, action: undefined },
  ])
    assert.equal(StudentActionSchema.safeParse(action).success, false);
  assert.throws(
    () => validateStudentAction(f.invalid.staleAction, f.state),
    /Stale/,
  );
  assert.throws(
    () =>
      validateStudentAction(
        { ...f.asks.question, session_id: id(90) },
        f.state,
      ),
    /session/,
  );
  assert.throws(
    () =>
      validateStudentAction(
        { ...f.asks.question, attempt_id: id(90) },
        f.state,
      ),
    /attempt/,
  );
  assert.throws(
    () => validateStudentAction(f.asks.example, reserved()),
    /active/,
  );
  assert.throws(
    () =>
      restoreLessonDraft(
        { ...f.draft, lesson: { ...f.draft.lesson, attempt_id: id(90) } },
        f.state,
      ),
    /different/,
  );
  assert.equal(
    validateStudentAction(
      f.asks.question,
      { ...f.state, revision: 2 },
      f.asks.question,
    ).kind,
    "replay",
  );
  assert.throws(
    () =>
      validateStudentAction(f.invalid.reusedRequest, f.state, f.asks.question),
    /reused/,
  );
});

test("two distinct generated diagnostic fixtures reuse question snapshots without inventing misconception categories", () => {
  for (const name of ["distance", "packetSize"] as const) {
    const candidate = validateGeneratedDialogue(
      content,
      f.scope,
      f.controllerRequests[name],
      f.diagnostics[name],
      f.review,
    );
    assert.equal(candidate.kind, "question");
    if (candidate.kind === "question")
      assert.deepEqual(
        validateQuestionSnapshot(content, candidate.question),
        candidate.question,
      );
  }
  assert.notDeepEqual(f.diagnostics.distance, f.diagnostics.packetSize);
  assert.throws(
    () =>
      validateGeneratedDialogue(
        content,
        f.scope,
        f.studentRequest,
        f.diagnostics.distance,
        f.review,
      ),
    /ask cannot/,
  );
  assert.throws(
    () =>
      validateGeneratedDialogue(
        content,
        f.scope,
        f.controllerRequests.distance,
        {
          ...f.diagnostics.distance,
          target_misconception_ids: ["invented_belief"],
        },
        f.review,
      ),
    /misconception/,
  );
});

test("grounding requires exact versions, scoped citations and independent server permission", () => {
  for (const candidate of [
    f.invalid.invalidCitation,
    f.invalid.mismatchedSource,
    { ...f.help, source_passage_ids: [] },
    {
      ...f.help,
      content_ref: { ...content.content_ref, excerpt_sha256: "0".repeat(64) },
    },
  ])
    assert.throws(() =>
      validateGeneratedDialogue(
        content,
        f.scope,
        f.studentRequest,
        candidate,
        f.review,
      ),
    );
  assert.throws(
    () =>
      validateGeneratedDialogue(
        content,
        { ...f.scope, passage_ids: new Set() },
        f.studentRequest,
        f.help,
        f.review,
      ),
    /scope/,
  );
  for (const review of [
    { ...f.review, grounding: "uncertain" as const },
    { ...f.review, disclosure: "private_guidance" as const },
    { ...f.review, permitted_by_controller: false },
  ])
    assert.throws(
      () =>
        validateGeneratedDialogue(
          content,
          f.scope,
          f.studentRequest,
          f.help,
          review,
        ),
      /server/,
    );
});

test("generated help is hidden until accepted, and only actual display counts as assistance", () => {
  const request = f.studentRequest;
  assert.equal(toStudentDialogueContent(request, generated()), null);
  const accepted = acceptedHelp();
  const created = dialogueIntervention(request, accepted, id(40));
  assert.equal(
    deriveAssistance(f.curatedQuestion, "initial_retrieval", at(0), at(20), [
      created,
    ]).assistance_level,
    "none_recorded",
  );
  const display: DialogueEvent = {
    ...event(request, 4),
    outcome: "displayed",
    content_id: f.help.content_id,
    intervention_id: id(40),
    assessed_attempt_id: null,
  };
  const displayed = appendDialogueEvent(request, accepted, display, reserved());
  const intervention = dialogueIntervention(request, displayed, id(40));
  assert.equal(intervention.delivery_status, "displayed");
  assert.equal(intervention.visible_at, at(4));
  assert.equal(
    deriveAssistance(f.curatedQuestion, "initial_retrieval", at(0), at(20), [
      intervention,
    ]).assistance_level,
    "hint",
  );
  assert.equal(
    deriveAssistance(f.curatedQuestion, "initial_retrieval", at(0), at(3), [
      intervention,
    ]).assistance_level,
    "none_recorded",
    "Later help cannot change earlier response assistance",
  );
  assert.deepEqual(
    appendDialogueEvent(request, displayed, display, {
      ...reserved(),
      revision: 3,
    }),
    displayed,
  );
  assert.deepEqual(
    appendDialogueEvent(
      request,
      displayed,
      { ...display, event_id: id(41), at: at(30) },
      reserved(),
    ),
    displayed,
  );
  assert.throws(
    () =>
      appendDialogueEvent(request, accepted, display, {
        ...reserved(),
        revision: 1,
      }),
    /Stale/,
  );
  assert.throws(
    () =>
      appendDialogueEvent(
        request,
        displayed,
        { ...display, intervention_id: id(42) },
        reserved(),
      ),
    /reused/,
  );
});

test("generated diagnostics require reviewed controller acceptance and a new authorized attempt before display", () => {
  const request = f.controllerRequests.distance;
  const candidate = f.diagnostics.distance;
  const state = {
    ...reserved(request),
    progress: { ...f.state.progress, phase: "evaluate" as const },
  };
  const history = generated(request, candidate, state);
  const accept: DialogueEvent = {
    ...event(request, 3),
    outcome: "accepted",
    content_id: candidate.content_id,
    applied_attempt_id: id(50),
    applied_revision: 1,
  };
  assert.throws(
    () => appendDialogueEvent(request, history, accept, state),
    /review/,
  );
  assert.throws(
    () =>
      appendDialogueEvent(
        request,
        history,
        accept,
        reserved(request),
        acceptance,
      ),
    /evaluated/,
  );
  assert.throws(
    () =>
      appendDialogueEvent(
        request,
        history,
        { ...accept, applied_attempt_id: request.lesson.attempt_id },
        state,
        acceptance,
      ),
    /handoff/,
  );
  const accepted = appendDialogueEvent(
    request,
    history,
    accept,
    state,
    acceptance,
  );
  const current = {
    ...state,
    revision: 1,
    lesson: { ...state.lesson, attempt_id: id(50), sequence_index: 1 },
    progress: {
      ...state.progress,
      phase: "answer" as const,
      current_attempt_id: id(50),
    },
  };
  const display: DialogueEvent = {
    ...event(request, 4),
    outcome: "displayed",
    content_id: candidate.content_id,
    intervention_id: null,
    assessed_attempt_id: id(50),
  };
  assert.throws(
    () => appendDialogueEvent(request, accepted, display, state),
    /Stale/,
  );
  const displayed = appendDialogueEvent(request, accepted, display, current);
  const student = toStudentDialogueContent(request, displayed);
  assert.equal(student?.kind, "question");
  assert.ok(student?.kind === "question");
  assert.deepEqual(
    Object.keys(student.question).sort(),
    [
      "question_id",
      "prompt_text",
      "concept_ids",
      "source_passage_ids",
      "content_ref",
    ].sort(),
  );
  assert.equal(JSON.stringify(student).includes("answer_guidance"), false);
  assert.equal(
    JSON.stringify(student).includes("target_misconception_ids"),
    false,
  );
  assert.equal(
    StudentQuestionSchema.safeParse(f.invalid.studentQuestionWithRubric)
      .success,
    false,
  );
});

test("cancelled/stale completions cannot apply and late failure bookkeeping preserves the original request", () => {
  const request = f.studentRequest;
  const history = generated();
  const later = { ...reserved(), revision: 1, active_request_id: id(80) };
  const cancelled = appendDialogueEvent(
    request,
    history,
    { ...event(request, 3), outcome: "cancelled", reason: "cancelled" },
    later,
  );
  assert.equal(toStudentDialogueContent(request, cancelled), null);
  assert.throws(() =>
    appendDialogueEvent(
      request,
      cancelled,
      {
        ...event(request, 4),
        outcome: "accepted",
        content_id: f.help.content_id,
        applied_attempt_id: null,
        applied_revision: 0,
      },
      later,
      acceptance,
    ),
  );
  const failed = appendDialogueEvent(
    request,
    history,
    { ...event(request, 3), outcome: "failed", reason: "stale" },
    later,
  );
  assert.equal(failed.at(-1)?.outcome, "failed");
  assert.equal(toStudentDialogueContent(request, failed), null);
  assert.equal(
    later.active_request_id,
    id(80),
    "Bookkeeping never clears a newer reservation",
  );
  assert.throws(
    () =>
      validateDialogueEvents(request, [
        history[0],
        {
          ...event(request, 2),
          outcome: "accepted",
          content_id: f.help.content_id,
          applied_attempt_id: null,
          applied_revision: 0,
        },
      ]),
    /transition/,
  );
});

test("private-answer and off-topic requests remain asks; safe fallback never supplies grading data", () => {
  for (const ask of [f.privateGuidance, f.offTopic])
    assert.equal(validateStudentAction(ask, f.state).kind, "ask_tutor");
  for (const reason of [
    "private_guidance",
    "off_topic",
    "intent_unclear",
    "invalid_output",
  ] as const) {
    const fallback = dialogueFallback(reason);
    assert.equal(fallback.next, "return_to_lesson");
    assert.equal("question" in fallback || "rubric" in fallback, false);
  }
  assert.equal(
    validateStudentAction(f.asks.question, { ...f.state, enabled: false }).kind,
    "fallback",
  );
  assert.equal(
    validateStudentAction(f.submit, { ...f.state, enabled: false }).kind,
    "submit_answer",
  );
  assert.equal(
    DisplayDialogueSchema.safeParse({
      version: DIALOGUE_VERSION,
      request_id: id(90),
      session_id: f.state.lesson.session_id,
      expected_revision: 0,
      accepted_event_id: id(3),
      content_id: f.help.content_id,
      visible_at: at(4),
    }).success,
    false,
    "Client cannot supply display timestamps",
  );
});

test("request/history/output and session budgets are bounded without restricting the curated answer contract", () => {
  assert.equal(
    StudentActionSchema.safeParse({
      ...f.asks.question,
      text: "x".repeat(DIALOGUE_LIMITS.requestCharacters + 1),
    }).success,
    false,
  );
  assert.equal(
    DialogueHistorySchema.safeParse(
      Array.from({ length: 13 }, () => ({ role: "student", text: "why?" })),
    ).success,
    false,
  );
  assert.equal(
    DialogueHistorySchema.safeParse(
      Array.from({ length: 3 }, () => ({
        role: "tutor",
        text: "x".repeat(6_000),
      })),
    ).success,
    false,
  );
  assert.equal(
    GeneratedDialogueSchema.safeParse({ ...f.help, text: "x".repeat(6_001) })
      .success,
    false,
  );
  assert.equal(
    validateStudentAction(f.asks.question, { ...f.state, turns_used: 12 }).kind,
    "fallback",
  );
  assert.equal(
    validateStudentAction(f.asks.question, {
      ...f.state,
      provider_requests_used: 36,
    }).kind,
    "fallback",
  );
  assert.throws(
    () =>
      assertProviderAttemptAllowed(
        { ...reserved(), provider_requests_used: 36 },
        f.studentRequest,
        {
          retry_number: 0,
          previous_outcome: "none",
          previous_finished_at: null,
        },
        at(2),
      ),
    /limit/,
  );
});

test("explicit retries are linked and bounded; failed/unknown requests cannot silently regenerate", () => {
  const request = f.studentRequest;
  assertProviderAttemptAllowed(
    reserved(),
    request,
    { retry_number: 0, previous_outcome: "none", previous_finished_at: null },
    at(1),
  );
  const failure = appendDialogueEvent(
    request,
    generated(),
    { ...event(request, 3), outcome: "failed", reason: "provider_error" },
    reserved(),
  );
  const retry = DialogueRequestSchema.parse({
    ...request,
    request_id: id(61),
    requested_at: at(70),
    retry: { of_request_id: request.request_id, number: 1 },
    trigger: {
      kind: "student",
      action: {
        ...f.asks.question,
        request_id: id(61),
        retry_of: request.request_id,
      },
    },
  });
  validateDialogueRetry(retry, request, failure, at(70));
  assert.ok(retry.trigger.kind === "student");
  assert.equal(
    validateStudentAction(retry.trigger.action, { ...f.state, turns_used: 12 })
      .kind,
    "ask_tutor",
    "A validated retry does not consume a new turn",
  );
  assert.throws(
    () =>
      assertProviderAttemptAllowed(
        reserved(retry),
        retry,
        {
          retry_number: 0,
          previous_outcome: "none",
          previous_finished_at: null,
        },
        at(70),
      ),
    /limit/,
  );
  assert.throws(
    () => validateDialogueRetry(retry, request, failure, at(10)),
    /cooldown/,
  );
  assert.throws(
    () => validateDialogueRetry(retry, request, acceptedHelp(), at(70)),
    /failed/,
  );
  assert.throws(
    () =>
      assertProviderAttemptAllowed(
        reserved(retry),
        retry,
        {
          retry_number: 1,
          previous_outcome: "unknown",
          previous_finished_at: at(3),
        },
        at(70),
      ),
    /Reconcile/,
  );
  assert.throws(
    () =>
      assertProviderAttemptAllowed(
        reserved(retry),
        retry,
        {
          retry_number: 3,
          previous_outcome: "settled_failure",
          previous_finished_at: at(3),
        },
        at(70),
      ),
    /limit/,
  );
  assertProviderAttemptAllowed(
    reserved(retry),
    retry,
    {
      retry_number: 1,
      previous_outcome: "settled_failure",
      previous_finished_at: at(3),
    },
    at(70),
  );
  const retryContent: GeneratedDialogue = { ...f.help, content_id: id(62) };
  const retryEvents = generated(retry, retryContent, reserved(retry));
  const accepted = appendDialogueEvent(
    retry,
    retryEvents,
    {
      ...event(retry, 3),
      outcome: "accepted",
      content_id: retryContent.content_id,
      applied_attempt_id: null,
      applied_revision: 0,
    },
    reserved(retry),
    acceptance,
  );
  assert.equal(accepted.at(-1)?.outcome, "accepted");
  assert.equal(failure.at(-1)?.outcome, "failed");
});
