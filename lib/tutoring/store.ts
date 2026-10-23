import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { evidenceRow } from "../db.ts";
import {
  loadApprovedContent,
  getCuratedQuestion,
  validateContentRef,
  validateQuestionSnapshot,
  type ApprovedContent,
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
  readStudentDeliveryContext,
  sessionEvidence,
  transaction,
  type EvidenceAccess,
} from "../evidence/store.ts";
import { evaluateSubmittedAttempt } from "../evaluation/evaluate.ts";
import { evaluationRecovery } from "../evaluation/recovery.ts";
import { sourcePath } from "../reading/source-path.ts";
import type { StudentHistoryEntry } from "./history-model.ts";
import {
  AssignedLessonSchema,
  TutorStepSchema,
  TutorViewSchema,
} from "./contracts.ts";
import { decideTutoring, tutoringOutcome } from "./decide.ts";
import { bindGeneratedQuestion, controllerNode } from "./generated-question.ts";
import {
  GeneratedDialogueSchema,
  type GeneratedDialogue,
} from "../dialogue/contracts.ts";

export async function assignedLessons(access: EvidenceAccess) {
  return transaction(async (client) => {
    const rows = await client.query(
      `SELECT a.id,a.title,a.content_ref,latest.session FROM assignments a
      JOIN enrollments e ON e.class_id=a.class_id
      LEFT JOIN LATERAL (
        SELECT jsonb_build_object('id',s.id,'status',s.status) AS session
        FROM sessions s WHERE s.assignment_id=a.id AND s.class_id=a.class_id
          AND s.student_id=e.student_id AND s.data_origin='live_demo'
        ORDER BY s.started_at DESC,s.id DESC LIMIT 1
      ) latest ON true
      WHERE e.student_id=$1 AND a.teacher_approved_at IS NOT NULL ORDER BY a.id`,
      [access.actor.profileId],
    );
    const content = loadApprovedContent();
    return rows.rows.map((row) => {
      const assignment = z
        .object({
          id: z.uuid(),
          title: z.string(),
          content_ref: z.unknown(),
          session: AssignedLessonSchema.shape.session,
        })
        .parse(row);
      validateContentRef(content, assignment.content_ref);
      return AssignedLessonSchema.parse({
        id: assignment.id,
        title: assignment.title,
        approval_label: "Approved by your teacher",
        session: assignment.session,
      });
    });
  });
}

/** A student's journal contains only their live demo work in classes they still
 * belong to. Opening the journal reads evidence and never starts an evaluation. */
export async function studentStudyHistory(
  access: EvidenceAccess,
): Promise<StudentHistoryEntry[]> {
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    const rows = await client.query(
      `SELECT s.id,s.assignment_id,s.status,s.started_at,s.ended_at,a.title,a.content_ref,
        c.id AS class_id,c.name AS class_name,
        submitted.response_count,submitted.questions,
        EXISTS (SELECT 1 FROM interventions i WHERE i.session_id=s.id
          AND i.type='reading' AND i.delivery_status='displayed') AS reading_opened
       FROM sessions s
       JOIN assignments a ON a.id=s.assignment_id AND a.class_id=s.class_id
       JOIN classes c ON c.id=s.class_id
       JOIN enrollments e ON e.class_id=s.class_id AND e.student_id=s.student_id
       JOIN profiles p ON p.id=s.student_id
       CROSS JOIN LATERAL (
         SELECT count(*)::integer AS response_count,
           coalesce(jsonb_agg(t.question ORDER BY t.sequence_index,t.id),'[]'::jsonb) AS questions
         FROM attempts t WHERE t.session_id=s.id AND t.submitted_at IS NOT NULL
       ) submitted
       WHERE s.student_id=$1 AND p.auth_user_id=$2 AND s.data_origin='live_demo'
       ORDER BY s.started_at DESC,s.id DESC`,
      [access.actor.profileId, access.actor.userId],
    );
    const content = loadApprovedContent();
    return rows.rows.map((row) => {
      const entry = z
        .object({
          id: z.uuid(),
          assignment_id: z.uuid(),
          status: SessionSchema.shape.status,
          started_at: z.iso.datetime({ offset: true }),
          ended_at: z.iso.datetime({ offset: true }).nullable(),
          title: z.string().min(1),
          class_id: z.uuid(),
          class_name: z.string().min(1),
          content_ref: z.unknown(),
          response_count: z.number().int().nonnegative(),
          reading_opened: z.boolean(),
          questions: z.array(z.unknown()),
        })
        .parse(evidenceRow(row));
      const reference = validateContentRef(content, entry.content_ref);
      const practicedIds = new Set(
        entry.questions.flatMap(
          (question) => validateQuestionSnapshot(content, question).concept_ids,
        ),
      );
      return {
        id: entry.id,
        assignment_id: entry.assignment_id,
        title: entry.title,
        status: entry.status,
        started_at: entry.started_at,
        ended_at: entry.ended_at,
        response_count: entry.response_count,
        reading_opened: entry.reading_opened,
        classId: entry.class_id,
        className: entry.class_name,
        sourceKey: JSON.stringify([
          content.attribution.title,
          content.attribution.authors,
          content.attribution.copyright,
        ]),
        sourceTitle: content.attribution.title,
        sourceSection: content.attribution.section,
        sourcePath: sourcePath(content.attribution.section, reference),
        topics: [...practicedIds].map((id) => {
          const concept = content.concepts.get(id);
          if (!concept)
            throw new EvidenceError(503, "This saved topic is unavailable.");
          return { id, title: concept.title };
        }),
      };
    });
  });
}

