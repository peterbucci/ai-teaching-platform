import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Actor } from "../auth.ts";
import { createAdminClient } from "../supabase/admin.ts";
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

// Construct only from a verified Actor; never from request ownership fields.
export function evidenceAccess(actor: Actor) {
  return { actor, admin: createAdminClient() };
}
export type EvidenceAccess = ReturnType<typeof evidenceAccess>;

function databaseError(error: { code?: string } | null): void {
  if (!error) return;
  if (["23505", "23503", "23514", "P0001"].includes(error.code ?? "")) {
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

export async function authorizeSession(
  access: EvidenceAccess,
  sessionId: string,
  role: "student" | "teacher",
) {
  z.uuid().parse(sessionId);
  // User JWT/RLS first. No privileged read occurs until this check succeeds.
  const { data, error } = await access.actor.client
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  databaseError(error);
  if (!data) throw new EvidenceError(404, "Session not found.");
  const session = SessionSchema.parse(data);
  if (role === "student") {
    if (session.student_id !== access.actor.profileId)
      throw new EvidenceError(403, "Student access required.");
  } else {
    const owner = await access.actor.client
      .from("classes")
      .select("id")
      .eq("id", session.class_id)
      .eq("teacher_id", access.actor.profileId)
      .maybeSingle();
    databaseError(owner.error);
    if (!owner.data) throw new EvidenceError(403, "Teacher access required.");
  }
  return session;
}

export async function readSession(
  access: EvidenceAccess,
  sessionId: string,
  role: "student" | "teacher",
) {
  const session = await authorizeSession(access, sessionId, role);
  const [attemptRows, interventionRows] = await Promise.all([
    access.admin
      .from("attempts")
      .select("*")
      .eq("session_id", sessionId)
      .order("sequence_index"),
    access.admin
      .from("interventions")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at")
      .order("id"),
  ]);
  databaseError(attemptRows.error);
  databaseError(interventionRows.error);
  const attempts = z.array(AttemptSchema).parse(attemptRows.data);
  const evaluations = attempts.length
    ? await access.admin
        .from("evaluations")
        .select("*")
        .in(
          "attempt_id",
          attempts.map((attempt) => attempt.id),
        )
        .order("evaluated_at")
        .order("id")
    : { data: [], error: null };
  databaseError(evaluations.error);
  return validateSessionEvidence(loadApprovedContent(), {
    session,
    attempts,
    evaluations: evaluations.data,
    interventions: interventionRows.data,
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
  const assignmentRow = await access.actor.client
    .from("assignments")
    .select("id,class_id,content_ref")
    .eq("id", assignmentId)
    .maybeSingle();
  databaseError(assignmentRow.error);
  if (!assignmentRow.data)
    throw new EvidenceError(404, "Assignment not found.");
  const assignment = z
    .object({ id: z.uuid(), class_id: z.uuid(), content_ref: z.unknown() })
    .parse(assignmentRow.data);
  const membership = await access.actor.client
    .from("enrollments")
    .select("student_id")
    .eq("class_id", assignment.class_id)
    .eq("student_id", access.actor.profileId)
    .maybeSingle();
  databaseError(membership.error);
  if (!membership.data)
    throw new EvidenceError(403, "Assignment enrollment required.");
  validateContentRef(loadApprovedContent(), assignment.content_ref);
  const session = SessionSchema.parse({
    id: randomUUID(),
    student_id: access.actor.profileId,
    assignment_id: assignment.id,
    class_id: assignment.class_id,
    status: "active",
    data_origin: dataOrigin,
    started_at: new Date().toISOString(),
    ended_at: null,
  });
  const result = await access.admin.from("sessions").insert(session);
  databaseError(result.error);
  return session;
}

/** Trusted tutor code supplies the question; there is deliberately no browser API for this. */
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
  const evidence = await readSession(access, sessionId, "student");
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
    throw new EvidenceError(400, "Delayed retrieval requires a prior attempt.");
  const id = randomUUID();
  const attempt = AttemptSchema.parse({
    id,
    session_id: sessionId,
    sequence_index:
      Math.max(-1, ...evidence.attempts.map((item) => item.sequence_index)) + 1,
    parent_attempt_id: parent?.id ?? null,
    root_attempt_id: parent?.root_attempt_id ?? id,
    review_of_attempt_id: input.review_of_attempt_id ?? null,
    question,
    intent: input.intent,
    presented_at: new Date().toISOString(),
    submitted_at: null,
    response_text: null,
    submission_key: null,
    assistance: null,
    current_evaluation_id: null,
    outcome: null,
  });
  const result = await access.admin.from("attempts").insert(attempt);
  databaseError(result.error);
  return attempt;
}

export async function submitAnswer(
  access: EvidenceAccess,
  sessionId: string,
  input: unknown,
) {
  const submission = SubmitAnswerSchema.parse(input);
  // Bound the history snapshot before reading it. A later display acknowledgement
  // must not retroactively change the help recorded at submission.
  const submitted_at = new Date().toISOString();
  const evidence = await readSession(access, sessionId, "student");
  const attempt = evidence.attempts.find(
    (item) => item.id === submission.attempt_id,
  );
  if (!attempt) throw new EvidenceError(404, "Attempt not found.");
  const assistance = deriveAssistance(
    attempt.question,
    attempt.intent,
    attempt.presented_at,
    submitted_at,
    evidence.interventions,
  );
  const result = await access.admin.rpc("submit_answer", {
    p_attempt_id: attempt.id,
    p_submission_key: submission.submission_key,
    p_response_text: submission.response_text,
    p_assistance: assistance,
    p_submitted_at: submitted_at,
  });
  databaseError(result.error);
  AttemptSchema.parse(result.data);
  return readStudentSession(access, sessionId);
}

/** Call after the client renders an intervention. Creation alone is not delivery. */
export async function acknowledgeIntervention(
  access: EvidenceAccess,
  sessionId: string,
  interventionId: string,
) {
  z.uuid().parse(interventionId);
  const evidence = await readSession(access, sessionId, "student");
  const intervention = evidence.interventions.find(
    (item) => item.id === interventionId,
  );
  if (!intervention) throw new EvidenceError(404, "Intervention not found.");
  if (intervention.delivery_status === "failed")
    throw new EvidenceError(409, "Intervention was not delivered.");
  if (intervention.delivery_status === "created") {
    const result = await access.admin
      .from("interventions")
      .update({
        delivery_status: "displayed",
        visible_at: new Date().toISOString(),
      })
      .eq("id", interventionId)
      .eq("session_id", sessionId)
      .eq("delivery_status", "created");
    databaseError(result.error);
  }
  return readStudentSession(access, sessionId);
}

/** Server-only accepted/failed evidence write. Model output must pass the shared contract. */
export async function recordEvaluation(
  access: EvidenceAccess,
  sessionId: string,
  input: Omit<Evaluation, "evaluated_at">,
) {
  const evidence = await readSession(access, sessionId, "student");
  const evaluation = EvaluationSchema.parse({
    ...input,
    evaluated_at: new Date().toISOString(),
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
  const result = await access.admin.rpc("save_evaluation", {
    p_record: evaluation,
  });
  databaseError(result.error);
  return EvaluationSchema.parse(result.data);
}

/** Server-only feedback write; the caller does not mark generated text as displayed. */
export async function recordIntervention(
  access: EvidenceAccess,
  sessionId: string,
  input: Omit<
    Intervention,
    "session_id" | "created_at" | "visible_at" | "delivery_status"
  >,
) {
  const evidence = await readSession(access, sessionId, "student");
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
  const result = await access.admin.from("interventions").insert(intervention);
  databaseError(result.error);
  return intervention;
}

/** Store a deterministic tutor's result; this does not choose the next action. */
export async function finishSession(
  access: EvidenceAccess,
  sessionId: string,
  input: Omit<EpisodeOutcome, "recorded_at">,
) {
  const evidence = await readSession(access, sessionId, "student");
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
  const result = await access.admin.rpc("finish_session", {
    p_session_id: sessionId,
    p_root_attempt_id: outcome.root_attempt_id,
    p_outcome: outcome,
    p_status: status,
  });
  databaseError(result.error);
  return SessionSchema.parse(result.data);
}
