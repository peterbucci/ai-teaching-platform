import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import {
  EvidenceError,
  transaction,
  submitAnswerInTransaction,
  sessionEvidence,
  type EvidenceAccess,
} from "../evidence/store.ts";
import { evaluationRecovery } from "../evaluation/recovery.ts";
import {
  DIALOGUE_LIMITS,
  DIALOGUE_VERSION,
  DialogueEventSchema,
  GeneratedDialogueSchema,
  DialogueRequestSchema,
  DisplayDialogueSchema,
  type DialogueEvent,
  type GeneratedDialogue,
} from "./contracts.ts";
import {
  ConversationActionSchema,
  ConversationMessageSchema,
  ConversationViewSchema,
  IntentClassificationSchema,
  routeClassifiedMessage,
  type ConversationMessage,
  type IntentReview,
} from "./conversation.ts";
import {
  dialogueFallback,
  dialogueIntervention,
  validateGeneratedDialogue,
  toStudentDialogueContent,
  type DialogueReview,
} from "./rules.ts";
import { makeAskAction, type StudentDialogueTurn } from "./student-view.ts";
import {
  appendOperationEvent,
  conflict,
  currentOperation,
  databaseTime,
  dialogueContext,
  same,
  OperationSchema,
  AuditEventSchema,
  type DialogueContext,
  type DialogueOperation,
} from "./persistence.ts";
import { evidenceRow } from "../db.ts";

function deliveryEvents(
  context: DialogueContext,
  requestId: string,
): DialogueEvent[] {
  return context.events
    .filter((e) => e.request_id === requestId && e.kind === "dialogue")
    .map((e) => DialogueEventSchema.parse(e.payload));
}
function isCurrent(context: DialogueContext, operation: DialogueOperation) {
  return (
    context.evidence.session.status === "active" &&
    !context.attempt.submitted_at &&
    operation.expected_revision === context.revision &&
    same(operation.lesson, context.lesson)
  );
}
function fallbackMessage(
  message: ConversationMessage,
  reason: Parameters<typeof dialogueFallback>[0],
) {
  const fallback = dialogueFallback(reason);
  return ConversationMessageSchema.parse({
    ...message,
    outcome: { status: "fallback", reason, text: fallback.text },
  });
}

export function projectConversation(context: DialogueContext) {
  const { evidence, attempt } = context;
  const controllerPending = evidence.interventions.some(
    (i) =>
      i.type !== "reading" &&
      i.delivery_status === "created" &&
      !context.operations.some((o) => o.intervention_id === i.id),
  );
  const recovery = evaluationRecovery(
    evidence.evaluations.filter((e) => e.attempt_id === attempt.id),
    Date.now(),
  );
  const phase = controllerPending
    ? "feedback"
    : evidence.session.status !== "active"
      ? "completed"
      : !attempt.submitted_at
        ? "answer"
        : recovery.failed
          ? "failed"
          : "evaluate";
  const unresolved = context.operations.find(
    (o) =>
      isCurrent(context, o) &&
      (["pending", "clarification"].includes(o.status) ||
        (o.status === "help" &&
          deliveryEvents(context, o.request_id).at(-1)?.outcome ===
            "accepted")),
  );
  const messages = context.operations.flatMap((operation) => {
    if (!operation.message) return [];
    if (
      ["pending", "clarification"].includes(operation.status) &&
      !isCurrent(context, operation)
    )
      return [fallbackMessage(operation.message, "stale")];
    return [operation.message];
  });
  const turns = context.operations.flatMap<StudentDialogueTurn>((operation) => {
    const request = operation.dialogue_request;
    if (
      !request ||
      request.trigger.kind !== "student" ||
      operation.message?.outcome.status !== "help"
    )
      return [];
    const events = deliveryEvents(context, operation.request_id);
    const accepted = events.find((e) => e.outcome === "accepted");
    const last = events.at(-1);
    const content = toStudentDialogueContent(request, events);
    const base = {
      request_id: operation.request_id,
      attempt_id: operation.attempt_id,
      purpose: request.trigger.action.purpose,
      text: request.trigger.action.text,
    };
    if (
      !content ||
      content.kind !== "help" ||
      !accepted ||
      !operation.intervention_id ||
      (last?.outcome !== "accepted" && last?.outcome !== "displayed")
    )
      return [
        {
          ...base,
          response: {
            status: "fallback" as const,
            fallback: dialogueFallback(
              last?.outcome === "cancelled" ? "cancelled" : "stale",
            ),
          },
        },
      ];
    if (last.outcome === "accepted" && !isCurrent(context, operation))
      return [
        {
          ...base,
          response: {
            status: "fallback" as const,
            fallback: dialogueFallback("stale"),
          },
        },
      ];
    return [
      {
        ...base,
        response: {
          status: last.outcome,
          accepted_event_id: accepted.event_id,
          intervention_id: operation.intervention_id,
          expected_revision: operation.expected_revision,
          content,
          citations: content.source_passage_ids.map((id) => {
            const passage = context.content.passages.get(id);
            if (!passage)
              throw new EvidenceError(
                503,
                "Saved source passage is unavailable.",
              );
            return {
              passage_id: id,
              content_version: content.content_ref.content_version,
              text: passage.text,
              url: passage.url,
            };
          }),
        },
      },
    ];
  });
  return ConversationViewSchema.parse({
    dialogue: {
      state: {
        version: DIALOGUE_VERSION,
        revision: context.revision,
        lesson: context.lesson,
        progress: {
          phase,
          current_attempt_id: attempt.id,
          failed_evaluation_id: recovery.failed?.id ?? null,
          retry_allowed: recovery.allowed,
          retry_after: recovery.retryAfter,
          next_review_at: evidence.attempts[0]?.outcome?.next_review_at ?? null,
          message: "Your saved conversation and lesson.",
        },
        enabled: true,
        active_request_id: unresolved?.request_id ?? null,
        turns_used: context.turns_used,
        provider_requests_used: context.provider_requests_used,
      },
      turns,
    },
    messages,
  });
}
const project = projectConversation;

