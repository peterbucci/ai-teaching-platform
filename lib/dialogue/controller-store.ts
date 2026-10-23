import "server-only";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { transaction, type EvidenceAccess } from "../evidence/store.ts";
import type { AppliedResult } from "../evidence/contracts.ts";
import { decideTutoring } from "../tutoring/decide.ts";
import {
  DIALOGUE_LIMITS,
  DIALOGUE_VERSION,
  DialogueRequestSchema,
  DialogueEventSchema,
  type DialogueRequest,
} from "./contracts.ts";
import {
  ControllerOperationPayloadSchema,
  appendOperationEvent,
  conflict,
  currentOperation,
  databaseTime,
  dialogueContext,
} from "./persistence.ts";

/** The established controller chooses the activity slot; the model chooses its permitted tool. */
export function controllerAllowedIntent(
  action: AppliedResult["action"],
): Extract<
  DialogueRequest["trigger"],
  { kind: "controller" }
>["allowed_intent"] {
  switch (action) {
    case "ASK_DIAGNOSTIC_FOLLOWUP":
      return "diagnostic_followup";
    case "ASK_SELF_EXPLANATION":
      return "neutral_clarification";
    case "RETEST_CONCEPT":
      return "immediate_retest";
    default:
      return "explanation";
  }
}

/** One server-owned operation per accepted evaluation. Replays never create a new paid opportunity. */
export async function reserveControllerOperation(
  access: EvidenceAccess,
  sessionId: string,
  evaluationId: string,
) {
  z.uuid().parse(evaluationId);
  return transaction(async (client) => {
    const context = await dialogueContext(client, access, sessionId, true);
    const previous = context.operations.find(
      (item) =>
        item.payload.action === "controller_action" &&
        item.payload.evaluation_id === evaluationId,
    );
    if (previous) {
      conflict(
        previous.dialogue_request?.trigger.kind === "controller",
        "The saved controller request is incomplete.",
      );
      return { request: previous.dialogue_request, replay: true };
    }
    const evaluation = context.evidence.evaluations.find(
      (item) => item.id === evaluationId,
    );
    conflict(
      context.evidence.session.status === "active" &&
        !!context.attempt.submitted_at &&
        evaluation?.id === context.attempt.current_evaluation_id &&
        evaluation?.attempt_id === context.attempt.id &&
        evaluation.validation_status === "accepted" &&
        !!evaluation.result &&
        evaluation.applied_result === null,
      "Only the current unapplied accepted evaluation can request instruction.",
    );
    conflict(
      context.unresolved_provider_calls === 0 &&
        !context.operations.some(
          (item) =>
            item.status === "pending" &&
            item.expected_revision === context.revision,
        ),
      "Reconcile the active operation before requesting instruction.",
    );
    conflict(
      !context.evidence.interventions.some(
        (item) => item.delivery_status === "created",
      ),
      "Read accepted feedback before requesting another instructional action.",
    );
    conflict(
      context.turns_used < DIALOGUE_LIMITS.turnsPerSession,
      "The conversation turn limit has been reached.",
    );
    const requestedAt = await databaseTime(client);
    const decision = decideTutoring(
      context.content,
      context.evidence,
      evaluationId,
      requestedAt,
    );
    // Evaluation UUID is a stable server identity, including after process/browser recovery.
    const request = DialogueRequestSchema.parse({
      version: DIALOGUE_VERSION,
      request_id: evaluationId,
      session_id: sessionId,
      expected_revision: context.revision,
      lesson: context.lesson,
      requested_at: requestedAt,
      retry: null,
      trigger: {
        kind: "controller",
        evaluation_id: evaluationId,
        allowed_intent: controllerAllowedIntent(decision.applied.action),
      },
    });
    const payload = ControllerOperationPayloadSchema.parse({
      action: "controller_action",
      request_id: request.request_id,
      session_id: sessionId,
      attempt_id: context.attempt.id,
      expected_revision: context.revision,
      evaluation_id: evaluationId,
    });
    await client.query(
      `INSERT INTO dialogue_operations(request_id,session_id,attempt_id,actor_id,expected_revision,lesson,payload,status,authorized_route,dialogue_request)
       VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,'pending','controller_action',$8::jsonb)`,
      [
        request.request_id,
        sessionId,
        context.attempt.id,
        access.actor.profileId,
        context.revision,
        JSON.stringify(context.lesson),
        JSON.stringify(payload),
        JSON.stringify(request),
      ],
    );
    await client.query(
      "UPDATE dialogue_sessions SET turns_used=turns_used+1 WHERE session_id=$1",
      [sessionId],
    );
    await appendOperationEvent(client, request.request_id, {
      kind: "controller_requested",
      payload: { request, controller_action: decision.applied.action },
    });
    await appendOperationEvent(client, request.request_id, {
      kind: "dialogue",
      payload: DialogueEventSchema.parse({
        version: DIALOGUE_VERSION,
        event_id: randomUUID(),
        request_id: request.request_id,
        at: requestedAt,
        outcome: "requested",
      }),
    });
    // Recheck through exactly the same guard used by every later provider/commit stage.
    currentOperation(
      await dialogueContext(client, access, sessionId, true),
      request.request_id,
    );
    return { request, replay: false };
  });
}
