import "server-only";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { PoolClient } from "pg";
import { z } from "zod";
import { evidenceRow } from "../db.ts";
import {
  loadApprovedContent,
  validateContentRef,
} from "../evidence/content.ts";
import {
  EvidenceError,
  sessionEvidence,
  transaction,
  type EvidenceAccess,
} from "../evidence/store.ts";
import {
  DIALOGUE_VERSION,
  DialogueRequestSchema,
  LessonAnchorSchema,
} from "./contracts.ts";
import {
  ConversationActionSchema,
  ConversationMessageSchema,
  IntentClassificationSchema,
} from "./conversation.ts";

/** Persisted server actions are separate from the browser's message contract. */
export const ControllerOperationPayloadSchema = z.strictObject({
  action: z.literal("controller_action"),
  request_id: z.uuid(),
  session_id: z.uuid(),
  attempt_id: z.uuid(),
  expected_revision: z.int().nonnegative(),
  evaluation_id: z.uuid(),
});
export const OperationSchema = z.object({
  request_id: z.uuid(),
  session_id: z.uuid(),
  attempt_id: z.uuid(),
  actor_id: z.uuid(),
  expected_revision: z.int().nonnegative(),
  lesson: LessonAnchorSchema,
  payload: z.union([
    ConversationActionSchema,
    ControllerOperationPayloadSchema,
  ]),
  message_request_id: z.uuid().nullable(),
  status: z.enum([
    "pending",
    "clarification",
    "help",
    "answer",
    "fallback",
    "cancelled",
    "resolved",
  ]),
  proposed_intent: IntentClassificationSchema.nullable(),
  authorized_route: z.string().nullable(),
  message: ConversationMessageSchema.nullable(),
  dialogue_request: DialogueRequestSchema.nullable(),
  intervention_id: z.uuid().nullable(),
  created_at: z.iso.datetime({ offset: true }),
});
export type DialogueOperation = z.infer<typeof OperationSchema>;
export const AuditEventSchema = z.object({
  sequence: z.coerce.number().int(),
  event_id: z.uuid(),
  request_id: z.uuid(),
  kind: z.string(),
  payload: z.record(z.string(), z.json()),
  at: z.iso.datetime({ offset: true }),
});

export function conflict(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new EvidenceError(409, message);
}
export const same = isDeepStrictEqual;

/** All callers authorize before reading operations; writes share the legacy session lock. */
export async function dialogueContext(
  client: PoolClient,
  access: EvidenceAccess,
  sessionId: string,
  lock: boolean,
  role: "student" | "teacher" = "student",
) {
  const identity = await client.query(
    "SELECT id FROM profiles WHERE id=$1 AND auth_user_id=$2",
    [access.actor.profileId, access.actor.userId],
  );
  if (!identity.rowCount) throw new EvidenceError(404, "Session not found.");
  const evidence = await sessionEvidence(client, access, sessionId, role, lock);
  const attempt = evidence.attempts.at(-1);
  conflict(attempt, "No current lesson question.");
  const assignmentResult = await client.query(
    "SELECT content_ref,teacher_approved_at,approved_concept_ids,approved_passage_ids,approved_misconception_ids FROM assignments WHERE id=$1 AND class_id=$2",
    [evidence.session.assignment_id, evidence.session.class_id],
  );
  const assignment = z
    .object({
      content_ref: z.unknown(),
      teacher_approved_at: z.unknown(),
      approved_concept_ids: z.array(z.string()),
      approved_passage_ids: z.array(z.string()),
      approved_misconception_ids: z.array(z.string()),
    })
    .parse(assignmentResult.rows[0]);
  conflict(
    assignment.teacher_approved_at &&
      same(assignment.content_ref, attempt.question.content_ref),
    "The approved lesson version changed.",
  );
  if (lock)
    await client.query(
      "INSERT INTO dialogue_sessions(session_id) VALUES($1) ON CONFLICT DO NOTHING",
      [sessionId],
    );
  const stateRows = await client.query(
    "SELECT revision,turns_used FROM dialogue_sessions WHERE session_id=$1",
    [sessionId],
  );
  const state = z
    .object({ revision: z.int(), turns_used: z.int() })
    .parse(stateRows.rows[0] ?? { revision: 0, turns_used: 0 });
  const operations = OperationSchema.array().parse(
    evidenceRow(
      (
        await client.query(
          "SELECT * FROM dialogue_operations WHERE session_id=$1 ORDER BY created_at,request_id",
          [sessionId],
        )
      ).rows,
    ),
  );
  const events = AuditEventSchema.array().parse(
    evidenceRow(
      (
        await client.query(
          "SELECT e.* FROM dialogue_events e JOIN dialogue_operations o USING(request_id) WHERE o.session_id=$1 ORDER BY e.sequence",
          [sessionId],
        )
      ).rows,
    ),
  );
  const counts = await client.query(
    `SELECT (count(*) + (SELECT count(*) FROM evaluations e JOIN attempts a ON a.id=e.attempt_id WHERE a.session_id=$1 AND e.validation_status='pending_review' AND e.evaluator->>'type'='language_model'))::integer AS used,
      (count(*) FILTER(WHERE status IN ('reserved','unknown')) + (SELECT count(*) FROM evaluations e JOIN attempts a ON a.id=e.attempt_id WHERE a.session_id=$1 AND e.validation_status='pending_review' AND e.evaluator->>'type'='language_model' AND NOT EXISTS(SELECT 1 FROM evaluations later WHERE later.attempt_id=e.attempt_id AND later.evaluator->>'type'='language_model' AND (later.validation_status IN ('accepted','rejected') OR (later.validation_status='evaluation_failed' AND later.evaluator->>'provider_outcome'='settled' AND later.evaluator->>'provider_reservation_id'=e.id::text)) AND later.evaluated_at>e.evaluated_at)))::integer AS unresolved FROM dialogue_provider_calls WHERE session_id=$1`,
    [sessionId],
  );
  const calls = z
    .object({ used: z.int(), unresolved: z.int() })
    .parse(counts.rows[0]);
  // Curated resolver bridge until #53 merges; reject any unavailable version.
  // Replace this with resolveAssignmentContent(client, access, assignmentId, role).
  const content = loadApprovedContent();
  validateContentRef(content, assignment.content_ref);
  conflict(
    assignment.approved_concept_ids.every((id) =>
      content.concept_ids.has(id),
    ) &&
      assignment.approved_passage_ids.every((id) =>
        content.passage_ids.has(id),
      ) &&
      assignment.approved_misconception_ids.every((id) =>
        content.misconceptions.has(id),
      ),
    "The approved assignment scope is unavailable.",
  );
  const lesson = LessonAnchorSchema.parse({
    session_id: sessionId,
    assignment_id: evidence.session.assignment_id,
    attempt_id: attempt.id,
    root_attempt_id: attempt.root_attempt_id,
    sequence_index: attempt.sequence_index,
    content_ref: attempt.question.content_ref,
  });
  return {
    evidence,
    attempt,
    lesson,
    operations,
    events,
    revision: state.revision,
    turns_used: state.turns_used,
    provider_requests_used: calls.used,
    unresolved_provider_calls: calls.unresolved,
    content,
    scope: {
      concept_ids: new Set(assignment.approved_concept_ids),
      passage_ids: new Set(assignment.approved_passage_ids),
      misconception_ids: new Set(assignment.approved_misconception_ids),
    },
  };
}
export type DialogueContext = Awaited<ReturnType<typeof dialogueContext>>;

