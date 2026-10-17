import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import type { Actor } from "../auth.ts";
import { evidenceRow, inTransaction } from "../db.ts";
import {
  AttemptSchema,
  EpisodeOutcomeSchema,
  EvaluationSchema,
  InterventionSchema,
  SessionSchema,
  SubmitAnswerSchema,
} from "./contracts.ts";
import type {
  Intent,
  QuestionSnapshot,
  Evaluation,
  Intervention,
  EpisodeOutcome,
} from "./contracts.ts";
import {
  loadApprovedContent,
  validateContentRef,
  validateQuestionSnapshot,
} from "./content.ts";
import {
  deriveAssistance,
  toStudentSessionView,
  validateEvaluationReferences,
  validateSessionEvidence,
} from "./rules.ts";

export class EvidenceError extends Error {
  readonly status: 400 | 403 | 404 | 409 | 503;
  constructor(status: 400 | 403 | 404 | 409 | 503, message: string) {
    super(message);
    this.status = status;
    this.name = "EvidenceError";
  }
}

// Construct only from a server-verified Actor; never from browser ownership fields.
export function evidenceAccess(actor: Actor) {
  return { actor };
}
export type EvidenceAccess = ReturnType<typeof evidenceAccess>;

export async function transaction<T>(
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  try {
    return await inTransaction(operation);
  } catch (error) {
    if (error instanceof EvidenceError || error instanceof z.ZodError)
      throw error;
    const database = z.object({ code: z.string() }).safeParse(error);
    if (
      database.success &&
      ["23505", "23503", "23514", "P0001"].includes(database.data.code)
    ) {
      throw new EvidenceError(
        409,
        "This operation conflicts with the saved evidence.",
      );
    }
    throw new EvidenceError(
      503,
      "Evidence storage is unavailable. Please retry.",
    );
  }
}

async function authorizedSession(
  client: PoolClient,
  access: EvidenceAccess,
  sessionId: string,
  role: "student" | "teacher",
  lock: boolean,
) {
  z.uuid().parse(sessionId);
  // Every access is scoped in SQL to the authenticated profile. The role parameter
  // chooses an endpoint's required relationship, never a browser-provided role.
  const result = await client.query(
    `SELECT s.* FROM sessions s JOIN classes c ON c.id = s.class_id
     WHERE s.id = $1 AND (
       ($3 = 'student' AND s.student_id = $2 AND EXISTS (
         SELECT 1 FROM enrollments e WHERE e.class_id = s.class_id AND e.student_id = $2))
       OR ($3 = 'teacher' AND c.teacher_id = $2)) ${lock ? "FOR UPDATE OF s" : ""}`,
    [sessionId, access.actor.profileId, role],
  );
  if (!result.rows[0]) throw new EvidenceError(404, "Session not found.");
  return SessionSchema.parse(evidenceRow(result.rows[0]));
}

export async function sessionEvidence(
  client: PoolClient,
  access: EvidenceAccess,
  sessionId: string,
  role: "student" | "teacher",
  lock: boolean,
) {
  const session = await authorizedSession(
    client,
    access,
    sessionId,
    role,
    lock,
  );
  const attempts = await client.query(
    "SELECT * FROM attempts WHERE session_id = $1 ORDER BY sequence_index",
    [sessionId],
  );
  const evaluations = await client.query(
    "SELECT e.* FROM evaluations e JOIN attempts a ON a.id = e.attempt_id WHERE a.session_id = $1 ORDER BY e.evaluated_at, e.id",
    [sessionId],
  );
  const interventions = await client.query(
    "SELECT * FROM interventions WHERE session_id = $1 ORDER BY created_at, id",
    [sessionId],
  );
  return validateSessionEvidence(
    loadApprovedContent(),
    evidenceRow({
      session,
      attempts: attempts.rows,
      evaluations: evaluations.rows,
      interventions: interventions.rows,
    }),
  );
}

export async function readSession(
  access: EvidenceAccess,
  sessionId: string,
  role: "student" | "teacher",
) {
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    return sessionEvidence(client, access, sessionId, role, false);
  });
}

export async function readStudentSession(
  access: EvidenceAccess,
  sessionId: string,
) {
  return toStudentSessionView(await readSession(access, sessionId, "student"));
}