/** Read-only reconciliation: never calls a provider, acknowledges display or applies a lesson action. */
export async function loadConversation(
  access: EvidenceAccess,
  sessionId: string,
) {
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    return project(await dialogueContext(client, access, sessionId, false));
  });
}

async function saveMessage(
  client: PoolClient,
  operation: DialogueOperation,
  message: ConversationMessage,
  route: string,
) {
  await client.query(
    "UPDATE dialogue_operations SET message=$2::jsonb,status=$3,authorized_route=$4 WHERE request_id=$1",
    [
      operation.request_id,
      JSON.stringify(message),
      message.outcome.status,
      route,
    ],
  );
}
async function appendDelivery(
  client: PoolClient,
  requestId: string,
  event:
    Omit<DialogueEvent, "event_id" | "at" | "request_id" | "version"> | unknown,
) {
  const parsed = DialogueEventSchema.parse({
    version: DIALOGUE_VERSION,
    event_id: randomUUID(),
    request_id: requestId,
    at: await databaseTime(client),
    ...z.record(z.string(), z.unknown()).parse(event),
  });
  await appendOperationEvent(client, requestId, {
    kind: "dialogue",
    payload: parsed,
  });
  return parsed;
}

/** Reserve immutable request identity before any provider work. Replays are checked before revision. */
export async function reserveConversationOperation(
  access: EvidenceAccess,
  input: unknown,
) {
  const action = ConversationActionSchema.parse(input);
  return transaction(async (client) => {
    const context = await dialogueContext(
      client,
      access,
      action.session_id,
      true,
    );
    const previous = context.operations.find(
      (o) => o.request_id === action.request_id,
    );
    if (previous) {
      conflict(
        same(previous.payload, action),
        "Request ID was reused with different input.",
      );
      return {
        request_id: previous.message_request_id ?? previous.request_id,
        replay: true,
      };
    }
    conflict(
      context.revision === action.expected_revision &&
        context.attempt.id === action.attempt_id &&
        !context.attempt.submitted_at &&
        context.evidence.session.status === "active",
      "The lesson changed. Reload before continuing.",
    );
    const view = project(context);
    conflict(
      view.dialogue.state.progress.phase === "answer",
      "The controller is not awaiting an answer.",
    );
    conflict(
      !view.dialogue.turns.some((t) => t.response.status === "accepted"),
      "Acknowledge displayed help before continuing.",
    );
    let original: DialogueOperation | undefined;
    if (action.action === "send_message") {
      conflict(
        !view.dialogue.state.active_request_id &&
          !view.messages.some((m) =>
            ["pending", "clarification"].includes(m.outcome.status),
          ),
        "Resolve or cancel the current message first.",
      );
      conflict(
        context.unresolved_provider_calls === 0,
        "Reconcile the previous provider operation before continuing.",
      );
      conflict(
        context.turns_used < DIALOGUE_LIMITS.turnsPerSession,
        "Conversation turn limit reached. Continue through the lesson answer path.",
      );
    } else {
      original = context.operations.find(
        (o) => o.request_id === action.message_request_id,
      );
      conflict(
        original &&
          original.message &&
          isCurrent(context, original) &&
          ["pending", "clarification"].includes(original.status),
        "Original message is missing, stale or settled.",
      );
      if (action.action === "resolve_intent") {
        conflict(
          original.status === "clarification",
          "The message is not awaiting clarification.",
        );
        conflict(
          context.unresolved_provider_calls === 0,
          "Reconcile the provider operation before resolving intent.",
        );
      }
    }
    const message =
      action.action === "send_message"
        ? ConversationMessageSchema.parse({
            request_id: action.request_id,
            attempt_id: action.attempt_id,
            expected_revision: action.expected_revision,
            text: action.text,
            ...(action.purpose_hint
              ? { purpose_hint: action.purpose_hint }
              : {}),
            classification: null,
            outcome: { status: "pending" },
          })
        : null;
    await client.query(
      "INSERT INTO dialogue_operations(request_id,session_id,attempt_id,actor_id,expected_revision,lesson,payload,message_request_id,status,message) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10::jsonb)",
      [
        action.request_id,
        action.session_id,
        action.attempt_id,
        access.actor.profileId,
        action.expected_revision,
        JSON.stringify(context.lesson),
        JSON.stringify(action),
        original?.request_id ?? null,
        message ? "pending" : "resolved",
        message ? JSON.stringify(message) : null,
      ],
    );
    await appendOperationEvent(client, action.request_id, {
      kind: "requested",
      payload: { action },
    });
    if (message)
      await client.query(
        "UPDATE dialogue_sessions SET turns_used=turns_used+1 WHERE session_id=$1",
        [action.session_id],
      );
    if (original?.message && action.action === "cancel_message") {
      await saveMessage(
        client,
        original,
        { ...original.message, outcome: { status: "cancelled" } },
        "cancel",
      );
      await appendOperationEvent(client, original.request_id, {
        kind: "cancelled",
        payload: { cancellation_request_id: action.request_id },
      });
      if (original.dialogue_request)
        await appendDelivery(client, original.request_id, {
          outcome: "cancelled",
          reason: "cancelled",
        });
      await client.query(
        "UPDATE dialogue_sessions SET revision=revision+1 WHERE session_id=$1",
        [action.session_id],
      );
    } else if (original?.message && action.action === "resolve_intent") {
      await appendOperationEvent(client, original.request_id, {
        kind: "intent_resolution",
        payload: { request_id: action.request_id, choice: action.choice },
      });
      if (action.choice === "answer") {
        await submitAnswerInTransaction(client, access, action.session_id, {
          attempt_id: original.attempt_id,
          submission_key: original.request_id,
          response_text: original.message.text,
        });
        await saveMessage(
          client,
          original,
          {
            ...original.message,
            outcome: { status: "answer", submission_key: original.request_id },
          },
          "submit_answer",
        );
        await appendOperationEvent(client, original.request_id, {
          kind: "answer_applied",
          payload: {
            attempt_id: original.attempt_id,
            submission_key: original.request_id,
          },
        });
      } else {
        // Resolution preserves the original ID/text. The provider seam can generate help next.
        await client.query(
          "UPDATE dialogue_operations SET status='pending',authorized_route='ask_tutor' WHERE request_id=$1",
          [original.request_id],
        );
        await prepareHelp(client, context, { ...original, status: "pending" });
      }
    }
    return {
      request_id: original?.request_id ?? action.request_id,
      replay: false,
    };
  });
}

