import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { getPool, inTransaction } from "../lib/db.ts";
import { createApprovedRuntimeLesson } from "./fixtures/approved-r7-lesson.ts";
import { readAssignmentContent } from "../lib/lessons/store.ts";
import { buildDemoFixture } from "../lib/evidence/demo.ts";
import {
  getCuratedQuestion,
  loadApprovedContent,
} from "../lib/evidence/content.ts";
import {
  acknowledgeIntervention,
  evidenceAccess,
  EvidenceError,
  presentQuestion,
  readSession,
  recordEvaluation,
  recordIntervention,
  startSession,
  submitAnswer,
} from "../lib/evidence/store.ts";
import {
  acknowledgeConversation,
  actConversation,
  commitConversationHelp,
  commitConversationIntent,
  failConversationOperation,
  loadConversation,
  readTeacherConversation,
  reserveConversationOperation,
} from "../lib/dialogue/store.ts";
import {
  createReservedCall,
  readProviderCall,
  type ProviderCallDescriptor,
} from "../lib/dialogue/provider-store.ts";
import {
  CONVERSATION_VERSION,
  parseConversationView,
  type ConversationAction,
} from "../lib/dialogue/conversation.ts";
import {
  DIALOGUE_LIMITS,
  DIALOGUE_VERSION,
  DisplayDialogueSchema,
} from "../lib/dialogue/contracts.ts";
import { makeDialogueExamples } from "../lib/dialogue/examples.ts";
import { createOrchestrationPersistence } from "../lib/dialogue/orchestration-store.ts";
import {
  TutorProposalSchema,
  TutorToolResultSchema,
} from "../lib/tutoring/orchestration/contracts.ts";

// Real PostgreSQL service/transaction checks. All users, lessons and model outputs
// below are labeled synthetic fixtures. No model or authentication provider is called.
// Every run adds isolated identities and preserves its evidence; never run against
// a production database. This script deliberately does not read a .env file.
if (process.env.DIALOGUE_CHECK_SYNTHETIC !== "1") {
  throw new Error(
    "Set DIALOGUE_CHECK_SYNTHETIC=1 and explicit PG* settings for a disposable test database.",
  );
}
for (const name of ["PGHOST", "PGPORT", "PGUSER", "PGDATABASE", "PGPASSWORD"])
  assert.ok(process.env[name], `Configure ${name} explicitly.`);
const httpBase = process.env.DIALOGUE_CHECK_URL;
const httpOnly = process.argv.slice(2).includes("--http-only");
assert.ok(
  process.argv.slice(2).every((argument) => argument === "--http-only"),
  "Usage: dialogue:check [--http-only]",
);
if (httpOnly) assert.ok(httpBase, "--http-only requires DIALOGUE_CHECK_URL.");
const fixturePassword = `synthetic-only-${randomUUID()}`;
const pool = getPool();
let content = loadApprovedContent();
let examples = makeDialogueExamples(content);
let demo = buildDemoFixture(content);
const report: {
  fixture_only: true;
  database?: string;
  sessions: string[];
  checks: string[];
  error?: string;
} = {
  fixture_only: true,
  sessions: [],
  checks: [],
};
const check = (message: string) => {
  report.checks.push(message);
  console.log(`PASS: ${message}`);
};
const denied = (operation: Promise<unknown>, status = 409) =>
  assert.rejects(
    operation,
    (error: unknown) =>
      error instanceof EvidenceError && error.status === status,
  );
const actor = () =>
  evidenceAccess({
    profileId: randomUUID(),
    userId: `dialogue-fixture-${randomUUID()}`,
  });
