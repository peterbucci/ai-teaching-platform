import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  EvidenceError,
  presentQuestion,
  readSession,
  startSession,
  submitAnswer,
  type EvidenceAccess,
} from "../lib/evidence/store.ts";
import {
  applyTutoring,
  assignedLessons,
  continueTutoring,
  restartTutoring,
  startTutoring,
  studentStudyHistory,
  tutorView,
} from "../lib/tutoring/store.ts";
import {
  studentAssignmentWork,
  studentDashboard,
  studentSessionAssignment,
} from "../lib/tutoring/dashboard.ts";
import type { QuestionSnapshot } from "../lib/evidence/contracts.ts";
import { evaluateSubmittedAttempt } from "../lib/evaluation/evaluate.ts";
import { evaluationRecovery } from "../lib/evaluation/recovery.ts";
import type { requestEvaluation } from "../lib/evaluation/provider.ts";

/** Exercise the real PostgreSQL queries against a saved fictional follow-up.
 * Call from the outcome integration check after creating its recipient fixture. */
export async function checkInterventionTutorIsolation(
  access: EvidenceAccess,
  sessionId: string,
  assignmentId: string,
) {
  const before = await readSession(access, sessionId, "student");
  const attempt = before.attempts.at(-1);
  assert.ok(attempt, "The follow-up fixture must have its approved question");
  const notFound = (error: unknown) =>
    error instanceof EvidenceError && error.status === 404;
  await assert.rejects(tutorView(access, sessionId), notFound);
  await assert.rejects(restartTutoring(access, sessionId), notFound);
  await assert.rejects(
    applyTutoring(access, sessionId, randomUUID()),
    notFound,
  );
  await assert.rejects(studentSessionAssignment(access, sessionId), notFound);
  // Ensure this regression check can never spend model credits even if the
  // ordinary route accidentally stops enforcing its session boundary.
  const apiKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await assert.rejects(
      continueTutoring(access, sessionId, { attempt_id: attempt.id }),
      notFound,
    );
  } finally {
    if (apiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = apiKey;
  }
  const [lessons, history, dashboard, work] = await Promise.all([
    assignedLessons(access),
    studentStudyHistory(access),
    studentDashboard(access),
    studentAssignmentWork(access, assignmentId),
  ]);
  assert.ok(lessons.every((lesson) => lesson.session?.id !== sessionId));
  assert.ok(history.every((entry) => entry.id !== sessionId));
  assert.ok(
    dashboard.lessons.every((lesson) => lesson.session?.id !== sessionId),
  );
  assert.ok(work.sessions.every((session) => session.id !== sessionId));
  const ordinary = await startTutoring(access, assignmentId);
  assert.notEqual(ordinary.session.id, sessionId);
  assert.deepEqual(
    await readSession(access, sessionId, "student"),
    before,
    "Ordinary study operations must not mutate follow-up evidence",
  );
}

/** No network calls: injected outcomes exercise real evaluator persistence,
 * replay and recovery against fictional sessions in the check database. */
export async function checkInterventionEvaluatorRecovery(
  access: EvidenceAccess,
  assignmentId: string,
  question: QuestionSnapshot,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  process.env.OPENAI_API_KEY = "fixture-provider-never-used";
  process.env.OPENAI_MODEL = "intervention-recovery-fixture";
  try {
    const cases = [
      { code: "timeout", preserve: true },
      { code: "connection", preserve: true },
      { code: "provider_error", preserve: true },
      { code: "timeout", preserve: false },
    ] as const;
    for (const { code, preserve } of cases) {
      const session = await startSession(
        access,
        assignmentId,
        "synthetic_fixture",
      );
      const attempt = await presentQuestion(access, session.id, {
        question,
        intent: "immediate_retest",
      });
      await submitAnswer(access, session.id, {
        attempt_id: attempt.id,
        submission_key: randomUUID(),
        response_text:
          "Fictional follow-up response preserved during an uncertain request.",
      });
      let calls = 0;
      const provider: typeof requestEvaluation = async () => {
        calls++;
        return {
          ok: false,
          code,
          message: "Injected provider outcome; no real model request.",
          model: "intervention-recovery-fixture",
          latencyMs: 1,
        };
      };
      const options = preserve
        ? { provider, preserveUncertainProviderOutcome: true }
        : { provider };
      const first = await evaluateSubmittedAttempt(
        access,
        session.id,
        attempt.id,
        undefined,
        options,
      );
      assert.ok(first.evaluation);
      assert.equal(
        first.evaluation.validation_status,
        preserve ? "pending_review" : "evaluation_failed",
      );
      const saved = await readSession(access, session.id, "student");
      assert.equal(saved.attempts[0].current_evaluation_id, null);
      assert.equal(
        saved.attempts[0].response_text,
        "Fictional follow-up response preserved during an uncertain request.",
      );
      assert.equal(
        evaluationRecovery(saved.evaluations, Date.now() + 86_400_000).allowed,
        !preserve,
      );
      const replay = await evaluateSubmittedAttempt(
        access,
        session.id,
        attempt.id,
        undefined,
        options,
      );
      assert.equal(replay.reused, true);
      assert.equal(replay.evaluation?.id, first.evaluation?.id);
      await assert.rejects(
        evaluateSubmittedAttempt(
          access,
          session.id,
          attempt.id,
          first.evaluation.id,
          options,
        ),
        (error: unknown) =>
          error instanceof EvidenceError && error.status === 409,
      );
      assert.equal(
        calls,
        1,
        `${code} must not issue a duplicate provider call`,
      );
      assert.deepEqual(await readSession(access, session.id, "student"), saved);
    }
  } finally {
    if (apiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = apiKey;
    if (model === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = model;
  }
}