export async function startSession(
  access: EvidenceAccess,
  assignmentId: string,
  dataOrigin: "synthetic_fixture" | "live_demo" = "live_demo",
) {
  z.uuid().parse(assignmentId);
  return transaction(async (client) => {
    const assignmentRows = await client.query(
      `SELECT a.id, a.class_id, a.content_ref FROM assignments a
       JOIN enrollments e ON e.class_id = a.class_id
       WHERE a.id = $1 AND e.student_id = $2 FOR SHARE OF a, e`,
      [assignmentId, access.actor.profileId],
    );
    if (!assignmentRows.rows[0])
      throw new EvidenceError(404, "Assignment not found.");
    const assignment = z
      .object({ id: z.uuid(), class_id: z.uuid(), content_ref: z.unknown() })
      .parse(assignmentRows.rows[0]);
    validateContentRef(loadApprovedContent(), assignment.content_ref);
    const result = await client.query(
      "INSERT INTO sessions(id, student_id, assignment_id, class_id, data_origin) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [
        randomUUID(),
        access.actor.profileId,
        assignment.id,
        assignment.class_id,
        dataOrigin,
      ],
    );
    return SessionSchema.parse(evidenceRow(result.rows[0]));
  });
}

/** Trusted tutor code supplies the question; there is no browser API for this. */
export async function presentQuestion(
  access: EvidenceAccess,
  sessionId: string,
  input: {
    question: QuestionSnapshot;
    intent: Intent;
    parent_attempt_id?: string;
    review_of_attempt_id?: string;
  },
) {
  return transaction(async (client) => {
    const evidence = await sessionEvidence(
      client,
      access,
      sessionId,
      "student",
      true,
    );
    if (evidence.session.status !== "active")
      throw new EvidenceError(409, "Session has ended.");
    const question = validateQuestionSnapshot(
      loadApprovedContent(),
      input.question,
    );
    const parent = input.parent_attempt_id
      ? evidence.attempts.find(
          (attempt) => attempt.id === input.parent_attempt_id,
        )
      : null;
    if (input.parent_attempt_id && !parent)
      throw new EvidenceError(400, "Parent attempt is outside this session.");
    if (input.intent === "delayed_review" && !input.review_of_attempt_id)
      throw new EvidenceError(
        400,
        "Delayed retrieval requires a prior attempt.",
      );
    const id = randomUUID();
    const result = await client.query(
      `INSERT INTO attempts(id,session_id,sequence_index,parent_attempt_id,root_attempt_id,review_of_attempt_id,question,intent)
       VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8) RETURNING *`,
      [
        id,
        sessionId,
        Math.max(-1, ...evidence.attempts.map((item) => item.sequence_index)) +
          1,
        parent?.id ?? null,
        parent?.root_attempt_id ?? id,
        input.review_of_attempt_id ?? null,
        JSON.stringify(question),
        input.intent,
      ],
    );
    return AttemptSchema.parse(evidenceRow(result.rows[0]));
  });
}

export async function submitAnswer(
  access: EvidenceAccess,
  sessionId: string,
  input: unknown,
) {
  const submission = SubmitAnswerSchema.parse(input);
  await transaction(async (client) => {
    const evidence = await sessionEvidence(
      client,
      access,
      sessionId,
      "student",
      true,
    );
    const attempt = evidence.attempts.find(
      (item) => item.id === submission.attempt_id,
    );
    if (!attempt) throw new EvidenceError(404, "Attempt not found.");
    if (
      attempt.submitted_at === null &&
      (attempt.id !== evidence.attempts.at(-1)?.id ||
        evidence.interventions.some(
          (item) => item.delivery_status === "created",
        ))
    )
      throw new EvidenceError(
        409,
        "Read the displayed feedback before answering the current question.",
      );
    // Use the database clock for both the answer and its assistance snapshot.
    // Session locking serializes this with display acknowledgements and new prompts.
    // JSON preserves PostgreSQL's microseconds; pg Date conversion could round
    // below a prompt/display timestamp from the same millisecond.
    const clock = await client.query(
      "SELECT to_jsonb(clock_timestamp()) AS now",
    );
    const { now: submitted_at } = z
      .object({ now: z.iso.datetime({ offset: true }) })
      .parse(evidenceRow(clock.rows[0]));
    const assistance = deriveAssistance(
      attempt.question,
      attempt.intent,
      attempt.presented_at,
      submitted_at,
      evidence.interventions,
    );
    await client.query(
      "SELECT * FROM submit_answer($1,$2,$3,$4::jsonb,$5::timestamptz)",
      [
        attempt.id,
        submission.submission_key,
        submission.response_text,
        JSON.stringify(assistance),
        submitted_at,
      ],
    );
  });
  return readStudentSession(access, sessionId);
}

