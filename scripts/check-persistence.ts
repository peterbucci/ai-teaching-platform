import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { resolveActor } from "../lib/auth.ts";
import { requireSupabaseConfig } from "../lib/supabase/config.ts";
import { buildDemoFixture, DEMO_IDS, seedDemo } from "../lib/evidence/demo.ts";
import {
  getCuratedQuestion,
  loadApprovedContent,
} from "../lib/evidence/content.ts";
import { toStudentSessionView } from "../lib/evidence/rules.ts";
import {
  acknowledgeIntervention,
  evidenceAccess,
  EvidenceError,
  finishSession,
  presentQuestion,
  readSession,
  readStudentSession,
  recordEvaluation,
  recordIntervention,
  startSession,
  submitAnswer,
} from "../lib/evidence/store.ts";
import { createAdminClient } from "../lib/supabase/admin.ts";

// Run only against a dedicated development Supabase project. No users are created.
// The probe retains its own labeled synthetic session for inspection.
async function checkPersistence() {
  const config = requireSupabaseConfig();
  async function signedIn(prefix: string) {
    const email = process.env[`${prefix}_EMAIL`];
    const password = process.env[`${prefix}_PASSWORD`];
    if (!email || !password)
      throw new Error(
        `Set ${prefix}_EMAIL and ${prefix}_PASSWORD in ignored .env.local.`,
      );
    const client = createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const response = await client.auth.signInWithPassword({ email, password });
    if (response.error)
      throw new Error(`Could not sign in the configured ${prefix} account.`);
    return evidenceAccess(await resolveActor(client));
  }
  const teacher = await signedIn("DEMO_TEACHER");
  const student = await signedIn("DEMO_STUDENT_ONE");
  const other = await signedIn("DEMO_STUDENT_TWO");
  assert.equal(teacher.actor.profileId, DEMO_IDS.teacher);
  assert.equal(student.actor.profileId, DEMO_IDS.studentOne);
  assert.equal(other.actor.profileId, DEMO_IDS.studentTwo);

  const content = loadApprovedContent();
  const fixture = buildDemoFixture(content);
  await seedDemo(createAdminClient(), fixture); // Repeatability, preserving linked login IDs.
  const prepared = await readSession(
    teacher,
    DEMO_IDS.supportedSession,
    "teacher",
  );
  assert.equal(prepared.attempts.length, 4);
  assert.equal(prepared.evaluations.length, 4);
  assert.equal(prepared.interventions.length, 2);
  assert.deepEqual(
    prepared.attempts.map((attempt) => attempt.question.question_id),
    fixture.sessions[0].attempts.map((attempt) => attempt.question.question_id),
  );
  assert.equal(prepared.attempts[0].outcome?.outcome, "correct_after_feedback");
  assert.ok(
    prepared.evaluations.every(
      (evaluation) => evaluation.result?.per_concept_results.length === 2,
    ),
  );
  assert.deepEqual(
    await readStudentSession(student, DEMO_IDS.supportedSession),
    toStudentSessionView(prepared),
  );
  const denied = (error: unknown) =>
    error instanceof EvidenceError && [403, 404].includes(error.status);
  await assert.rejects(
    readSession(other, DEMO_IDS.supportedSession, "teacher"),
    denied,
  );
  await assert.rejects(
    readStudentSession(other, DEMO_IDS.supportedSession),
    denied,
  );
  await assert.rejects(
    readSession(student, DEMO_IDS.supportedSession, "teacher"),
    denied,
  );
  const hidden = await student.actor.client
    .from("attempts")
    .select("*")
    .eq("session_id", DEMO_IDS.supportedSession);
  assert.equal(hidden.error, null);
  assert.deepEqual(hidden.data, []);
  const forbidden = await student.actor.client
    .from("evaluations")
    .insert(prepared.evaluations[0]);
  assert.ok(forbidden.error, "Students must not write grading evidence");
  const anonymous = createClient(config.url, config.publishableKey, {
    auth: { persistSession: false },
  });
  const anonRows = await anonymous.from("sessions").select("id");
  assert.ok(anonRows.error || anonRows.data?.length === 0);

  const session = await startSession(
    student,
    DEMO_IDS.assignmentId,
    "synthetic_fixture",
  );
  console.log(
    `Persistence probe session: ${session.id} (synthetic_fixture; retained for inspection).`,
  );
  const question = getCuratedQuestion(content, "NP-TX-01");
  await assert.rejects(
    presentQuestion(student, session.id, {
      question: { ...question, source_passage_ids: ["missing-passage"] },
      intent: "initial_retrieval",
    }),
  );
  const attempt = await presentQuestion(student, session.id, {
    question,
    intent: "initial_retrieval",
  });
  const reference = fixture.sessions[1].attempts[0];
  const submission = {
    attempt_id: attempt.id,
    submission_key: randomUUID(),
    response_text: reference.response_text ?? "",
  };
  await submitAnswer(student, session.id, submission);
  const first = await readSession(teacher, session.id, "teacher");
  await submitAnswer(student, session.id, submission);
  assert.deepEqual(
    (await readSession(teacher, session.id, "teacher")).attempts,
    first.attempts,
  );
  await assert.rejects(
    submitAnswer(student, session.id, {
      ...submission,
      response_text: "Changed answer",
    }),
  );
  await assert.rejects(submitAnswer(other, session.id, submission), denied);

  const failed = {
    id: randomUUID(),
    attempt_id: attempt.id,
    validation_status: "evaluation_failed" as const,
    evaluator: {
      type: "synthetic_fixture" as const,
      model: null,
      version: "persistence-check-v1",
    },
    supersedes_id: null,
    result: null,
    applied_result: null,
    failure_reason: "Deliberate persistence-check failure",
  };
  await recordEvaluation(student, session.id, failed);
  const acceptedSource = fixture.sessions[1].evaluations[0];
  assert.ok(acceptedSource.result);
  const accepted = await recordEvaluation(student, session.id, {
    ...failed,
    id: randomUUID(),
    validation_status: "accepted",
    failure_reason: null,
    result: {
      ...acceptedSource.result,
      evidence_quotes: acceptedSource.result.evidence_quotes.map((quote) => ({
        ...quote,
        response_id: attempt.id,
      })),
    },
    applied_result: null,
  });
  await recordEvaluation(student, session.id, { ...failed, id: randomUUID() });
  const afterFailure = await readSession(teacher, session.id, "teacher");
  assert.equal(afterFailure.attempts[0].current_evaluation_id, accepted.id);
  assert.equal(
    afterFailure.attempts[0].response_text,
    submission.response_text,
  );
  assert.equal(afterFailure.evaluations.length, 3);

  const feedback = prepared.interventions[0];
  const intervention = await recordIntervention(student, session.id, {
    id: randomUUID(),
    related_attempt_id: attempt.id,
    related_evaluation_id: accepted.id,
    type: feedback.type,
    text_shown: feedback.text_shown,
    concept_ids: feedback.concept_ids,
    source_passage_ids: feedback.source_passage_ids,
    content_ref: feedback.content_ref,
  });
  assert.equal(intervention.visible_at, null);
  await acknowledgeIntervention(student, session.id, intervention.id);
  const retestSource = prepared.attempts[2];
  const retest = await presentQuestion(student, session.id, {
    question: retestSource.question,
    intent: "immediate_retest",
    parent_attempt_id: attempt.id,
  });
  await submitAnswer(student, session.id, {
    attempt_id: retest.id,
    submission_key: randomUUID(),
    response_text: retestSource.response_text ?? "",
  });
  const helped = await readSession(teacher, session.id, "teacher");
  assert.equal(
    helped.attempts[1].assistance?.assistance_level,
    "corrective_feedback",
  );
  assert.ok(
    Object.values(
      helped.attempts[1].assistance
        ?.independent_retrieval_eligible_by_concept ?? {},
    ).every((eligible) => !eligible),
  );
  assert.deepEqual(
    helped.attempts[1].question.content_ref,
    content.content_ref,
  );

  // These bypass TypeScript intentionally to exercise database relationship guards.
  const crossStudent = await student.admin.from("attempts").insert({
    ...retest,
    id: randomUUID(),
    sequence_index: 10,
    parent_attempt_id: DEMO_IDS.correctRoot,
    root_attempt_id: DEMO_IDS.correctRoot,
  });
  assert.ok(
    crossStudent.error,
    "Cross-session parents must be rejected by SQL",
  );
  const wrongAssignment = await student.admin
    .from("sessions")
    .insert({ ...session, id: randomUUID(), class_id: randomUUID() });
  assert.ok(
    wrongAssignment.error,
    "Assignment and class mismatch must be rejected by SQL",
  );
  await finishSession(student, session.id, {
    root_attempt_id: attempt.id,
    concept_ids: question.concept_ids,
    hypothesis_instance_id: null,
    latest_hypothesis_status: null,
    outcome: "pending_evaluation",
    supporting_attempt_ids: [attempt.id, retest.id],
    intervention_ids: [intervention.id],
    next_review_at: null,
    review_policy_version: "persistence-check-v1",
    review_reason:
      "Synthetic persistence probe; no model evaluated the retest.",
  });
  assert.equal(
    (await readSession(teacher, session.id, "teacher")).session.status,
    "pending_evaluation",
  );
  console.log(
    "PASS: prepared interaction reconstruction, scoped access, safe student projection, idempotent answers, evaluation failure retention, assistance and SQL relationship boundaries.",
  );
}

checkPersistence().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Persistence verification failed.",
  );
  process.exitCode = 1;
});