async function prepareHelp(
  client: PoolClient,
  context: DialogueContext,
  operation: DialogueOperation,
) {
  conflict(operation.message, "Missing original message.");
  if (operation.message.text.length > DIALOGUE_LIMITS.requestCharacters) {
    await saveMessage(
      client,
      operation,
      fallbackMessage(operation.message, "limit_reached"),
      "fallback",
    );
    return;
  }
  const state = project(context).dialogue.state;
  const request = DialogueRequestSchema.parse({
    version: DIALOGUE_VERSION,
    request_id: operation.request_id,
    session_id: operation.session_id,
    expected_revision: context.revision,
    lesson: context.lesson,
    requested_at: await databaseTime(client),
    retry: null,
    trigger: {
      kind: "student",
      action: makeAskAction(
        state,
        operation.message.purpose_hint ?? "question",
        operation.message.text,
        operation.request_id,
      ),
    },
  });
  await client.query(
    "UPDATE dialogue_operations SET dialogue_request=$2::jsonb,authorized_route='ask_tutor' WHERE request_id=$1",
    [operation.request_id, JSON.stringify(request)],
  );
  await appendDelivery(client, operation.request_id, { outcome: "requested" });
}

/** #74 supplies a private proposal and trusted review. No HTTP handler accepts these fields. */
export async function commitConversationIntent(
  access: EvidenceAccess,
  sessionId: string,
  requestId: string,
  input: unknown,
  review: IntentReview,
) {
  const proposal = IntentClassificationSchema.parse(input);
  const findings = z
    .strictObject({
      answer_intent: z.enum(["established", "uncertain"]),
      disclosure: z.enum(["safe", "private_guidance", "uncertain"]),
    })
    .parse(review);
  await transaction(async (client) => {
    const context = await dialogueContext(client, access, sessionId, true);
    const operation = currentOperation(context, requestId);
    conflict(
      operation.message &&
        !operation.proposed_intent &&
        !operation.dialogue_request,
      "Intent was already routed.",
    );
    const route = routeClassifiedMessage(
      project(context),
      requestId,
      proposal,
      findings,
      requestId,
    );
    await client.query(
      "UPDATE dialogue_operations SET proposed_intent=$2::jsonb WHERE request_id=$1",
      [requestId, JSON.stringify(proposal)],
    );
    await appendOperationEvent(client, requestId, {
      kind: "intent_review",
      payload: { proposal, review: findings, authorized_route: route.kind },
    });
    const message = {
      ...operation.message,
      classification:
        route.kind === "clarify" ? ("AMBIGUOUS" as const) : proposal.category,
    };
    if (route.kind === "submit_answer") {
      await submitAnswerInTransaction(client, access, sessionId, route.answer);
      await saveMessage(
        client,
        operation,
        {
          ...message,
          outcome: { status: "answer", submission_key: requestId },
        },
        route.kind,
      );
      await appendOperationEvent(client, requestId, {
        kind: "answer_applied",
        payload: {
          attempt_id: operation.attempt_id,
          submission_key: requestId,
        },
      });
    } else if (route.kind === "ask_tutor") {
      // Classification is private until the help settles; pending student messages stay unclassified.
      await prepareHelp(client, context, operation);
    } else if (route.kind === "clarify")
      await saveMessage(
        client,
        operation,
        { ...message, outcome: { status: "clarification" } },
        "clarify",
      );
    else
      await saveMessage(
        client,
        operation,
        fallbackMessage(message, route.reason),
        "fallback",
      );
  });
  return loadConversation(access, sessionId);
}

