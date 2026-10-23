import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPool } from "../lib/db.ts";
import { InterventionApprovalSchema } from "../lib/interventions/approval-contracts.ts";
import { QuestionSnapshotSchema } from "../lib/evidence/contracts.ts";
import {
  EvidenceError,
  readSession,
  type EvidenceAccess,
} from "../lib/evidence/store.ts";
import { evaluateSubmittedAttempt } from "../lib/evaluation/evaluate.ts";
import { evaluationRecovery } from "../lib/evaluation/recovery.ts";
import { ModelEvaluationSchema } from "../lib/evaluation/result.ts";
import type { requestEvaluation } from "../lib/evaluation/provider.ts";
import {
  applyStudentInterventionFollowup,
  projectInterventionFollowup,
} from "../lib/interventions/outcomes.ts";
import {
  StudentInterventionFollowupSchema,
  InterventionComparisonSchema,
} from "../lib/interventions/outcomes-contracts.ts";
import {
  checkInterventionTutorIsolation,
  checkInterventionEvaluatorRecovery,
} from "./intervention-isolation-checks.ts";

type Actor = { cookie: string; access: EvidenceAccess };
type Request = (
  path: string,
  cookie?: string,
  body?: unknown,
) => Promise<Response>;

/** Synthetic provider only; real HTTP authorization, PostgreSQL and the shared evaluator. */
export async function checkInterventionFollowupLessons(context: {
  kind: string;
  draftId: string;
  approvalId: string;
  teacher: Actor;
  student: Actor;
  outsider: Actor;
  request: Request;
  createDelivered: () => Promise<{ draftId: string; approvalId: string }>;
}) {
  const { kind, teacher, student, outsider, request } = context;
  const db = getPool();
  const approvalRows = await db.query(
    "SELECT snapshot FROM teacher_intervention_approvals WHERE id=$1",
    [context.approvalId],
  );
  const approval = InterventionApprovalSchema.parse(
    approvalRows.rows[0].snapshot,
  );
  const originalSessions = await Promise.all(
    [
      ...new Set(approval.evidence.observations.map((item) => item.session_id)),
    ].map(async (id) => ({
      id,
      evidence: await readSession(teacher.access, id, "teacher"),
    })),
  );
  let calls = 0;
  const provider: typeof requestEvaluation = async (prompt) => {
    calls++;
    const input = z
      .object({
        question: QuestionSnapshotSchema,
        student_response: z.string(),
      })
      .parse(JSON.parse(prompt.input));
    return {
      ok: true,
      needsReconciliation: false,
      model: "synthetic-followup-integration",
      responseId: `fixture-${randomUUID()}`,
      latencyMs: 0,
      usage: null,
      result: ModelEvaluationSchema.parse({
        per_concept_results: input.question.concept_ids.map((concept_id) => ({
          concept_id,
          correctness: "correct",
          error_type: null,
          rubric_criteria_met: input.question.rubric.criteria,
          rubric_criteria_missing: [],
        })),
        source_passage_ids: input.question.source_passage_ids,
        evidence_quotes: [
          {
            quote: input.student_response,
            interpretation:
              "Synthetic validation of exact response linkage; not model quality evidence.",
          },
        ],
        misconception_candidates: [],
        reasoning_observed:
          "Synthetic fixture exercises the real evaluation validator.",
        uncertainty_reason: null,
        proposed_next_action: "SCHEDULE_REVIEW",
      }),
    };
  };
  const timeout: typeof requestEvaluation = async () => {
    calls++;
    return {
      ok: false,
      needsReconciliation: true,
      code: "timeout",
      message: "Injected unknown transport outcome; zero paid calls.",
      model: "synthetic-followup-timeout",
      latencyMs: 0,
    };
  };
  const notFound = (error: unknown) =>
    error instanceof EvidenceError && error.status === 404;
  const conflict = (error: unknown) =>
    error instanceof EvidenceError && error.status === 409;
  async function read(approvalId: string, body?: unknown) {
    const response = await request(
      `/api/student/interventions/${approvalId}/followup`,
      student.cookie,
      body,
    );
    assert.equal(response.status, 200, await response.clone().text());
    return StudentInterventionFollowupSchema.parse(await response.json());
  }
  async function session(approvalId: string) {
    const found = await db.query(
      "SELECT session_id FROM teacher_intervention_followups WHERE approval_id=$1 AND student_id=$2",
      [approvalId, student.access.actor.profileId],
    );
    return z.uuid().parse(found.rows[0]?.session_id);
  }
  async function boundaries(sessionId: string, attemptId: string) {
    const before = await readSession(student.access, sessionId, "student");
    const startCalls = calls;
    const root = `/api/tutoring/${sessionId}`;
    for (const [path, body] of [
      [root, undefined],
      [root, { attempt_id: attemptId }],
      [`${root}/conversation`, undefined],
      [
        `${root}/conversation`,
        {
          version: "r7-conversation-v1",
          action: "send_message",
          request_id: randomUUID(),
          session_id: sessionId,
          attempt_id: attemptId,
          expected_revision: 0,
          text: "Help me reason about this.",
        },
      ],
      [
        `${root}/conversation/display`,
        {
          version: "r7-v1",
          request_id: randomUUID(),
          session_id: sessionId,
          expected_revision: 0,
          accepted_event_id: randomUUID(),
          content_id: randomUUID(),
        },
      ],
      [`${root}/conversation/operations/${randomUUID()}`, undefined],
      [
        `/api/sessions/${sessionId}/answers`,
        {
          attempt_id: attemptId,
          submission_key: randomUUID(),
          response_text: "This bypass must never be saved.",
        },
      ],
    ] as const) {
      const response = await request(path, student.cookie, body);
      assert.equal(response.status, 404, `${path}: ${await response.text()}`);
    }
    await checkInterventionTutorIsolation(
      student.access,
      sessionId,
      before.session.assignment_id,
    );
    assert.deepEqual(
      await readSession(student.access, sessionId, "student"),
      before,
    );
    assert.equal(calls, startCalls);
    const mutations = await db.query(
      "SELECT (SELECT count(*) FROM dialogue_sessions WHERE session_id=$1)::int AS sessions,(SELECT count(*) FROM dialogue_provider_calls WHERE session_id=$1)::int AS calls",
      [sessionId],
    );
    assert.deepEqual(mutations.rows, [{ sessions: 0, calls: 0 }]);
  }
  const path = `/api/student/interventions/${context.approvalId}/followup`;
  assert.equal((await request(path)).status, 401);
  for (const actor of [teacher, outsider]) {
    assert.equal((await request(path, actor.cookie)).status, 404);
    assert.equal(
      (await request(path, actor.cookie, { action: "start" })).status,
      404,
    );
  }
  assert.equal((await read(context.approvalId)).started_at, null);
  const started = await read(context.approvalId, { action: "start" });
  assert.ok(started.attempt_id);
  assert.deepEqual(
    await read(context.approvalId, { action: "start" }),
    started,
  );
  const sessionId = await session(context.approvalId);
  await boundaries(sessionId, started.attempt_id);
  const answer = {
    action: "submit",
    request_id: randomUUID(),
    response_text:
      kind === "uploaded"
        ? "Evaporation changes liquid water into water vapor. The water remains present in its gas state; it does not disappear."
        : "Transmission delay stays the same because packet size and transmission rate are unchanged. Propagation delay increases because the same cable distance is divided by a lower signal speed. The delays depend on different quantities.",
  } as const;
  await Promise.all(
    [1, 2].map(() =>
      applyStudentInterventionFollowup(
        student.access,
        context.approvalId,
        answer,
        { provider },
      ),
    ),
  );
  assert.equal(calls, 1);
  const accepted = await read(context.approvalId);
  assert.equal(accepted.evaluation_status, "accepted");
  assert.equal(accepted.evaluation_provenance, "injected_fixture");
  assert.equal(accepted.response_text, answer.response_text);
  assert.ok(accepted.assistance?.intervention_ids.length);
  assert.ok(
    Object.values(
      accepted.assistance.independent_retrieval_eligible_by_concept,
    ).every((value) => !value),
  );
  for (const key of [
    "rubric",
    "reasoning_observed",
    "criteria",
    "answer_guidance",
  ])
    assert.ok(!JSON.stringify(accepted).includes(`"${key}":`));
  assert.deepEqual(await read(context.approvalId, answer), accepted);
  await boundaries(sessionId, started.attempt_id);
  const comparisonPath = `/api/teacher/interventions/${context.draftId}/followup`;
  const compared = await request(comparisonPath, teacher.cookie);
  assert.equal(compared.status, 200);
  const comparison = InterventionComparisonSchema.parse(await compared.json());
  assert.equal(comparison.counts.accepted, 1);
  assert.deepEqual(comparison.original_evidence, approval.evidence);
  for (const original of originalSessions)
    assert.deepEqual(
      await readSession(teacher.access, original.id, "teacher"),
      original.evidence,
    );
  assert.equal(
    comparison.recipients[0].attempt?.response_text,
    answer.response_text,
  );
  assert.deepEqual(
    comparison.content_ref,
    comparison.recipients[0].attempt?.question.content_ref,
  );
  assert.equal((await request(comparisonPath, student.cookie)).status, 404);
  assert.equal((await request(comparisonPath, outsider.cookie)).status, 404);
  const saved = await readSession(student.access, sessionId, "student");
  await checkInterventionEvaluatorRecovery(
    student.access,
    saved.session.assignment_id,
    saved.attempts[0].question,
  );
  // A separate delivery tests an unknown outcome without editing the accepted answer.
  const uncertain = await context.createDelivered();
  await read(uncertain.approvalId, { action: "start" });
  const uncertainAnswer = {
    action: "submit",
    request_id: randomUUID(),
    response_text:
      "Original answer remains intact after an unknown provider outcome.",
  } as const;
  const pending = await applyStudentInterventionFollowup(
    student.access,
    uncertain.approvalId,
    uncertainAnswer,
    { provider: timeout },
  );
  assert.equal(pending.evaluation_status, "pending");
  assert.equal(pending.retry_allowed, false);
  assert.equal(calls, 2);
  const uncertainSession = await session(uncertain.approvalId);
  const evidence = await readSession(
    student.access,
    uncertainSession,
    "student",
  );
  assert.equal(evidence.evaluations.length, 2);
  const [reservation, outcome] = evidence.evaluations;
  assert.equal(reservation.validation_status, "pending_review");
  assert.equal(reservation.evaluator.model, "injected-fixture");
  assert.equal(outcome.validation_status, "evaluation_failed");
  assert.equal(outcome.evaluator.provider_outcome, "unknown");
  assert.equal(outcome.evaluator.provider_reservation_id, reservation.id);
  assert.equal(evidence.attempts[0].submission_key, uncertainAnswer.request_id);
  assert.equal(
    evidence.attempts[0].response_text,
    uncertainAnswer.response_text,
  );
  assert.equal(
    evaluationRecovery(evidence.evaluations, Date.now() + 7 * 86400000).allowed,
    false,
  );
  assert.equal(
    projectInterventionFollowup(
      uncertain.approvalId,
      evidence,
      [],
      Date.now() + 7 * 86400000,
    ).retry_allowed,
    false,
  );
  assert.deepEqual(await read(uncertain.approvalId, uncertainAnswer), pending);
  await assert.rejects(
    applyStudentInterventionFollowup(
      student.access,
      uncertain.approvalId,
      { ...uncertainAnswer, request_id: randomUUID() },
      { provider },
    ),
    conflict,
  );
  await assert.rejects(
    applyStudentInterventionFollowup(
      student.access,
      uncertain.approvalId,
      {
        action: "retry",
        request_id: randomUUID(),
        expected_evaluation_id: outcome.id,
      },
      { provider },
    ),
    conflict,
  );
  await assert.rejects(
    evaluateSubmittedAttempt(
      student.access,
      uncertainSession,
      evidence.attempts[0].id,
      outcome.id,
      { provider },
    ),
    conflict,
  );
  await assert.rejects(
    applyStudentInterventionFollowup(
      outsider.access,
      uncertain.approvalId,
      { action: "start" },
      { provider },
    ),
    notFound,
  );
  await boundaries(uncertainSession, evidence.attempts[0].id);
  const ledger = await db.query(
    `SELECT count(*)::int AS spent, count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM evaluations later WHERE later.attempt_id=e.attempt_id AND later.evaluated_at>e.evaluated_at AND (later.validation_status IN ('accepted','rejected') OR (later.validation_status='evaluation_failed' AND later.evaluator->>'provider_outcome'='settled' AND later.evaluator->>'provider_reservation_id'=e.id::text))))::int AS unresolved FROM evaluations e WHERE e.attempt_id=$1 AND e.validation_status='pending_review'`,
    [evidence.attempts[0].id],
  );
  assert.deepEqual(ledger.rows, [{ spent: 1, unresolved: 1 }]);
  assert.deepEqual(
    await readSession(student.access, uncertainSession, "student"),
    evidence,
  );
  assert.equal(calls, 2);
  return `${kind}: HTTP start/reload, private accepted evaluation and teacher comparison; ordinary answer/controller/R7 routes denied; unknown outcome retains one spent unresolved reservation, exact answer and no replay/retry. Six injected evaluations; zero paid calls.`;
}