const student = actor();
const peer = actor();
const outsider = actor();
const teacher = actor();
const otherTeacher = actor();
const classId = randomUUID();
const otherClassId = randomUUID();
const emptyClassId = randomUUID();
let assignmentId: string = randomUUID();
const otherAssignmentId = randomUUID();
const emptyAssignmentId = randomUUID();
const knownOutcome = {
  ok: true,
  needs_reconciliation: false,
  value: "synthetic provider result",
};
function descriptor(
  stepId: ProviderCallDescriptor["stage"],
): ProviderCallDescriptor {
  return {
    step_id: stepId,
    stage: stepId,
    model: "synthetic-no-provider",
    prompt_version: "dialogue-postgres-fixture-v1",
    input_hash: createHash("sha256").update(stepId).digest("hex"),
  };
}
async function seed() {
  const info = await pool.query<{ database: string; superuser: boolean }>(
    "SELECT current_database() AS database, rolsuper AS superuser FROM pg_roles WHERE rolname=current_user",
  );
  assert.equal(
    info.rows[0].superuser,
    false,
    "Run checks as the non-superuser application owner.",
  );
  report.database = info.rows[0].database;
  const migration = await pool.query(
    "SELECT name FROM schema_migrations WHERE name='008_dialogue_persistence.sql'",
  );
  assert.equal(
    migration.rowCount,
    1,
    "Apply repository migrations before checking dialogue.",
  );
  let passwordHash: string | undefined;
  if (httpBase) {
    assert.ok(
      ["127.0.0.1", "localhost"].includes(new URL(httpBase).hostname),
      "HTTP integration checks require a loopback app.",
    );
    const { hashPassword } = await import("better-auth/crypto");
    passwordHash = await hashPassword(fixturePassword);
  }
  await inTransaction(async (client) => {
    for (const [index, access] of [
      student,
      peer,
      outsider,
      teacher,
      otherTeacher,
    ].entries()) {
      await client.query(
        "INSERT INTO auth_user(id,name,email) VALUES($1,$2,$3)",
        [
          access.actor.userId,
          `Dialogue fixture ${index}`,
          `${access.actor.userId}@example.invalid`,
        ],
      );
      if (passwordHash)
        await client.query(
          `INSERT INTO auth_account(id,"accountId","providerId","userId",password) VALUES($1,$2,'credential',$2,$3)`,
          [randomUUID(), access.actor.userId, passwordHash],
        );
      await client.query(
        "INSERT INTO profiles(id,auth_user_id,display_name) VALUES($1,$2,$3)",
        [
          access.actor.profileId,
          access.actor.userId,
          `Dialogue fixture ${index}`,
        ],
      );
    }
    for (const [id, owner] of [
      [classId, teacher],
      [otherClassId, otherTeacher],
      [emptyClassId, teacher],
    ] as const)
      await client.query(
        "INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)",
        [id, owner.actor.profileId, "Synthetic dialogue integration class"],
      );
    for (const [id, member] of [
      [classId, student],
      [classId, peer],
      [otherClassId, outsider],
    ] as const)
      await client.query(
        "INSERT INTO enrollments(class_id,student_id) VALUES($1,$2)",
        [id, member.actor.profileId],
      );
    for (const [id, class_id, owner] of [
      [otherAssignmentId, otherClassId, otherTeacher],
      [emptyAssignmentId, emptyClassId, teacher],
    ] as const) {
      const assignment = {
        ...demo.assignment,
        id,
        class_id,
        title: "Synthetic dialogue integration lesson",
        teacher_approved_by: owner.actor.profileId,
        teacher_approved_at: new Date().toISOString(),
      };
      await client.query(
        "INSERT INTO assignments SELECT (jsonb_populate_record(NULL::assignments,$1::jsonb)).*",
        [JSON.stringify(assignment)],
      );
    }
  });
  ({ content, assignmentId } = await createApprovedRuntimeLesson(
    teacher,
    classId,
  ));
  examples = makeDialogueExamples(content);
  demo = buildDemoFixture(content);
}
async function newSession(access = student, assignment = assignmentId) {
  const resolved = await readAssignmentContent(access, assignment, "student");
  const session = await startSession(access, assignment, "synthetic_fixture");
  const attempt = await presentQuestion(access, session.id, {
    question: getCuratedQuestion(
      resolved,
      resolved.sequence.initial_question_id,
    ),
    intent: "initial_retrieval",
  });
  report.sessions.push(session.id);
  return { session, attempt };
}
async function message(
  sessionId: string,
  text = "  Why does distance affect propagation?\nKeep my original wording.  ",
  access = student,
): Promise<Extract<ConversationAction, { action: "send_message" }>> {
  const view = await loadConversation(access, sessionId);
  return {
    version: CONVERSATION_VERSION,
    action: "send_message",
    request_id: randomUUID(),
    session_id: sessionId,
    attempt_id: view.dialogue.state.lesson.attempt_id,
    expected_revision: view.dialogue.state.revision,
    text,
  };
}
async function cancel(
  action: Extract<ConversationAction, { action: "send_message" }>,
) {
  return reserveConversationOperation(student, {
    version: CONVERSATION_VERSION,
    action: "cancel_message",
    request_id: randomUUID(),
    session_id: action.session_id,
    attempt_id: action.attempt_id,
    expected_revision: action.expected_revision,
    message_request_id: action.request_id,
  });
}
async function help(
  action: Extract<ConversationAction, { action: "send_message" }>,
) {
  await commitConversationIntent(
    student,
    action.session_id,
    action.request_id,
    {
      category: "QUESTION_OR_HELP",
      rationale:
        "Labeled trusted classification fixture: student requested help.",
    },
    { answer_intent: "uncertain", disclosure: "safe" },
  );
  if (examples.help.kind !== "help")
    throw new Error("Expected synthetic help fixture.");
  const fixture = {
    ...examples.help,
    content_id: randomUUID(),
    generation: {
      ...examples.help.generation,
      model: "synthetic-postgres-fixture",
      generated_at: new Date().toISOString(),
    },
  };
  return commitConversationHelp(
    student,
    action.session_id,
    action.request_id,
    fixture,
    examples.review,
  );
}
function deferred<T>() {
  let release!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
async function mainFlow() {
  const { session, attempt } = await newSession();
  const before = await pool.query(
    "SELECT count(*)::integer AS count FROM dialogue_sessions WHERE session_id=$1",
    [session.id],
  );
  await loadConversation(student, session.id);
  assert.deepEqual(
    (
      await pool.query(
        "SELECT count(*)::integer AS count FROM dialogue_sessions WHERE session_id=$1",
        [session.id],
      )
    ).rows,
    before.rows,
  );
  for (const access of [
    peer,
    outsider,
    teacher,
    evidenceAccess({
      profileId: student.actor.profileId,
      userId: peer.actor.userId,
    }),
  ])
    await denied(loadConversation(access, session.id), 404);
  for (const access of [
    student,
    otherTeacher,
    evidenceAccess({
      profileId: teacher.actor.profileId,
      userId: otherTeacher.actor.userId,
    }),
  ])
    await denied(readTeacherConversation(access, session.id), 404);
  await readTeacherConversation(teacher, session.id);
  await denied(
    startSession(student, emptyAssignmentId, "synthetic_fixture"),
    404,
  );
  const foreign = await newSession(outsider, otherAssignmentId);
  await denied(readTeacherConversation(teacher, foreign.session.id), 404);
  await denied(loadConversation(student, foreign.session.id), 404);
  check(
    "Student, teacher, auth-user binding, cross-class and cross-teacher isolation",
  );

  const ask = await message(session.id);
  const claims = await Promise.all([
    reserveConversationOperation(student, ask),
    reserveConversationOperation(student, ask),
  ]);
  assert.equal(claims.filter((claim) => claim.replay).length, 1);
  await denied(
    reserveConversationOperation(student, {
      ...ask,
      text: `${ask.text} altered`,
    }),
  );
  await denied(reserveConversationOperation(peer, ask), 404);
  const pending = await loadConversation(student, session.id);
  assert.equal(pending.messages[0].text, ask.text);
  assert.equal(pending.messages[0].outcome.status, "pending");
  assert.equal(pending.dialogue.state.turns_used, 1);
  assert.deepEqual(await loadConversation(student, session.id), pending);
  assert.equal(
    (await readSession(student, session.id, "student")).attempts[0]
      .response_text,
    null,
  );
  check(
    "Concurrent repeated request reserves once, rejects altered input, and preserves exact original message across refresh",
  );

  const view = await help(ask);
  const response = view.dialogue.turns[0].response;
  assert.equal(response.status, "accepted");
  if (response.status !== "accepted")
    throw new Error("Fixture help was not accepted.");
  const accepted = await readSession(teacher, session.id, "teacher");
  assert.equal(accepted.attempts[0].submitted_at, null);
  assert.equal(accepted.evaluations.length, 0);
  assert.equal(accepted.interventions[0].delivery_status, "created");
  assert.equal(accepted.interventions[0].visible_at, null);
  await denied(
    acknowledgeIntervention(student, session.id, response.intervention_id),
  );
  const display = DisplayDialogueSchema.parse({
    version: DIALOGUE_VERSION,
    request_id: ask.request_id,
    session_id: session.id,
    expected_revision: response.expected_revision,
    accepted_event_id: response.accepted_event_id,
    content_id: response.content.content_id,
  });
  await denied(
    acknowledgeConversation(student, session.id, {
      ...display,
      content_id: randomUUID(),
    }),
  );
  await denied(acknowledgeConversation(peer, session.id, display), 404);
  assert.deepEqual(await loadConversation(student, session.id), view);
  await denied(
    submitAnswer(student, session.id, {
      attempt_id: attempt.id,
      submission_key: randomUUID(),
      response_text: "Premature answer",
    }),
  );
  await Promise.all([
    acknowledgeConversation(student, session.id, display),
    acknowledgeConversation(student, session.id, display),
  ]);
  const shown = await readSession(teacher, session.id, "teacher");
  assert.equal(shown.interventions[0].delivery_status, "displayed");
  assert.ok(shown.interventions[0].visible_at);
  const audit = await readTeacherConversation(teacher, session.id);
  assert.equal(
    audit.events.filter(
      (event) =>
        event.kind === "dialogue" && event.payload.outcome === "displayed",
    ).length,
    1,
  );
  assert.equal(
    audit.operations[0].proposed_intent?.category,
    "QUESTION_OR_HELP",
  );
  assert.equal(audit.operations[0].authorized_route, "ask_tutor");
  assert.ok(
    audit.events.some(
      (event) =>
        event.kind === "dialogue" && event.payload.outcome === "generated",
    ),
  );
  assert.doesNotMatch(
    JSON.stringify(view),
    /rationale|answer_guidance|required_reasoning|private_model/,
  );
  await assert.rejects(
    pool.query(
      "UPDATE dialogue_operations SET payload='{}'::jsonb WHERE request_id=$1",
      [ask.request_id],
    ),
  );
  await assert.rejects(
    pool.query("DELETE FROM dialogue_events WHERE request_id=$1", [
      ask.request_id,
    ]),
  );
  check(
    "Help never grades; accepted help stays invisible until a matching display receipt; repeated acknowledgement and immutable audit history",
  );

  const answer = await message(
    session.id,
    demo.sessions[0].attempts[0].response_text!,
  );
  const clarification = await actConversation(student, session.id, answer);
  assert.equal(clarification.messages.at(-1)?.outcome.status, "clarification");
  const resolution = {
    version: CONVERSATION_VERSION,
    action: "resolve_intent",
    request_id: randomUUID(),
    session_id: session.id,
    attempt_id: attempt.id,
    expected_revision: answer.expected_revision,
    message_request_id: answer.request_id,
    choice: "answer",
  };
  await Promise.all([
    actConversation(student, session.id, resolution),
    actConversation(student, session.id, resolution),
  ]);
  assert.equal(
    (await reserveConversationOperation(student, answer)).replay,
    true,
  );
  const answered = await readSession(teacher, session.id, "teacher");
  assert.equal(answered.attempts.length, 1);
  assert.equal(answered.attempts[0].response_text, answer.text);
  assert.equal(answered.attempts[0].submission_key, answer.request_id);
  assert.deepEqual(answered.attempts[0].assistance?.intervention_ids, [
    response.intervention_id,
  ]);
  assert.notEqual(
    answered.attempts[0].assistance?.assistance_level,
    "none_recorded",
  );
  assert.equal(
    (await readTeacherConversation(teacher, session.id)).events.filter(
      (event) => event.kind === "answer_applied",
    ).length,
    1,
  );
  await denied(
    submitAnswer(student, session.id, {
      attempt_id: attempt.id,
      submission_key: answer.request_id,
      response_text: `${answer.text} altered`,
    }),
  );
  const source = demo.sessions[0].evaluations[0];
  const result = structuredClone(source.result!);
  result.evidence_quotes = result.evidence_quotes.map((quote) => ({
    ...quote,
    response_id: attempt.id,
  }));
  result.misconception_candidates = [];
  await recordEvaluation(student, session.id, {
    id: randomUUID(),
    attempt_id: attempt.id,
    validation_status: "accepted",
    evaluator: {
      type: "synthetic_fixture",
      model: null,
      version: "dialogue-postgres-fixture-v1",
    },
    supersedes_id: null,
    result,
    applied_result: null,
    failure_reason: null,
  });
  const historical = await readSession(teacher, session.id, "teacher");
  await presentQuestion(student, session.id, {
    question: demo.sessions[0].attempts[1].question,
    intent: demo.sessions[0].attempts[1].intent,
    parent_attempt_id: attempt.id,
  });
  const followup = await message(
    session.id,
    "Can you explain the new question?",
  );
  await reserveConversationOperation(student, followup);
  await failConversationOperation(
    student,
    session.id,
    followup.request_id,
    "disabled",
  );
  const after = await readSession(teacher, session.id, "teacher");
  assert.deepEqual(after.attempts[0], historical.attempts[0]);
  assert.deepEqual(after.evaluations, historical.evaluations);
  await acknowledgeConversation(student, session.id, display);
  check(
    "Explicit assessed answer applies once through existing submission; assistance and earlier answer/evaluation remain intact after new dialogue",
  );
}
async function providerFlow() {
  const { session } = await newSession();
  const action = await message(session.id);
  await reserveConversationOperation(student, action);
  const run = createReservedCall(student, session.id, action.request_id);
  const entered = deferred<void>();
  const release = deferred<typeof knownOutcome>();
  let calls = 0;
  const running = run(descriptor("classify"), async () => {
    calls++;
    entered.release();
    return release.promise;
  });
  await entered.promise;
  const invoke = async () => {
    calls++;
    return knownOutcome;
  };
  await denied(run(descriptor("classify"), invoke));
  await denied(run(descriptor("generate"), invoke));
  assert.equal(
    (await readProviderCall(student, session.id, action.request_id, "classify"))
      .status,
    "reserved",
  );
  await denied(
    readProviderCall(peer, session.id, action.request_id, "classify"),
    404,
  );
  release.release(knownOutcome);
  assert.deepEqual(await running, knownOutcome);
  assert.deepEqual(await run(descriptor("classify"), invoke), knownOutcome);
  await denied(
    run({ ...descriptor("classify"), input_hash: "a".repeat(64) }, invoke),
  );
  assert.equal(calls, 1);
  await assert.rejects(
    pool.query(
      "UPDATE dialogue_provider_calls SET result='{}'::jsonb WHERE request_id=$1",
      [action.request_id],
    ),
  );
  await assert.rejects(
    pool.query(
      "UPDATE dialogue_provider_calls SET step_id='review' WHERE request_id=$1",
      [action.request_id],
    ),
  );
  await assert.rejects(
    pool.query("DELETE FROM dialogue_provider_calls WHERE request_id=$1", [
      action.request_id,
    ]),
  );
  check(
    "One concurrent provider operation per session; saved known result replays without another callback; altered prompt hash rejected",
  );

  const cancelled = await newSession();
  const cancelledAction = await message(cancelled.session.id);
  await reserveConversationOperation(student, cancelledAction);
  const enteredCancel = deferred<void>();
  const releaseCancel = deferred<typeof knownOutcome>();
  const cancelledResult = createReservedCall(
    student,
    cancelled.session.id,
    cancelledAction.request_id,
  )(descriptor("classify"), async () => {
    enteredCancel.release();
    return releaseCancel.promise;
  });
  const rejectedCancellation = denied(cancelledResult);
  await enteredCancel.promise;
  await cancel(cancelledAction);
  releaseCancel.release(knownOutcome);
  await rejectedCancellation;
  assert.equal(
    (
      await readProviderCall(
        student,
        cancelled.session.id,
        cancelledAction.request_id,
        "classify",
      )
    ).status,
    "succeeded",
  );
  await denied(help(cancelledAction));
  assert.equal(
    (await loadConversation(student, cancelled.session.id)).messages[0].outcome
      .status,
    "cancelled",
  );
  check(
    "Cancelled late model result is recorded for reconciliation but cannot add help or change lesson progress",
  );

  const stale = await newSession();
  const staleAction = await message(stale.session.id);
  await reserveConversationOperation(student, staleAction);
  const enteredStale = deferred<void>();
  const releaseStale = deferred<typeof knownOutcome>();
  const staleResult = createReservedCall(
    student,
    stale.session.id,
    staleAction.request_id,
  )(descriptor("classify"), async () => {
    enteredStale.release();
    return releaseStale.promise;
  });
  const rejectedStale = denied(staleResult);
  await enteredStale.promise;
  await submitAnswer(student, stale.session.id, {
    attempt_id: stale.attempt.id,
    submission_key: randomUUID(),
    response_text: "Synthetic legacy answer while a model call is pending.",
  });
  releaseStale.release(knownOutcome);
  await rejectedStale;
  await denied(help(staleAction));
  assert.equal(
    (await loadConversation(student, stale.session.id)).messages[0].outcome
      .status,
    "fallback",
  );
  assert.equal(
    (await readSession(student, stale.session.id, "student")).attempts[0]
      .response_text,
    "Synthetic legacy answer while a model call is pending.",
  );
  const staleView = await loadConversation(student, stale.session.id);
  const lateFailureView = await failConversationOperation(
    student,
    stale.session.id,
    staleAction.request_id,
    "provider_error",
  );
  parseConversationView(
    lateFailureView,
    { sessionId: stale.session.id, attemptId: stale.attempt.id },
    staleView,
  );
  assert.deepEqual(lateFailureView.messages, staleView.messages);
  check(
    "Legacy answer advances revision; stale completion cannot overwrite the answer or change its already projected stale fallback",
  );

  const interrupted = await newSession();
  const interruptedAction = await message(interrupted.session.id);
  await reserveConversationOperation(student, interruptedAction);
  const interruptedRun = createReservedCall(
    student,
    interrupted.session.id,
    interruptedAction.request_id,
  );
  let interruptedCalls = 0;
  await denied(
    interruptedRun(descriptor("classify"), async () => {
      interruptedCalls++;
      throw new Error("Labeled fixture: connection interrupted after dispatch");
    }),
    503,
  );
  assert.equal(
    (
      await readProviderCall(
        student,
        interrupted.session.id,
        interruptedAction.request_id,
        "classify",
      )
    ).status,
    "unknown",
  );
  await denied(
    interruptedRun(descriptor("classify"), async () => {
      interruptedCalls++;
      return knownOutcome;
    }),
  );
  await denied(
    interruptedRun(descriptor("generate"), async () => {
      interruptedCalls++;
      return knownOutcome;
    }),
  );
  assert.equal(interruptedCalls, 1);
  const interruptedView = await loadConversation(
    student,
    interrupted.session.id,
  );
  assert.deepEqual(
    await loadConversation(student, interrupted.session.id),
    interruptedView,
  );
  await cancel(interruptedAction);
  await denied(
    reserveConversationOperation(
      student,
      await message(interrupted.session.id),
    ),
  );
  check(
    "Interrupted outcome remains unknown across refresh and cancellation; neither same-ID nor new-ID retries dispatch a second call",
  );

  const abandoned = await newSession();
  const abandonedAction = await message(abandoned.session.id);
  await reserveConversationOperation(student, abandonedAction);
  await pool.query(
    "INSERT INTO dialogue_provider_calls(id,session_id,request_id,step_id,metadata,status) VALUES($1,$2,$3,$4,$5::jsonb,'reserved')",
    [
      randomUUID(),
      abandoned.session.id,
      abandonedAction.request_id,
      "classify",
      JSON.stringify(descriptor("classify")),
    ],
  );
  const abandonedRun = createReservedCall(
    student,
    abandoned.session.id,
    abandonedAction.request_id,
  );
  await denied(
    abandonedRun(descriptor("classify"), async () => {
      throw new Error("Must not dispatch persisted crash reservation");
    }),
  );
  assert.equal(
    (
      await readProviderCall(
        student,
        abandoned.session.id,
        abandonedAction.request_id,
        "classify",
      )
    ).status,
    "reserved",
  );
  check(
    "Persisted reservation left by a process interruption survives reconnect without an automatic retry",
  );
}
async function failureAndTimeout() {
  const failed = await newSession();
  const action = await message(failed.session.id);
  await reserveConversationOperation(student, action);
  const run = createReservedCall(student, failed.session.id, action.request_id);
  const failure = {
    ok: false,
    needs_reconciliation: false,
    code: "synthetic_rate_limit",
  };
  let calls = 0;
  const fixtureCall = async () => {
    calls++;
    return failure;
  };
  assert.deepEqual(await run(descriptor("classify"), fixtureCall), failure);
  assert.deepEqual(await run(descriptor("classify"), fixtureCall), failure);
  await denied(run(descriptor("generate"), fixtureCall));
  assert.equal(calls, 1);
  assert.equal(
    (
      await readProviderCall(
        student,
        failed.session.id,
        action.request_id,
        "classify",
      )
    ).status,
    "failed",
  );
  check(
    "Known provider failure replays its recorded outcome and cannot authorize additional stages",
  );

  const timed = await newSession();
  const timedAction = await message(timed.session.id);
  await reserveConversationOperation(student, timedAction);
  const timedRun = createReservedCall(
    student,
    timed.session.id,
    timedAction.request_id,
  );
  const late = deferred<typeof knownOutcome>();
  let aborted = false;
  let timedCalls = 0;
  console.log(
    "Checking the real 45-second reservation timeout using an in-memory provider fixture; no external request.",
  );
  const started = Date.now();
  await denied(
    timedRun(descriptor("classify"), async (signal) => {
      timedCalls++;
      signal.addEventListener(
        "abort",
        () => {
          aborted = true;
        },
        { once: true },
      );
      return late.promise;
    }),
    503,
  );
  assert.ok(Date.now() - started >= DIALOGUE_LIMITS.timeoutMs);
  assert.equal(aborted, true);
  assert.equal(
    (
      await readProviderCall(
        student,
        timed.session.id,
        timedAction.request_id,
        "classify",
      )
    ).status,
    "unknown",
  );
  await denied(
    timedRun(descriptor("classify"), async () => {
      timedCalls++;
      return knownOutcome;
    }),
  );
  const before = await readSession(student, timed.session.id, "student");
  late.release(knownOutcome);
  const deadline = Date.now() + 5000;
  while (
    (
      await readProviderCall(
        student,
        timed.session.id,
        timedAction.request_id,
        "classify",
      )
    ).status === "unknown"
  ) {
    assert.ok(
      Date.now() < deadline,
      "Original late callback did not reconcile its known result.",
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.deepEqual(
    await timedRun(descriptor("classify"), async () => {
      timedCalls++;
      return knownOutcome;
    }),
    knownOutcome,
  );
  assert.equal(timedCalls, 1);
  assert.deepEqual(
    await readSession(student, timed.session.id, "student"),
    before,
  );
  check(
    "Real 45-second timeout aborts, preserves uncertainty, blocks retries, and reconciles the original late result without lesson side effects",
  );
}
async function pendingControllerFeedback() {
  const { session, attempt } = await newSession();
  const feedback = await recordIntervention(student, session.id, {
    id: randomUUID(),
    related_attempt_id: attempt.id,
    related_evaluation_id: null,
    type: "hint",
    text_shown:
      "Synthetic controller feedback: review the two separate delay intervals.",
    concept_ids: attempt.question.concept_ids,
    source_passage_ids: attempt.question.source_passage_ids,
    content_ref: attempt.question.content_ref,
  });
  const initial = await loadConversation(student, session.id);
  assert.equal(initial.dialogue.state.progress.phase, "feedback");
  const action = await message(session.id);
  await denied(reserveConversationOperation(student, action));
  assert.equal(
    (
      await pool.query(
        "SELECT request_id FROM dialogue_operations WHERE session_id=$1",
        [session.id],
      )
    ).rowCount,
    0,
  );
  assert.deepEqual(await loadConversation(student, session.id), initial);
  await acknowledgeIntervention(student, session.id, feedback.id);
  assert.equal(
    (await reserveConversationOperation(student, action)).replay,
    false,
  );
  check(
    "Unshown controller feedback rejects a new message before any durable operation or turn is inserted",
  );
}
async function sharedLegacyProviderGate() {
  const { session, attempt } = await newSession();
  const action = await message(session.id);
  await reserveConversationOperation(student, action);
  const entered = deferred<void>();
  const release = deferred<typeof knownOutcome>();
  const running = createReservedCall(
    student,
    session.id,
    action.request_id,
  )(descriptor("classify"), async () => {
    entered.release();
    return release.promise;
  });
  const obsolete = denied(running);
  await entered.promise;
  await submitAnswer(student, session.id, {
    attempt_id: attempt.id,
    submission_key: randomUUID(),
    response_text:
      "Synthetic answer exercising the shared evaluator reservation gate.",
  });
  const marker = {
    id: randomUUID(),
    attempt_id: attempt.id,
    validation_status: "pending_review" as const,
    evaluator: {
      type: "language_model" as const,
      model: "synthetic-no-provider",
      version: "dialogue-reservation-fixture-v1",
    },
    supersedes_id: null,
    result: null,
    applied_result: null,
    failure_reason:
      "Synthetic durable evaluation reservation; no actual model call.",
  };
  await denied(recordEvaluation(student, session.id, marker));
  release.release(knownOutcome);
  await obsolete;
  await recordEvaluation(student, session.id, marker);
  assert.equal(
    (await loadConversation(student, session.id)).dialogue.state
      .provider_requests_used,
    2,
  );
  await presentQuestion(student, session.id, {
    question: demo.sessions[0].attempts[1].question,
    intent: demo.sessions[0].attempts[1].intent,
    parent_attempt_id: attempt.id,
  });
  const next = await message(session.id);
  await denied(reserveConversationOperation(student, next));
  await recordEvaluation(student, session.id, {
    ...marker,
    id: randomUUID(),
    validation_status: "evaluation_failed",
    failure_reason: "Synthetic unknown external outcome.",
  });
  await denied(reserveConversationOperation(student, next));
  await denied(
    recordEvaluation(student, session.id, { ...marker, id: randomUUID() }),
  );
  await recordEvaluation(student, session.id, {
    ...marker,
    id: randomUUID(),
    validation_status: "rejected",
    failure_reason:
      "Synthetic known provider completion rejected by output validation.",
  });
  await reserveConversationOperation(student, next);
  const result = await createReservedCall(
    student,
    session.id,
    next.request_id,
  )(descriptor("classify"), async () => knownOutcome);
  assert.deepEqual(result, knownOutcome);
  assert.equal(
    (await loadConversation(student, session.id)).dialogue.state
      .provider_requests_used,
    3,
  );
  check(
    "Legacy evaluations share provider concurrency and budget; evaluation_failed stays unresolved until a known result is recorded",
  );
}
async function linkedEvaluationOutcomes() {
  for (const outcome of ["settled", "unknown"] as const) {
    const { session, attempt } = await newSession();
    await submitAnswer(student, session.id, {
      attempt_id: attempt.id,
      submission_key: randomUUID(),
      response_text:
        "Synthetic evaluator settlement check; original answer retained.",
    });
    const marker = {
      id: randomUUID(),
      attempt_id: attempt.id,
      validation_status: "pending_review" as const,
      evaluator: {
        type: "language_model" as const,
        model: "fixture-alias",
        version: "settlement-fixture-v1",
      },
      supersedes_id: null,
      result: null,
      applied_result: null,
      failure_reason: "Synthetic durable reservation; no provider call.",
    };
    await recordEvaluation(student, session.id, marker);
    const final = {
      ...marker,
      id: randomUUID(),
      validation_status: "evaluation_failed" as const,
      evaluator: {
        ...marker.evaluator,
        model: "fixture-dated-model",
        provider_reservation_id: marker.id,
        provider_outcome: outcome,
      },
      failure_reason: "Synthetic provider outcome.",
    };
    await denied(
      recordEvaluation(student, session.id, {
        ...final,
        evaluator: {
          ...final.evaluator,
          provider_reservation_id: randomUUID(),
        },
      }),
    );
    await recordEvaluation(student, session.id, final);
    const retry = { ...marker, id: randomUUID() };
    if (outcome === "unknown") {
      await denied(recordEvaluation(student, session.id, retry));
    } else {
      await recordEvaluation(student, session.id, retry);
      await recordEvaluation(student, session.id, {
        ...final,
        id: randomUUID(),
        evaluator: { ...final.evaluator, provider_reservation_id: retry.id },
      });
    }
    await presentQuestion(student, session.id, {
      question: demo.sessions[0].attempts[1].question,
      intent: demo.sessions[0].attempts[1].intent,
      parent_attempt_id: attempt.id,
    });
    const next = await message(session.id);
    if (outcome === "unknown") {
      await denied(reserveConversationOperation(student, next));
    } else {
      await reserveConversationOperation(student, next);
      await createReservedCall(
        student,
        session.id,
        next.request_id,
      )(descriptor("classify"), async () => knownOutcome);
    }
    assert.equal(
      (await loadConversation(student, session.id)).dialogue.state
        .provider_requests_used,
      outcome === "settled" ? 3 : 1,
    );
    const saved = await readSession(student, session.id, "student");
    assert.equal(
      saved.attempts[0].response_text,
      "Synthetic evaluator settlement check; original answer retained.",
    );
    assert.equal(saved.evaluations[0].id, marker.id);
    check(
      `Exact linked ${outcome} evaluator outcome ${outcome === "settled" ? "permits explicit new work" : "blocks evaluator and dialogue work"}; spent budget and original evidence retained`,
    );
  }
}
async function orchestrationRecords() {
  const { session } = await newSession();
  const action = await message(session.id);
  await reserveConversationOperation(student, action);
  await commitConversationIntent(
    student,
    session.id,
    action.request_id,
    {
      category: "QUESTION_OR_HELP",
      rationale: "Synthetic intent fixture for action persistence.",
    },
    { answer_intent: "uncertain", disclosure: "safe" },
  );
  const request = (await readTeacherConversation(teacher, session.id))
    .operations[0].dialogue_request;
  assert.ok(request);
  const ports = createOrchestrationPersistence(student, session.id, [
    "clarify",
    "explain",
  ]);
  await denied(
    createOrchestrationPersistence(peer, session.id, [
      "clarify",
      "explain",
    ]).claim(request),
    404,
  );
  assert.equal((await ports.claim(request)).kind, "claimed");
  assert.deepEqual(await ports.claim(request), {
    kind: "blocked",
    reason: "pending",
  });
  const proposal = TutorProposalSchema.parse({
    version: "tutor-orchestration-v1",
    action: "explain",
    content_ref: content.content_ref,
    concept_ids: ["transmission_delay"],
    source_passage_ids: ["P07", "P08"],
    reason_summary: "Synthetic action proposal to explain delay intervals.",
    arguments: { style: "hint" },
  });
  const proposed = {
    action_id: action.request_id,
    phase: "proposed" as const,
    proposal,
    invalid_proposal: false,
  };
  await ports.checkpoint(request, proposed);
  await ports.checkpoint(request, proposed);
  await ports.checkpoint(request, {
    action_id: action.request_id,
    phase: "validated",
    allowed_actions: ["explain"],
    decision: "accepted",
    reason: null,
  });
  await ports.checkpoint(request, {
    action_id: action.request_id,
    phase: "dispatch_started",
    tool: "explain",
  });
  assert.equal(
    (await readTeacherConversation(teacher, session.id)).events.filter(
      (event) => event.kind === "action",
    ).length,
    3,
  );
  if (examples.help.kind !== "help") throw new Error("Expected help fixture.");
  const result = TutorToolResultSchema.parse({
    kind: "generated",
    content: {
      ...examples.help,
      content_id: randomUUID(),
      generation: {
        ...examples.help.generation,
        generated_at: new Date().toISOString(),
      },
    },
  });
  const receipt = await ports.complete(request, proposal, result);
  assert.equal(receipt.status, "executed");
  assert.deepEqual(await ports.complete(request, proposal, result), receipt);
  await denied(
    ports.complete(
      { ...request, expected_revision: request.expected_revision + 1 },
      proposal,
      result,
    ),
  );
  const changed = TutorToolResultSchema.parse({
    kind: "generated",
    content: { ...examples.help, content_id: randomUUID() },
  });
  await denied(ports.complete(request, proposal, changed));
  assert.deepEqual(await ports.claim(request), { kind: "replay", receipt });
  const audit = await readTeacherConversation(teacher, session.id);
  assert.deepEqual(
    audit.events
      .filter((event) => event.kind === "action")
      .map((event) => event.payload.phase),
    ["proposed", "validated", "dispatch_started", "executed"],
  );
  assert.equal(
    audit.events.filter((event) => event.kind === "action_receipt").length,
    1,
  );
  const evidence = await readSession(student, session.id, "student");
  assert.equal(evidence.interventions.length, 1);
  assert.equal(evidence.interventions[0].delivery_status, "created");
  assert.equal(evidence.interventions[0].visible_at, null);
  assert.equal(
    (await loadConversation(student, session.id)).dialogue.turns[0].response
      .status,
    "accepted",
  );
  check(
    "Orchestration claim, proposal, validation, dispatch and executed receipt persist once; accepted help and result commit together without marking display",
  );

  for (const candidate of [
    {
      ...examples.help,
      content_id: randomUUID(),
      text: "PRIVATE REJECTED CONTENT sentinel",
      source_passage_ids: ["MISSING"],
    },
    examples.diagnostics.distance,
  ]) {
    const rejected = await newSession();
    const rejectedAction = await message(rejected.session.id);
    await reserveConversationOperation(student, rejectedAction);
    await commitConversationIntent(
      student,
      rejected.session.id,
      rejectedAction.request_id,
      {
        category: "QUESTION_OR_HELP",
        rationale: "Synthetic invalid-output storage fixture.",
      },
      { answer_intent: "uncertain", disclosure: "safe" },
    );
    const view = await commitConversationHelp(
      student,
      rejected.session.id,
      rejectedAction.request_id,
      candidate,
      examples.review,
    );
    assert.equal(view.messages[0].outcome.status, "fallback");
    assert.doesNotMatch(
      JSON.stringify(view),
      /PRIVATE REJECTED CONTENT|answer_guidance/,
    );
    const saved = await readSession(student, rejected.session.id, "student");
    assert.equal(saved.interventions.length, 0);
    assert.equal(saved.attempts.length, 1);
    assert.equal(saved.attempts[0].response_text, null);
    const rejectedAudit = await readTeacherConversation(
      teacher,
      rejected.session.id,
    );
    assert.deepEqual(
      rejectedAudit.events
        .filter((event) => event.kind === "dialogue")
        .map((event) => event.payload.outcome),
      ["requested", "generated", "rejected"],
    );
  }
  check(
    "Invalid help and unsupported generated assessment are preserved as private generated/rejected events with no delivery or answer side effect",
  );
}
async function httpRoutes() {
  if (!httpBase) return;
  async function request(
    path: string,
    cookie = "",
    body?: unknown,
    origin = new URL(httpBase!).origin,
  ) {
    return fetch(new URL(path, httpBase), {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Cookie: cookie,
        Origin: origin,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
  }
  async function login(access: ReturnType<typeof actor>) {
    const response = await request("/api/auth/sign-in/email", "", {
      email: `${access.actor.userId}@example.invalid`,
      password: fixturePassword,
    });
    assert.equal(
      response.status,
      200,
      `Synthetic fixture login returned HTTP ${response.status}`,
    );
    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(";", 1)[0])
      .join("; ");
    assert.ok(cookie);
    return cookie;
  }
  const { session } = await newSession();
  const path = `/api/tutoring/${session.id}/conversation`;
  const teacherPath = `/api/teacher/sessions/${session.id}/conversation`;
  const action = await message(
    session.id,
    "HTTP synthetic intent-confirmation fixture",
  );
  const operationPath = `${path}/operations/${action.request_id}`;
  assert.equal((await request(path)).status, 401);
  assert.equal((await request(path, "", action)).status, 401);
  assert.equal((await request(`${path}/display`, "", {})).status, 401);
  assert.equal((await request(operationPath)).status, 401);
  assert.equal((await request(teacherPath)).status, 401);
  const studentCookie = await login(student);
  const peerCookie = await login(peer);
  const teacherCookie = await login(teacher);
  const otherTeacherCookie = await login(otherTeacher);
  assert.equal((await request(path, studentCookie)).status, 200);
  assert.equal((await request(path, peerCookie)).status, 404);
  assert.equal((await request(path, peerCookie, action)).status, 404);
  assert.equal((await request(path, teacherCookie)).status, 404);
  assert.equal(
    (await request(path, studentCookie, action, "https://example.invalid"))
      .status,
    403,
  );
  assert.equal(
    (
      await request(path, studentCookie, {
        ...action,
        authorized_route: "submit_answer",
      })
    ).status,
    400,
  );
  for (let count = 0; count < 2; count++) {
    const response = await request(path, studentCookie, action);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const view = await response.text();
    assert.match(view, /clarification/);
    assert.doesNotMatch(view, /rationale|answer_guidance|provider_result/);
  }
  assert.equal(
    (
      await request(path, studentCookie, {
        ...action,
        text: "Changed HTTP payload",
      })
    ).status,
    409,
  );
  assert.equal((await request(operationPath, studentCookie)).status, 200);
  assert.equal((await request(operationPath, peerCookie)).status, 404);
  assert.equal((await request(teacherPath, studentCookie)).status, 404);
  assert.equal((await request(teacherPath, otherTeacherCookie)).status, 404);
  assert.equal((await request(teacherPath, teacherCookie)).status, 200);
  const teacherPage = `/teacher/sessions/${session.id}`;
  const page = await request(teacherPage, teacherCookie);
  assert.equal(page.status, 200);
  assert.ok(
    (await page.text()).includes(action.text),
    "Teacher page must show the original saved message.",
  );
  for (const cookie of [studentCookie, otherTeacherCookie]) {
    const deniedPage = await request(teacherPage, cookie);
    const deniedHtml = await deniedPage.text();
    // Next may already have streamed the page shell (HTTP 200) before notFound.
    // Require its explicit 404 boundary and verify no saved evidence is exposed.
    assert.ok(
      deniedPage.status === 404 ||
        (deniedPage.status === 200 &&
          deniedHtml.includes("NEXT_HTTP_ERROR_FALLBACK;404")),
      `Unauthorized page must render the Next 404 boundary (status ${deniedPage.status}).`,
    );
    assert.ok(!deniedHtml.includes(action.text));
  }

  const evidence = await readSession(student, session.id, "student");
  assert.equal(evidence.attempts[0].response_text, null);
  assert.equal(evidence.evaluations.length, 0);
  check(
    "HTTP routes authenticate real synthetic login cookies, reject anonymous/cross-user/cross-teacher requests and cross-origin writes, and replay safely",
  );
}
async function limits() {
  const budget = await newSession();
  let calls = 0;
  const fixtureCall = async () => {
    calls++;
    return knownOutcome;
  };
  for (let turn = 0; turn < 9; turn++) {
    const action = await message(
      budget.session.id,
      `Budget fixture turn ${turn}`,
    );
    await reserveConversationOperation(student, action);
    const run = createReservedCall(
      student,
      budget.session.id,
      action.request_id,
    );
    for (const stage of ["classify", "propose", "generate", "review"] as const)
      await run(descriptor(stage), fixtureCall);
    await failConversationOperation(
      student,
      budget.session.id,
      action.request_id,
      "disabled",
    );
  }
  const overBudget = await message(budget.session.id);
  await reserveConversationOperation(student, overBudget);
  await denied(
    createReservedCall(
      student,
      budget.session.id,
      overBudget.request_id,
    )(descriptor("classify"), fixtureCall),
  );
  assert.equal(calls, 36);
  assert.equal(
    (await loadConversation(student, budget.session.id)).dialogue.state
      .provider_requests_used,
    36,
  );
  const turns = await newSession();
  for (let i = 0; i < DIALOGUE_LIMITS.turnsPerSession; i++) {
    const turn = await message(turns.session.id, `Synthetic help turn ${i}`);
    await reserveConversationOperation(student, turn);
    await failConversationOperation(
      student,
      turns.session.id,
      turn.request_id,
      "disabled",
    );
  }
  await denied(
    reserveConversationOperation(student, await message(turns.session.id)),
  );
  assert.equal(
    (await loadConversation(student, turns.session.id)).dialogue.state
      .turns_used,
    12,
  );
  check(
    "Server-owned limits stop the 37th provider call and 13th conversation turn",
  );
}
try {
  await seed();
  if (httpOnly) {
    await httpRoutes();
  } else {
    await mainFlow();
    await providerFlow();
    await limits();
    await sharedLegacyProviderGate();
    await linkedEvaluationOutcomes();
    await pendingControllerFeedback();
    await orchestrationRecords();
    await httpRoutes();
    await failureAndTimeout();
  }
} catch (error) {
  report.error =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : "Dialogue check failed";
  console.error(error);
  process.exitCode = 1;
} finally {
  console.log(JSON.stringify(report, null, 2));
  await pool.end();
}