/** Persist validated help and its undelivered intervention together; generation is not display. */
export async function commitConversationHelp(
  access: EvidenceAccess,
  sessionId: string,
  requestId: string,
  input: GeneratedDialogue,
  review: DialogueReview,
) {
  await transaction(async (client) => {
    const context = await dialogueContext(client, access, sessionId, true);
    const operation = currentOperation(context, requestId);
    await commitConversationHelpInTransaction(
      client,
      context,
      operation,
      input,
      review,
    );
  });
  return loadConversation(access, sessionId);
}

/** Shared with #85's atomic tool-result commit; the caller already owns the session lock. */
export async function commitConversationHelpInTransaction(
  client: PoolClient,
  context: DialogueContext,
  operation: DialogueOperation,
  input: unknown,
  review: DialogueReview,
) {
  const { request_id: requestId } = operation;
  conflict(
    operation.message &&
      operation.dialogue_request &&
      operation.authorized_route === "ask_tutor",
    "Help was not authorized for this operation.",
  );
  const parsed = GeneratedDialogueSchema.safeParse(input);
  if (!parsed.success) {
    await appendDelivery(client, requestId, {
      outcome: "rejected",
      reason: "invalid_output",
    });
    await saveMessage(
      client,
      operation,
      fallbackMessage(operation.message, "invalid_output"),
      "fallback",
    );
    return false;
  }
  const generated = await appendDelivery(client, requestId, {
    outcome: "generated",
    content: parsed.data,
  });
  let content: GeneratedDialogue;
  try {
    content = validateGeneratedDialogue(
      context.content,
      context.scope,
      operation.dialogue_request,
      parsed.data,
      review,
    );
    conflict(
      content.kind === "help",
      "Generated assessments require a controller handoff and are not enabled here.",
    );
  } catch {
    await appendDelivery(client, requestId, {
      outcome: "rejected",
      reason: "invalid_output",
    });
    await saveMessage(
      client,
      operation,
      fallbackMessage(operation.message, "invalid_output"),
      "fallback",
    );
    return false;
  }
  const accepted = await appendDelivery(client, requestId, {
    outcome: "accepted",
    content_id: content.content_id,
    applied_attempt_id: null,
    applied_revision: context.revision,
  });
  const intervention = dialogueIntervention(
    operation.dialogue_request,
    [...deliveryEvents(context, requestId), generated, accepted],
    randomUUID(),
  );
  await client.query(
    "INSERT INTO interventions SELECT (jsonb_populate_record(NULL::interventions,$1::jsonb)).*",
    [JSON.stringify(intervention)],
  );
  await client.query(
    "UPDATE dialogue_operations SET intervention_id=$2 WHERE request_id=$1",
    [requestId, intervention.id],
  );
  await saveMessage(
    client,
    operation,
    {
      ...operation.message,
      classification: operation.message.classification ?? "QUESTION_OR_HELP",
      outcome: { status: "help", dialogue_request_id: requestId },
    },
    "ask_tutor",
  );
  return true;
}

