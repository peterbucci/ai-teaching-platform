import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { evidenceRow } from "../db.ts";
import {
  loadApprovedContent,
  getCuratedQuestion,
  validateContentRef,
} from "../evidence/content.ts";
import {
  AppliedResultSchema,
  AttemptSchema,
  InterventionSchema,
  SessionSchema,
} from "../evidence/contracts.ts";
import {
  toStudentSessionView,
  validateSessionEvidence,
} from "../evidence/rules.ts";
import {
  EvidenceError,
  readSession,
  sessionEvidence,
  transaction,
  type EvidenceAccess,
} from "../evidence/store.ts";
import { evaluateSubmittedAttempt } from "../evaluation/evaluate.ts";
import { evaluationRecovery } from "../evaluation/recovery.ts";
import { TutorStepSchema, TutorViewSchema } from "./contracts.ts";
import { decideTutoring, tutoringOutcome } from "./decide.ts";

export async function assignedLessons(access: EvidenceAccess) {
  return transaction(async (client) => {
    const rows = await client.query(
      `SELECT a.id,a.title,a.content_ref FROM assignments a
      JOIN enrollments e ON e.class_id=a.class_id WHERE e.student_id=$1 AND a.teacher_approved_at IS NOT NULL ORDER BY a.id`,
      [access.actor.profileId],
    );
    const content = loadApprovedContent();
    return rows.rows.map((row) => {
      const assignment = z
        .object({ id: z.uuid(), title: z.string(), content_ref: z.unknown() })
        .parse(row);
      validateContentRef(content, assignment.content_ref);
      return {
        id: assignment.id,
        title: assignment.title,
        approval_label: "Approved by your teacher",
      };
    });
  });
}

export async function tutorView(access: EvidenceAccess, sessionId: string) {
  const evidence = await readSession(access, sessionId, "student");
  const last = evidence.attempts.at(-1);
  const runs = evidence.evaluations.filter((e) => e.attempt_id === last?.id);
  const recovery = evaluationRecovery(runs, Date.now());
  const pendingHelp = evidence.interventions.some(
    (i) => i.delivery_status === "created" && i.type !== "reading",
  );
  const phase = pendingHelp
    ? "feedback"
    : evidence.session.status !== "active"
      ? "completed"
      : last?.submitted_at === null
        ? "answer"
        : recovery.failed
          ? "failed"
          : "evaluate";
  const content = loadApprovedContent();
  return TutorViewSchema.parse({
    ...toStudentSessionView(evidence),
    pending_reading: (() => {
      const pending = evidence.interventions.find(
        (item) => item.type === "reading" && item.delivery_status === "created",
      );
      return pending
        ? {
            intervention_id: pending.id,
            passage_id: pending.source_passage_ids[0],
          }
        : null;
    })(),
    interventions: toStudentSessionView(evidence).interventions.map((i) => ({
      ...i,
      related_attempt_id: evidence.interventions.find(
        (stored) => stored.id === i.id,
      )?.related_attempt_id,
    })),
    progress: {
      phase,
      current_attempt_id: last?.id ?? null,
      failed_evaluation_id: recovery.failed?.id ?? null,
      retry_allowed: recovery.allowed,
      retry_after: recovery.retryAfter,
      next_review_at: evidence.attempts[0]?.outcome?.next_review_at ?? null,
      message:
        phase === "completed"
          ? evidence.session.status === "unevaluated"
            ? "Your work is saved. Ask your teacher for help before continuing."
            : "Practice complete. This records today's performance, not lasting mastery."
          : phase === "failed"
            ? recovery.unfinished
              ? "Evaluation is still pending. Check progress shortly. If it stays pending, ask your teacher to check the service; another paid request will not be sent automatically."
              : recovery.exhausted
                ? "Your answer is saved. Please ask your teacher for help; the retry limit has been reached."
                : "Your answer is saved, but evaluation did not finish reliably. Wait a minute, then choose Retry evaluation."
            : phase === "feedback"
              ? "Read the feedback, then continue."
              : phase === "evaluate"
                ? "Your answer is saved and ready for evaluation."
                : "Explain your thinking in your own words.",
    },
    citations: evidence.interventions
      .filter((i) => i.type !== "fallback" && i.type !== "reading")
      .flatMap((i) =>
        i.source_passage_ids.map((id) => {
          const passage = content.passages.get(id);
          if (!passage)
            throw new EvidenceError(503, "A source passage is unavailable.");
          return {
            intervention_id: i.id,
            passage_id: id,
            content_version: i.content_ref.content_version,
            text: passage.text,
            url: passage.url,
          };
        }),
      ),
  });
}

/** Resume is idempotent for the seeded assignment. A completed episode remains
 * readable; future scheduled practice is a distinct workflow, not an implicit reset. */
