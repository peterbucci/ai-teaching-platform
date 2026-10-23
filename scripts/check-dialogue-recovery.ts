import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPool, inTransaction } from "../lib/db.ts";
import {
  evidenceAccess,
  startSession,
  presentQuestion,
  readSession,
  submitAnswer,
} from "../lib/evidence/store.ts";
import { getCuratedQuestion } from "../lib/evidence/content.ts";
import { createApprovedRuntimeLesson } from "./fixtures/approved-r7-lesson.ts";
import {
  loadConversation,
  reserveConversationOperation,
  commitConversationIntent,
} from "../lib/dialogue/store.ts";
import { CONVERSATION_VERSION } from "../lib/dialogue/conversation.ts";
import { dialogueContext } from "../lib/dialogue/persistence.ts";
import {
  createReservedCall,
  createRecordedCall,
  readSuccessfulProviderCall,
} from "../lib/dialogue/provider-store.ts";
import {
  instructionPorts,
  recoverApplicationConversation,
} from "../lib/dialogue/application.ts";
import { classifyIntent } from "../lib/dialogue/service.ts";
import type {
  DialogueServices,
  RunReservedCall,
} from "../lib/dialogue/service.ts";
import type { requestStructuredProposal } from "../lib/dialogue/model-provider.ts";
import { makeDialogueExamples } from "../lib/dialogue/examples.ts";
import { reviewFields } from "../lib/dialogue/generation.ts";
import { GeneratedDialogueSchema } from "../lib/dialogue/contracts.ts";
import { ORCHESTRATION_VERSION } from "../lib/tutoring/orchestration/contracts.ts";
import { runTutorOrchestration } from "../lib/tutoring/orchestration/run.ts";

assert.equal(process.env.DIALOGUE_CHECK_SYNTHETIC, "1");
assert.equal(
  process.env.OPENAI_API_KEY?.trim() ?? "",
  "",
  "This check never uses a model credential.",
);
for (const name of ["PGHOST", "PGPORT", "PGUSER", "PGDATABASE", "PGPASSWORD"])
  assert.ok(process.env[name], `Configure ${name} for the isolated database.`);
const pool = getPool();
const actor = () =>
  evidenceAccess({
    profileId: randomUUID(),
    userId: `recovery-fixture-${randomUUID()}`,
  });
const teacher = actor(),
  student = actor(),
  peer = actor();
const classId = randomUUID();
const model = "synthetic-recorded-recovery";
const httpBase = process.env.DIALOGUE_CHECK_URL;
const fixturePassword = `synthetic-only-${randomUUID()}`;
if (httpBase)
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(httpBase).hostname));
let callbacks = 0;
const pass = (message: string) => console.log(`PASS: ${message}`);