export async function failConversationOperation(
  access: EvidenceAccess,
  sessionId: string,
  requestId: string,
  reason: Parameters<typeof dialogueFallback>[0],
) {
  await transaction(async (client) => {
    const context = await dialogueContext(client, access, sessionId, true);
    const operation = context.operations.find(
      (o) => o.request_id === requestId,
    );
    if (!operation)
      throw new EvidenceError(404, "Conversation request not found.");
    await failConversationInTransaction(client, context, operation, reason);
  });
  return loadConversation(access, sessionId);
}

export async function failConversationInTransaction(
  client: PoolClient,
  context: DialogueContext,
  operation: DialogueOperation,
  reason: Parameters<typeof dialogueFallback>[0],
) {
  const requestId = operation.request_id;
  if (
    !operation.message ||
    !["pending", "clarification"].includes(operation.status)
  )
    return;
  await saveMessage(
    client,
    operation,
    fallbackMessage(
      operation.message,
      isCurrent(context, operation) ? reason : "stale",
    ),
    "fallback",
  );
  await appendOperationEvent(client, requestId, {
    kind: "failed",
    payload: { reason },
  });
  if (operation.dialogue_request)
    await appendDelivery(client, requestId, { outcome: "failed", reason });
}

/** Default deployment is an honest confirmation path until #74/#85 are installed. */
export async function actConversation(
  access: EvidenceAccess,
  sessionId: string,
  input: unknown,
) {
  const action = ConversationActionSchema.parse(input);
  conflict(action.session_id === sessionId, "Wrong conversation session.");
  const reserved = await reserveConversationOperation(access, action);
  if (!reserved.replay && action.action === "send_message") {
    await transaction(async (client) => {
      const context = await dialogueContext(client, access, sessionId, true);
      const operation = currentOperation(context, reserved.request_id);
      conflict(operation.message, "Original message missing.");
      await saveMessage(
        client,
        operation,
        {
          ...operation.message,
          classification: "AMBIGUOUS",
          outcome: { status: "clarification" },
        },
        "clarify",
      );
      await appendOperationEvent(client, operation.request_id, {
        kind: "service_unavailable",
        payload: {
          reason:
            "Intent service is not connected. Explicit student confirmation is required.",
        },
      });
    });
  } else if (
    !reserved.replay &&
    action.action === "resolve_intent" &&
    action.choice === "help"
  ) {
    await failConversationOperation(
      access,
      sessionId,
      reserved.request_id,
      "disabled",
    );
  }
  return loadConversation(access, sessionId);
}