/** Call after rendering. Merely creating an intervention does not mark it delivered. */
export async function acknowledgeIntervention(
  access: EvidenceAccess,
  sessionId: string,
  interventionId: string,
) {
  z.uuid().parse(interventionId);
  await transaction(async (client) => {
    await authorizedSession(client, access, sessionId, "student", true);
    const result = await client.query(
      "SELECT * FROM interventions WHERE id=$1 AND session_id=$2",
      [interventionId, sessionId],
    );
    if (!result.rows[0])
      throw new EvidenceError(404, "Intervention not found.");
    const intervention = InterventionSchema.parse(evidenceRow(result.rows[0]));
    if (intervention.delivery_status === "failed")
      throw new EvidenceError(409, "Intervention was not delivered.");
    if (intervention.delivery_status === "created") {
      await client.query(
        "UPDATE interventions SET delivery_status='displayed', visible_at=clock_timestamp() WHERE id=$1 AND session_id=$2 AND delivery_status='created'",
        [interventionId, sessionId],
      );
    }
  });
  return readStudentSession(access, sessionId);
}

/** Server-only evidence write. No route accepts evaluations from a student. */
export async function recordEvaluation(
  access: EvidenceAccess,
  sessionId: string,
  input: Omit<Evaluation, "evaluated_at">,
) {
  return transaction(async (client) => {
    const evidence = await sessionEvidence(
      client,
      access,
      sessionId,
      "student",
      true,
    );
    const clock = await client.query(
      "SELECT to_jsonb(clock_timestamp()) AS now",
    );
    const { now } = z
      .object({ now: z.iso.datetime({ offset: true }) })
      .parse(evidenceRow(clock.rows[0]));
    const evaluation = EvaluationSchema.parse({
      ...input,
      evaluated_at: now,
    });
    const attempt = evidence.attempts.find(
      (item) => item.id === evaluation.attempt_id,
    );
    if (!attempt) throw new EvidenceError(404, "Attempt not found.");
    validateEvaluationReferences(
      loadApprovedContent(),
      evaluation,
      attempt,
      evidence.attempts,
      evidence.evaluations,
    );
    const result = await client.query(
      "SELECT * FROM save_evaluation($1::jsonb)",
      [JSON.stringify(evaluation)],
    );
    return EvaluationSchema.parse(evidenceRow(result.rows[0]));
  });
}

export async function recordIntervention(
  access: EvidenceAccess,
  sessionId: string,
  input: Omit<
    Intervention,
    "session_id" | "created_at" | "visible_at" | "delivery_status"
  >,
) {
  return transaction(async (client) => {
    const evidence = await sessionEvidence(
      client,
      access,
      sessionId,
      "student",
      true,
    );
    const intervention = InterventionSchema.parse({
      ...input,
      session_id: sessionId,
      created_at: new Date().toISOString(),
      visible_at: null,
      delivery_status: "created",
    });
    validateSessionEvidence(loadApprovedContent(), {
      ...evidence,
      interventions: [...evidence.interventions, intervention],
    });
    const result = await client.query(
      "INSERT INTO interventions SELECT (jsonb_populate_record(NULL::interventions,$1::jsonb)).* RETURNING *",
      [JSON.stringify(intervention)],
    );
    return InterventionSchema.parse(evidenceRow(result.rows[0]));
  });
}

/** Records a deterministic tutor's outcome; it does not choose the next action. */
export async function finishSession(
  access: EvidenceAccess,
  sessionId: string,
  input: Omit<EpisodeOutcome, "recorded_at">,
) {
  return transaction(async (client) => {
    const evidence = await sessionEvidence(
      client,
      access,
      sessionId,
      "student",
      true,
    );
    const outcome = EpisodeOutcomeSchema.parse({
      ...input,
      recorded_at: new Date().toISOString(),
    });
    if (!evidence.attempts.some((item) => item.id === outcome.root_attempt_id))
      throw new EvidenceError(400, "Episode root not found.");
    validateSessionEvidence(loadApprovedContent(), {
      ...evidence,
      attempts: evidence.attempts.map((item) =>
        item.id === outcome.root_attempt_id ? { ...item, outcome } : item,
      ),
    });
    const status =
      outcome.outcome === "pending_evaluation" ||
      outcome.outcome === "unevaluated"
        ? outcome.outcome
        : "completed";
    const result = await client.query(
      "SELECT * FROM finish_session($1,$2,$3::jsonb,$4)",
      [sessionId, outcome.root_attempt_id, JSON.stringify(outcome), status],
    );
    return SessionSchema.parse(evidenceRow(result.rows[0]));
  });
}