export async function startTutoring(
  access: EvidenceAccess,
  assignmentId: string,
) {
  z.uuid().parse(assignmentId);
  const sessionId = await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `start-tutor:${access.actor.profileId}:${assignmentId}`,
    ]);
    const rows = await client.query(
      `SELECT a.* FROM assignments a JOIN enrollments e ON e.class_id=a.class_id
      WHERE a.id=$1 AND e.student_id=$2 FOR SHARE OF a,e`,
      [assignmentId, access.actor.profileId],
    );
    if (!rows.rows[0]) throw new EvidenceError(404, "Assignment not found.");
    const assignment = z
      .object({
        id: z.uuid(),
        class_id: z.uuid(),
        content_ref: z.unknown(),
        teacher_approved_at: z.unknown(),
      })
      .parse(rows.rows[0]);
    const content = loadApprovedContent();
    validateContentRef(content, assignment.content_ref);
    if (!assignment.teacher_approved_at)
      throw new EvidenceError(
        409,
        "Your teacher needs to activate this assignment first. Your previous work is still saved.",
      );
    const existing = await client.query(
      "SELECT id FROM sessions WHERE assignment_id=$1 AND student_id=$2 AND data_origin='live_demo' ORDER BY started_at DESC LIMIT 1",
      [assignmentId, access.actor.profileId],
    );
    let id: string;
    if (existing.rows[0])
      id = z.object({ id: z.uuid() }).parse(existing.rows[0]).id;
    else {
      const row = await client.query(
        "INSERT INTO sessions(id,student_id,assignment_id,class_id,data_origin) VALUES($1,$2,$3,$4,'live_demo') RETURNING *",
        [
          randomUUID(),
          access.actor.profileId,
          assignmentId,
          assignment.class_id,
        ],
      );
      id = SessionSchema.parse(evidenceRow(row.rows[0])).id;
    }
    const evidence = await sessionEvidence(client, access, id, "student", true);
    if (!evidence.attempts.length && evidence.session.status === "active") {
      const attemptId = randomUUID();
      const question = getCuratedQuestion(
        content,
        content.sequence.initial_question_id,
      );
      await client.query(
        "INSERT INTO attempts(id,session_id,sequence_index,root_attempt_id,question,intent) VALUES($1,$2,0,$1,$3::jsonb,'initial_retrieval')",
        [attemptId, id, JSON.stringify(question)],
      );
    }
    return id;
  });
  return tutorView(access, sessionId);
}

/** All decision effects commit together under the authorized session lock. */
export async function applyTutoring(
  access: EvidenceAccess,
  sessionId: string,
  evaluationId: string,
) {
  await transaction(async (client) => {
    const evidence = await sessionEvidence(
      client,
      access,
      sessionId,
      "student",
      true,
    );
    const evaluation = evidence.evaluations.find((e) => e.id === evaluationId);
    if (!evaluation) throw new EvidenceError(404, "Evaluation not found.");
    if (evaluation.applied_result) return; // Repeat request reads the same durable progress.
    const attempt = evidence.attempts.at(-1);
    if (!attempt || attempt.id !== evaluation.attempt_id)
      throw new EvidenceError(
        409,
        "This answer is no longer the current step.",
      );
    const clock = await client.query(
      "SELECT to_jsonb(clock_timestamp()) AS now",
    );
    const { now } = z
      .object({ now: z.iso.datetime({ offset: true }) })
      .parse(evidenceRow(clock.rows[0]));
    const content = loadApprovedContent();
    const decision = decideTutoring(content, evidence, evaluationId, now);
    const applied = AppliedResultSchema.parse(decision.applied);
    evaluation.applied_result = applied;
    validateSessionEvidence(content, evidence);
    await client.query(
      "UPDATE evaluations SET applied_result=$2::jsonb WHERE id=$1 AND applied_result IS NULL",
      [evaluationId, JSON.stringify(applied)],
    );
    if (decision.help) {
      const intervention = InterventionSchema.parse({
        ...decision.help,
        id: randomUUID(),
        session_id: sessionId,
        related_attempt_id: attempt.id,
        related_evaluation_id: evaluationId,
        content_ref: attempt.question.content_ref,
        created_at: now,
        visible_at: null,
        delivery_status: "created",
      });
      await client.query(
        "INSERT INTO interventions SELECT (jsonb_populate_record(NULL::interventions,$1::jsonb)).*",
        [JSON.stringify(intervention)],
      );
      evidence.interventions.push(intervention);
    }
    if (decision.nextQuestionId) {
      const question = getCuratedQuestion(content, decision.nextQuestionId);
      const node = content.sequence.nodes.find(
        (n) => n.node_id === question.question_id,
      );
      const intent =
        decision.applied.action === "ASK_RETRIEVAL_QUESTION"
          ? attempt.intent
          : node?.kind;
      const next = AttemptSchema.parse({
        ...attempt,
        id: randomUUID(),
        parent_attempt_id: attempt.id,
        question,
        intent,
        sequence_index: attempt.sequence_index + 1,
        presented_at: now,
        submitted_at: null,
        response_text: null,
        submission_key: null,
        assistance: null,
        current_evaluation_id: null,
        outcome: null,
      });
      await client.query(
        "INSERT INTO attempts SELECT (jsonb_populate_record(NULL::attempts,$1::jsonb)).*",
        [JSON.stringify(next)],
      );
      evidence.attempts.push(next);
    }
    const outcome = tutoringOutcome(
      evidence,
      attempt,
      evaluation,
      decision,
      now,
    );
    if (outcome)
      await client.query("SELECT * FROM finish_session($1,$2,$3::jsonb,$4)", [
        sessionId,
        attempt.root_attempt_id,
        JSON.stringify(outcome),
        outcome.outcome === "unevaluated" ? "unevaluated" : "completed",
      ]);
    validateSessionEvidence(content, evidence);
  });
  return tutorView(access, sessionId);
}

export async function continueTutoring(
  access: EvidenceAccess,
  sessionId: string,
  input: unknown,
) {
  const step = TutorStepSchema.parse(input);
  const run = await evaluateSubmittedAttempt(
    access,
    sessionId,
    step.attempt_id,
    step.retry_of,
  );
  if (run.evaluation?.validation_status === "accepted")
    return applyTutoring(access, sessionId, run.evaluation.id);
  if (!run.evaluation)
    throw new EvidenceError(
      503,
      "Your answer is saved. Evaluation is unavailable; please ask your teacher to check the service before trying again.",
    );
  return tutorView(access, sessionId);
}