export async function acknowledgeConversation(
  access: EvidenceAccess,
  sessionId: string,
  input: unknown,
) {
  const display = DisplayDialogueSchema.parse(input);
  conflict(display.session_id === sessionId, "Wrong conversation session.");
  await transaction(async (client) => {
    const context = await dialogueContext(client, access, sessionId, true);
    const operation = context.operations.find(
      (o) => o.request_id === display.request_id,
    );
    conflict(
      operation?.dialogue_request && operation.intervention_id,
      "Accepted help was not found.",
    );
    const events = deliveryEvents(context, operation.request_id);
    const accepted = events.find((e) => e.outcome === "accepted");
    conflict(
      accepted?.outcome === "accepted" &&
        accepted.event_id === display.accepted_event_id &&
        accepted.content_id === display.content_id &&
        accepted.applied_revision === display.expected_revision,
      "Display acknowledgement does not match accepted content.",
    );
    if (events.some((e) => e.outcome === "displayed")) return;
    conflict(
      isCurrent(context, operation) &&
        operation.status === "help" &&
        events.at(-1)?.outcome === "accepted",
      "Accepted help belongs to a stale activity.",
    );
    const displayed = await appendDelivery(client, operation.request_id, {
      outcome: "displayed",
      content_id: display.content_id,
      intervention_id: operation.intervention_id,
      assessed_attempt_id: null,
    });
    await client.query(
      "UPDATE interventions SET delivery_status='displayed',visible_at=$3::timestamptz WHERE id=$1 AND session_id=$2 AND delivery_status='created'",
      [operation.intervention_id, sessionId, displayed.at],
    );
  });
  return loadConversation(access, sessionId);
}

export async function readTeacherConversation(
  access: EvidenceAccess,
  sessionId: string,
) {
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    const identity = await client.query(
      "SELECT id FROM profiles WHERE id=$1 AND auth_user_id=$2",
      [access.actor.profileId, access.actor.userId],
    );
    if (!identity.rowCount) throw new EvidenceError(404, "Session not found.");
    const evidence = await sessionEvidence(
      client,
      access,
      sessionId,
      "teacher",
      false,
    );
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
    return {
      session_id: sessionId,
      data_origin: evidence.session.data_origin,
      operations,
      events,
    };
  });
}

/** Safe status for reconnects. Raw provider responses are never browser data. */
export async function readConversationOperation(
  access: EvidenceAccess,
  sessionId: string,
  requestId: string,
) {
  z.uuid().parse(requestId);
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    const context = await dialogueContext(client, access, sessionId, false);
    const operation = context.operations.find(
      (item) => item.request_id === requestId,
    );
    if (!operation)
      throw new EvidenceError(404, "Conversation request not found.");
    const calls = z
      .array(
        z.object({
          step_id: z.string(),
          status: z.enum(["reserved", "succeeded", "failed", "unknown"]),
          started_at: z.iso.datetime({ offset: true }),
          finished_at: z.iso.datetime({ offset: true }).nullable(),
        }),
      )
      .parse(
        evidenceRow(
          (
            await client.query(
              "SELECT step_id,status,started_at,finished_at FROM dialogue_provider_calls WHERE request_id=$1 AND session_id=$2 ORDER BY started_at,id",
              [requestId, sessionId],
            )
          ).rows,
        ),
      );
    return {
      request_id: requestId,
      status:
        isCurrent(context, operation) ||
        !["pending", "clarification"].includes(operation.status)
          ? operation.status
          : "stale",
      provider_calls: calls,
      retry_allowed: false as const,
    };
  });
}

export { withDialogueOperation, appendOperationEvent } from "./persistence.ts";