/** A controller reservation is valid only for its still-unapplied accepted observation. */
export function isCurrentOperation(
  context: DialogueContext,
  operation: DialogueOperation,
) {
  const base =
    context.evidence.session.status === "active" &&
    operation.expected_revision === context.revision &&
    same(operation.lesson, context.lesson);
  if (!base) return false;
  if (operation.payload.action !== "controller_action")
    return !context.attempt.submitted_at;
  const payload = operation.payload;
  const evaluation = context.evidence.evaluations.find(
    (item) => item.id === payload.evaluation_id,
  );
  return (
    !!context.attempt.submitted_at &&
    evaluation?.id === context.attempt.current_evaluation_id &&
    evaluation?.attempt_id === context.attempt.id &&
    evaluation?.validation_status === "accepted" &&
    evaluation.result !== null &&
    evaluation.applied_result === null
  );
}

export function currentOperation(context: DialogueContext, requestId: string) {
  const operation = context.operations.find((o) => o.request_id === requestId);
  if (!operation)
    throw new EvidenceError(404, "Conversation request not found.");
  conflict(
    isCurrentOperation(context, operation) && operation.status === "pending",
    "The conversation operation is stale, cancelled or settled.",
  );
  return operation;
}

export async function withDialogueOperation<T>(
  access: EvidenceAccess,
  sessionId: string,
  requestId: string,
  callback: (
    client: PoolClient,
    context: DialogueContext,
    operation: DialogueOperation,
  ) => Promise<T>,
) {
  return transaction(async (client) => {
    const context = await dialogueContext(client, access, sessionId, true);
    return callback(client, context, currentOperation(context, requestId));
  });
}

/** Audit payloads are private, bounded JSON. Domain callers validate their typed schema first. */
export async function appendOperationEvent(
  client: PoolClient,
  requestId: string,
  event: { kind: string; payload: unknown },
) {
  const payload = z.record(z.string(), z.json()).parse(event.payload);
  conflict(
    JSON.stringify(payload).length <= 64_000,
    "Operation evidence is too large.",
  );
  const result = await client.query(
    "INSERT INTO dialogue_events(event_id,request_id,kind,payload) VALUES($1,$2,$3,$4::jsonb) RETURNING *",
    [
      randomUUID(),
      requestId,
      z.string().min(1).max(80).parse(event.kind),
      JSON.stringify(payload),
    ],
  );
  return AuditEventSchema.parse(evidenceRow(result.rows[0]));
}

export async function databaseTime(client: PoolClient) {
  const row = (await client.query("SELECT to_jsonb(clock_timestamp()) AS now"))
    .rows[0];
  return z.object({ now: z.iso.datetime({ offset: true }) }).parse(row).now;
}
export { DIALOGUE_VERSION };