export async function tutorView(access: EvidenceAccess, sessionId: string) {
  const { evidence, controllerInterventions } =
    await readStudentDeliveryContext(access, sessionId);
  const studentView = toStudentSessionView({
    ...evidence,
    interventions: controllerInterventions,
  });
  const last = evidence.attempts.at(-1);
  const runs = evidence.evaluations.filter((e) => e.attempt_id === last?.id);
  const recovery = evaluationRecovery(runs, Date.now());
  const pendingHelp = controllerInterventions.some(
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
    ...studentView,
    session: {
      id: evidence.session.id,
      status: evidence.session.status,
      started_at: evidence.session.started_at,
      ended_at: evidence.session.ended_at,
    },
    pending_reading: (() => {
      const pending = controllerInterventions.find(
        (item) => item.type === "reading" && item.delivery_status === "created",
      );
      return pending
        ? {
            intervention_id: pending.id,
            passage_id: pending.source_passage_ids[0],
          }
        : null;
    })(),
    interventions: studentView.interventions.map((i) => ({
      ...i,
      related_attempt_id: controllerInterventions.find(
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
    citations: controllerInterventions
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

/** Ordinary start always resumes the latest saved episode, including completed work. */
export async function startTutoring(
  access: EvidenceAccess,
  assignmentId: string,
) {
  z.uuid().parse(assignmentId);
  const sessionId = await transaction((client) =>
    openTutoringSession(client, access, assignmentId),
  );
  return tutorView(access, sessionId);
}

/** The completed source is the restart intent: repeating it reuses the newest
 * episode. A further new session requires that newest completed episode's ID. */
export async function restartTutoring(
  access: EvidenceAccess,
  completedSessionId: string,
) {
  z.uuid().parse(completedSessionId);
  const sessionId = await transaction(async (client) => {
    // Authorize before using any source assignment ID for the shared start lock.
    // Do not acquire a session row lock first: start uses the advisory lock first.
    const rows = await client.query(
      `SELECT s.assignment_id,s.status FROM sessions s
       JOIN enrollments e ON e.class_id=s.class_id AND e.student_id=s.student_id
       JOIN profiles p ON p.id=s.student_id
       WHERE s.id=$1 AND s.student_id=$2 AND p.auth_user_id=$3
         AND s.data_origin='live_demo'`,
      [completedSessionId, access.actor.profileId, access.actor.userId],
    );
    if (!rows.rows[0]) throw new EvidenceError(404, "Session not found.");
    const source = z
      .object({ assignment_id: z.uuid(), status: SessionSchema.shape.status })
      .parse(rows.rows[0]);
    if (source.status !== "completed")
      throw new EvidenceError(
        409,
        "Finish this study session before starting a new one.",
      );
    return openTutoringSession(
      client,
      access,
      source.assignment_id,
      completedSessionId,
    );
  });
  return tutorView(access, sessionId);
}

async function openTutoringSession(
  client: PoolClient,
  access: EvidenceAccess,
  assignmentId: string,
  completedSessionId?: string,
) {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    `start-tutor:${access.actor.profileId}:${assignmentId}`,
  ]);
  const rows = await client.query(
    `SELECT a.* FROM assignments a JOIN enrollments e ON e.class_id=a.class_id
     JOIN profiles p ON p.id=e.student_id
     WHERE a.id=$1 AND e.student_id=$2 AND p.auth_user_id=$3 FOR SHARE OF a,e,p`,
    [assignmentId, access.actor.profileId, access.actor.userId],
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
    `SELECT id FROM sessions WHERE assignment_id=$1 AND student_id=$2
       AND class_id=$3 AND data_origin='live_demo'
     ORDER BY started_at DESC,id DESC LIMIT 1`,
    [assignmentId, access.actor.profileId, assignment.class_id],
  );
  const latestId = existing.rows[0]
    ? z.object({ id: z.uuid() }).parse(existing.rows[0]).id
    : null;
  // A stale restart must never repair, reset or create work on the newer episode.
  if (completedSessionId && latestId !== completedSessionId) {
    if (!latestId) throw new EvidenceError(404, "Session not found.");
    return latestId;
  }
  let id = latestId;
  if (!id || completedSessionId) {
    const row = await client.query(
      "INSERT INTO sessions(id,student_id,assignment_id,class_id,data_origin) VALUES($1,$2,$3,$4,'live_demo') RETURNING *",
      [randomUUID(), access.actor.profileId, assignmentId, assignment.class_id],
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
}

export type TutoringHandoff = {
  content?: ApprovedContent;
  generatedQuestion?: Extract<GeneratedDialogue, { kind: "question" }>;
  generatedHelp?: Extract<GeneratedDialogue, { kind: "help" }>;
};

/** Reuse the existing controller effects inside an already-owned session transaction.
 * No provider work occurs here; the caller supplies independently reviewed output. */
export async function applyTutoringInTransaction(
  client: PoolClient,
  access: EvidenceAccess,
  sessionId: string,
  evaluationId: string,
  handoff: TutoringHandoff = {},
) {
  const evidence = await sessionEvidence(
    client,
    access,
    sessionId,
    "student",
    true,
  );
  const evaluation = evidence.evaluations.find((e) => e.id === evaluationId);
  if (!evaluation) throw new EvidenceError(404, "Evaluation not found.");
  if (evaluation.applied_result) return null;
  const attempt = evidence.attempts.at(-1);
  if (!attempt || attempt.id !== evaluation.attempt_id)
    throw new EvidenceError(409, "This answer is no longer the current step.");
  const clock = await client.query("SELECT to_jsonb(clock_timestamp()) AS now");
  const { now } = z
    .object({ now: z.iso.datetime({ offset: true }) })
    .parse(evidenceRow(clock.rows[0]));
  const content = handoff.content ?? loadApprovedContent();
  validateContentRef(content, attempt.question.content_ref);
  const decision = decideTutoring(content, evidence, evaluationId, now);
  if (handoff.generatedHelp && handoff.generatedQuestion)
    throw new EvidenceError(409, "Only one instructional tool may be applied.");
  const generatedQuestion = handoff.generatedQuestion
    ? bindGeneratedQuestion(
        content,
        evidence,
        decision,
        handoff.generatedQuestion,
      )
    : null;
  if (handoff.generatedHelp) {
    const help = GeneratedDialogueSchema.parse(handoff.generatedHelp);
    if (
      help.kind !== "help" ||
      decision.applied.action !== "GIVE_CORRECTIVE_FEEDBACK" ||
      !decision.help ||
      help.assistance_type === "neutral_clarification" ||
      help.concept_ids.length !== decision.help.concept_ids.length ||
      help.concept_ids.some((id) => !decision.help!.concept_ids.includes(id)) ||
      help.source_passage_ids.some((id) => !content.passage_ids.has(id))
    )
      throw new EvidenceError(
        409,
        "Generated help is not authorized for this controller action.",
      );
    validateContentRef(content, help.content_ref);
    decision.help = {
      type: help.assistance_type,
      text_shown: help.text,
      concept_ids: help.concept_ids,
      source_passage_ids: help.source_passage_ids,
    };
  }
  const applied = AppliedResultSchema.parse(decision.applied);
  evaluation.applied_result = applied;
  validateSessionEvidence(content, evidence);
  await client.query(
    "UPDATE evaluations SET applied_result=$2::jsonb WHERE id=$1 AND applied_result IS NULL",
    [evaluationId, JSON.stringify(applied)],
  );
  let interventionId: string | null = null;
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
    interventionId = intervention.id;
  }
  let nextAttemptId: string | null = null;
  if (decision.nextQuestionId) {
    // An unsupported response repeats the same immutable generated snapshot; its
    // UUID must not create an extra slot or restart the authored retry budget.
    const repeatGenerated =
      decision.applied.action === "ASK_RETRIEVAL_QUESTION" &&
      attempt.question.origin === "generated" &&
      controllerNode(content, attempt).node_id === decision.nextQuestionId;
    const question =
      generatedQuestion ??
      (repeatGenerated
        ? attempt.question
        : getCuratedQuestion(content, decision.nextQuestionId));
    const node = content.sequence.nodes.find(
      (n) => n.node_id === decision.nextQuestionId,
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
    nextAttemptId = next.id;
  }
  const outcome = tutoringOutcome(evidence, attempt, evaluation, decision, now);
  if (outcome)
    await client.query("SELECT * FROM finish_session($1,$2,$3::jsonb,$4)", [
      sessionId,
      attempt.root_attempt_id,
      JSON.stringify(outcome),
      outcome.outcome === "unevaluated" ? "unevaluated" : "completed",
    ]);
  validateSessionEvidence(content, evidence);
  return { decision, nextAttemptId, interventionId };
}

/** All decision effects commit together under the authorized session lock. */
export async function applyTutoring(
  access: EvidenceAccess,
  sessionId: string,
  evaluationId: string,
) {
  await transaction((client) =>
    applyTutoringInTransaction(client, access, sessionId, evaluationId),
  );
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