try {
  const passwordHash = httpBase
    ? await (await import("better-auth/crypto")).hashPassword(fixturePassword)
    : null;
  await inTransaction(async (client) => {
    for (const access of [teacher, student, peer]) {
      await client.query(
        "INSERT INTO auth_user(id,name,email) VALUES($1,$2,$3)",
        [
          access.actor.userId,
          "Synthetic recorded recovery",
          `${access.actor.userId}@example.invalid`,
        ],
      );
      if (passwordHash)
        await client.query(
          'INSERT INTO auth_account(id,"accountId","providerId","userId",password) VALUES($1,$2,\'credential\',$2,$3)',
          [randomUUID(), access.actor.userId, passwordHash],
        );
      await client.query(
        "INSERT INTO profiles(id,auth_user_id,display_name) VALUES($1,$2,$3)",
        [
          access.actor.profileId,
          access.actor.userId,
          "Synthetic recorded recovery",
        ],
      );
    }
    await client.query(
      "INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)",
      [classId, teacher.actor.profileId, "Synthetic recorded recovery"],
    );
    for (const access of [student, peer])
      await client.query(
        "INSERT INTO enrollments(class_id,student_id) VALUES($1,$2)",
        [classId, access.actor.profileId],
      );
  });
  const { assignmentId, content } = await createApprovedRuntimeLesson(
    teacher,
    classId,
  );
  const examples = makeDialogueExamples(content);
  assert.equal(examples.help.kind, "help");
  if (examples.help.kind !== "help") throw new Error("Expected help fixture");
  const {
    text,
    assistance_type,
    content_ref,
    concept_ids,
    source_passage_ids,
  } = examples.help;
  const help = {
    text,
    assistance_type,
    content_ref,
    concept_ids,
    source_passage_ids,
  };
  const proposal = {
    version: ORCHESTRATION_VERSION,
    action: "explain" as const,
    arguments: { style: "alternative_explanation" as const },
    content_ref,
    concept_ids,
    source_passage_ids,
    reason_summary: "Synthetic action for recorded-success recovery checks.",
  };
  const provider: typeof requestStructuredProposal = async (prompt) => {
    callbacks++;
    const data = JSON.parse(prompt.input);
    let value: unknown;
    if (prompt.schemaName === "dialogue_classify")
      value = {
        category: "ANSWER",
        rationale: "Synthetic intended answer, still requiring confirmation.",
      };
    else if (prompt.schemaName === "tutor_instructional_proposal")
      value = { proposal };
    else if (prompt.schemaName === "dialogue_generate") value = help;
    else {
      assert.equal(prompt.schemaName, "dialogue_review");
      const candidate = GeneratedDialogueSchema.parse(data.candidate);
      value = {
        grounding: "supported",
        disclosure: "safe_scaffolding",
        relevance: "relevant",
        answerability: "not_applicable",
        novelty: "not_applicable",
        assistance: "accurate",
        requires_unverified_calculation: false,
        coverage: reviewFields(candidate).map(({ field }) => ({
          field,
          support: "supported",
          sources: source_passage_ids.map((passage_id) => ({
            passage_id,
            quote: content.passages.get(passage_id)!.text.slice(0, 120),
          })),
        })),
        reason:
          "Synthetic independent support fixture; not live model acceptance.",
      };
    }
    return {
      ok: true,
      result: prompt.schema.parse(value),
      model,
      responseId: `fixture-${randomUUID()}`,
      latencyMs: 1,
      usage: null,
      completedAt: new Date().toISOString(),
      needs_reconciliation: false,
    };
  };
  async function initial(text = "What does packet size mean?") {
    const session = await startSession(
      student,
      assignmentId,
      "synthetic_fixture",
    );
    const attempt = await presentQuestion(student, session.id, {
      question: getCuratedQuestion(
        content,
        content.sequence.initial_question_id,
      ),
      intent: "initial_retrieval",
    });
    const view = await loadConversation(student, session.id);
    const action = {
      version: CONVERSATION_VERSION,
      action: "send_message" as const,
      request_id: randomUUID(),
      session_id: session.id,
      attempt_id: attempt.id,
      expected_revision: view.dialogue.state.revision,
      text,
    };
    await reserveConversationOperation(student, action);
    return { session, attempt, action };
  }
  async function interrupted(mode: "complete" | "missing" | "unknown") {
    const sample = await initial();
    const { session, action } = sample;
    await commitConversationIntent(
      student,
      session.id,
      action.request_id,
      { category: "QUESTION_OR_HELP", rationale: "Synthetic help intent." },
      { answer_intent: "uncertain", disclosure: "safe" },
    );
    const context = await inTransaction((client) =>
      dialogueContext(client, student, session.id, false),
    );
    const request = context.operations.find(
      (item) => item.request_id === action.request_id,
    )!.dialogue_request!;
    const reserved = createReservedCall(student, session.id, action.request_id);
    const runReservedCall: RunReservedCall = async (step, call) => {
      if (step.stage === "review" && mode === "missing")
        throw new Error(
          "Synthetic process interruption before review reservation.",
        );
      if (step.stage === "review" && mode === "unknown")
        return reserved(step, async () => {
          throw new Error("Synthetic interrupted external result.");
        });
      return reserved(step, call);
    };
    const services: DialogueServices = {
      runReservedCall,
      provider: { model, request: provider },
    };
    const ports = instructionPorts(student, request, context, services, model);
    const result = await runTutorOrchestration(request, {
      ...ports,
      complete: async () => {
        throw new Error("Synthetic process interruption before commit.");
      },
    });
    assert.equal(result.status, "stopped");
    assert.ok(result.status === "stopped" && result.reconcile);
    assert.equal(
      (await readSession(student, session.id, "student")).interventions.length,
      0,
    );
    return sample;
  }
  const input = (sample: Awaited<ReturnType<typeof initial>>) => ({
    expected_revision: sample.action.expected_revision,
  });
  async function recover(sample: Awaited<ReturnType<typeof initial>>) {
    return recoverApplicationConversation(
      student,
      sample.session.id,
      sample.action.request_id,
      input(sample),
    );
  }
  async function counts(sessionId: string) {
    return (
      await pool.query(
        `SELECT (SELECT count(*) FROM dialogue_provider_calls WHERE session_id=$1)::int AS calls,
       (SELECT count(*) FROM interventions WHERE session_id=$1)::int AS interventions,
       (SELECT count(*) FROM attempts WHERE session_id=$1)::int AS attempts`,
        [sessionId],
      )
    ).rows[0];
  }

  const complete = await interrupted("complete");
  const before = await counts(complete.session.id);
  const callsBefore = callbacks;
  await loadConversation(student, complete.session.id);
  assert.deepEqual(
    await counts(complete.session.id),
    before,
    "GET never commits saved work.",
  );
  const concurrent = await Promise.allSettled([
    recover(complete),
    recover(complete),
  ]);
  assert.ok(concurrent.some((result) => result.status === "fulfilled"));
  const recovered = await recover(complete);
  assert.equal(recovered.messages[0].outcome.status, "help");
  assert.equal(recovered.dialogue.turns[0].response.status, "accepted");
  assert.equal(callbacks, callsBefore);
  assert.deepEqual(await counts(complete.session.id), {
    ...before,
    interventions: 1,
  });
  const evidence = await readSession(student, complete.session.id, "student");
  assert.equal(evidence.interventions[0].delivery_status, "created");
  assert.equal(evidence.interventions[0].visible_at, null);
  assert.equal(evidence.attempts[0].response_text, null);
  pass(
    "Known successful proposal/generation/review recover once under concurrent POSTs; no provider dispatch, grading, or display assistance.",
  );

  await assert.rejects(
    recoverApplicationConversation(
      peer,
      complete.session.id,
      complete.action.request_id,
      input(complete),
    ),
  );
  await assert.rejects(
    recoverApplicationConversation(
      student,
      complete.session.id,
      complete.action.request_id,
      {
        expected_revision: complete.action.expected_revision + 1,
      },
    ),
  );
  pass(
    "Another student and changed original revision cannot recover a saved operation.",
  );

  for (const mode of ["missing", "unknown"] as const) {
    const sample = await interrupted(mode);
    const baseline = await counts(sample.session.id);
    const callbackBaseline = callbacks;
    await assert.rejects(recover(sample));
    await assert.rejects(recover(sample));
    assert.deepEqual(await counts(sample.session.id), baseline);
    assert.equal(callbacks, callbackBaseline);
    assert.equal(
      (await loadConversation(student, sample.session.id)).messages[0].outcome
        .status,
      "pending",
    );
  }
  pass(
    "Missing review and unknown outcome stay pending; repeated recovery creates no calls or effects.",
  );

  const stale = await interrupted("complete");
  await submitAnswer(student, stale.session.id, {
    attempt_id: stale.attempt.id,
    submission_key: randomUUID(),
    response_text: "Synthetic direct answer changes the current revision.",
  });
  const staleCounts = await counts(stale.session.id);
  await assert.rejects(recover(stale));
  assert.deepEqual(await counts(stale.session.id), staleCounts);
  pass(
    "A newer submitted answer invalidates the saved operation before recovery.",
  );

  const record = await readSuccessfulProviderCall(
    student,
    complete.session.id,
    complete.action.request_id,
    "generate",
  );
  const recordedCall = createRecordedCall(
    student,
    complete.session.id,
    complete.action.request_id,
  );
  let forbiddenDispatches = 0;
  await assert.rejects(
    recordedCall(
      { ...record.metadata, input_hash: "0".repeat(64) },
      async () => {
        forbiddenDispatches++;
        return {};
      },
    ),
  );
  assert.equal(forbiddenDispatches, 0);
  pass(
    "Recorded results require exact original prompt/model/input descriptor and never invoke callbacks.",
  );

  const classified = await initial(
    "The packet enters the link one bit at a time.",
  );
  const context = await inTransaction((client) =>
    dialogueContext(client, student, classified.session.id, false),
  );
  const classification = await classifyIntent(
    {
      content,
      scope: context.scope,
      lesson: context.lesson,
      revision: context.revision,
      question: context.attempt.question,
      assessment_status: "unanswered",
      text: classified.action.text,
      history: [],
      prior_questions: [context.attempt.question],
    },
    {
      runReservedCall: createReservedCall(
        student,
        classified.session.id,
        classified.action.request_id,
      ),
      provider: { model, request: provider },
    },
  );
  assert.equal(classification.ok, true);
  const baselineCallbacks = callbacks;
  const result = await recover(classified);
  assert.equal(result.messages[0].outcome.status, "clarification");
  assert.equal(callbacks, baselineCallbacks);
  assert.equal(
    (await readSession(student, classified.session.id, "student")).attempts[0]
      .response_text,
    null,
  );
  pass(
    "Recorded classification recovers the explicit confirmation step without submitting or evaluating an answer.",
  );

  if (httpBase) {
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
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "manual",
      });
    }
    async function login(access: typeof student) {
      const response = await request("/api/auth/sign-in/email", "", {
        email: `${access.actor.userId}@example.invalid`,
        password: fixturePassword,
      });
      assert.equal(response.status, 200);
      return response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
    }
    const cookie = await login(student);
    const peerCookie = await login(peer);
    const sample = await interrupted("complete");
    const path = `/api/tutoring/${sample.session.id}/conversation/operations/${sample.action.request_id}`;
    const baseline = await counts(sample.session.id);
    const callbackBaseline = callbacks;
    assert.equal((await request(path, "", input(sample))).status, 401);
    assert.equal((await request(path, peerCookie, input(sample))).status, 404);
    assert.equal(
      (await request(path, cookie, input(sample), "https://untrusted.example"))
        .status,
      403,
    );
    assert.equal(
      (
        await request(path, cookie, {
          expected_revision: sample.action.expected_revision + 1,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request(path, cookie, {
          ...input(sample),
          model_output: "untrusted",
        })
      ).status,
      400,
    );
    assert.equal((await request(path, cookie)).status, 200);
    assert.deepEqual(
      await counts(sample.session.id),
      baseline,
      "Read and rejected HTTP requests preserve evidence.",
    );
    const response = await request(path, cookie, input(sample));
    assert.equal(response.status, 200, await response.text());
    assert.equal((await request(path, cookie, input(sample))).status, 200);
    assert.equal(callbacks, callbackBaseline);
    assert.deepEqual(await counts(sample.session.id), {
      ...baseline,
      interventions: 1,
    });
    pass(
      "Authenticated recovery HTTP denies anonymous/foreign/origin/stale/injected requests, keeps GET read-only, and replays one saved delivery without new model calls.",
    );
  }
  console.log(
    JSON.stringify({
      fixture_only: true,
      actual_model_calls: 0,
      checks: httpBase ? 7 : 6,
    }),
  );
} finally {
  await pool.end();
}
