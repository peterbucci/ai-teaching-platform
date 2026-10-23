import "server-only";
import { z } from "zod";
import { type EvidenceAccess, transaction } from "../evidence/store.ts";
import {
  DIALOGUE_LIMITS,
  DialogueHistorySchema,
  DialogueEventSchema,
  DIALOGUE_VERSION,
  DialogueRequestSchema,
  type DialogueRequest,
} from "./contracts.ts";
import { dialogueFallback } from "./rules.ts";
import {
  appendOperationEvent,
  conflict,
  currentOperation,
  databaseTime,
  dialogueContext,
  same,
  type DialogueContext,
} from "./persistence.ts";
import {
  commitConversationHelpInTransaction,
  failConversationInTransaction,
  projectConversation,
} from "./store.ts";
import {
  OrchestrationRecordSchema,
  OrchestrationReceiptSchema,
  TutorProposalSchema,
  TutorToolResultSchema,
  type OrchestrationContext,
  type OrchestrationPorts,
  type TutorTool,
} from "../tutoring/orchestration/contracts.ts";

import { applyTutoringInTransaction } from "../tutoring/store.ts";
import { decideTutoring } from "../tutoring/decide.ts";
import { validateGeneratedDialogue } from "./rules.ts";
import { randomUUID } from "node:crypto";
import { validateProposal } from "../tutoring/orchestration/policy.ts";

function authorizeRequest(context: DialogueContext, input: DialogueRequest) {
  const request = DialogueRequestSchema.parse(input);
  const operation = currentOperation(context, request.request_id);
  conflict(
    operation.dialogue_request && same(operation.dialogue_request, request),
    "Action request differs from its saved authorized request.",
  );
  return operation;
}
export type AuthorizedTools =
  readonly TutorTool[] | ((context: DialogueContext) => readonly TutorTool[]);

function actionContext(
  context: DialogueContext,
  access: EvidenceAccess,
  approvedTools: AuthorizedTools,
  request: DialogueRequest,
): OrchestrationContext {
  const approved =
    typeof approvedTools === "function"
      ? approvedTools(context)
      : approvedTools;
  const decision =
    request.trigger.kind === "controller"
      ? decideTutoring(
          context.content,
          context.evidence,
          request.trigger.evaluation_id,
          request.requested_at,
        )
      : null;
  const view = projectConversation(context);
  const history: z.infer<typeof DialogueHistorySchema> = [];
  for (const message of view.messages) {
    if (
      message.text.length <= DIALOGUE_LIMITS.responseCharacters &&
      ["help", "answer"].includes(message.outcome.status)
    )
      history.push({ role: "student", text: message.text });
    const turn = view.dialogue.turns.find(
      (t) => t.request_id === message.request_id,
    );
    if (turn?.response.status === "displayed")
      history.push({ role: "tutor", text: turn.response.content.text });
  }
  while (
    history.length > DIALOGUE_LIMITS.historyMessages ||
    history.reduce((n, m) => n + m.text.length, 0) >
      DIALOGUE_LIMITS.historyCharacters
  )
    history.shift();
  return {
    actor_profile_id: access.actor.profileId,
    state: { ...view.dialogue.state, active_request_id: request.request_id },
    evidence: context.evidence,
    content: context.content,
    source_scope: context.scope,
    history: DialogueHistorySchema.parse(history),
    lesson_policy: approved,
    ...(decision
      ? {
          instructional_scope: {
            question_concept_ids: decision.nextQuestionId
              ? (context.content.questions.get(decision.nextQuestionId)
                  ?.concept_ids ?? null)
              : null,
            help_concept_ids: decision.help?.concept_ids ?? null,
          },
        }
      : {}),
    installed_tools: approved.filter((tool) =>
      request.trigger.kind === "student"
        ? tool === "clarify" || tool === "explain"
        : [
            "explain",
            "generate_diagnostic",
            "generate_followup",
            "generate_retest",
            "advance_lesson",
          ].includes(tool),
    ),
  };
}
function records(context: DialogueContext, id: string) {
  return context.events
    .filter((e) => e.request_id === id && e.kind === "action")
    .map((e) => OrchestrationRecordSchema.parse(e.payload));
}
function receipt(context: DialogueContext, id: string) {
  const stored = context.events.find(
    (e) => e.request_id === id && e.kind === "action_receipt",
  );
  return stored ? OrchestrationReceiptSchema.parse(stored.payload) : null;
}

/** Storage half of #85's ports. Provider selection/generation are supplied by #74/#85.
 * Conversational help and controller-authorized instruction share the existing operation log.
 * Retrieval/return tools remain absent until their display/persistence adapters exist. */
export function createOrchestrationPersistence(
  access: EvidenceAccess,
  sessionId: string,
  approvedHelpTools: AuthorizedTools = [],
): Pick<OrchestrationPorts, "claim" | "checkpoint" | "complete" | "fail"> {
  return {
    async claim(request) {
      return transaction(async (client) => {
        conflict(request.session_id === sessionId, "Wrong action session.");
        const context = await dialogueContext(client, access, sessionId, true);
        const operation = context.operations.find(
          (o) => o.request_id === request.request_id,
        );
        conflict(
          operation?.dialogue_request &&
            same(operation.dialogue_request, request),
          "Action request differs from its reservation.",
        );
        const saved = receipt(context, request.request_id);
        if (saved) return { kind: "replay" as const, receipt: saved };
        authorizeRequest(context, request);
        if (
          context.events.some(
            (e) =>
              e.request_id === request.request_id &&
              e.kind === "action_claimed",
          ) ||
          context.unresolved_provider_calls
        )
          return { kind: "blocked" as const, reason: "pending" as const };
        await appendOperationEvent(client, request.request_id, {
          kind: "action_claimed",
          payload: { action_id: request.request_id },
        });
        return {
          kind: "claimed" as const,
          context: actionContext(context, access, approvedHelpTools, request),
        };
      });
    },
    async checkpoint(request, input) {
      const record = OrchestrationRecordSchema.parse(input);
      return transaction(async (client) => {
        conflict(request.session_id === sessionId, "Wrong action session.");
        const context = await dialogueContext(client, access, sessionId, true);
        authorizeRequest(context, request);
        conflict(
          record.action_id === request.request_id,
          "Wrong action identity.",
        );
        conflict(
          context.events.some(
            (e) =>
              e.request_id === request.request_id &&
              e.kind === "action_claimed",
          ),
          "Action has not been claimed.",
        );
        const previous = records(context, request.request_id);
        const duplicate = previous.find((r) => r.phase === record.phase);
        if (duplicate) {
          conflict(
            same(duplicate, record),
            "Action phase was reused with different evidence.",
          );
          return actionContext(context, access, approvedHelpTools, request);
        }
        const last = previous.at(-1);
        conflict(
          (record.phase === "proposed" && !last) ||
            (record.phase === "validated" && last?.phase === "proposed") ||
            (record.phase === "dispatch_started" &&
              last?.phase === "validated" &&
              last.decision === "accepted"),
          "Invalid action history transition.",
        );
        if (record.phase === "dispatch_started") {
          const proposed = previous.find((item) => item.phase === "proposed");
          conflict(
            context.unresolved_provider_calls === 0 &&
              proposed?.phase === "proposed" &&
              proposed.proposal?.action === record.tool &&
              last?.phase === "validated" &&
              last.allowed_actions.includes(record.tool),
            "Dispatch must match the validated proposal and known provider outcomes.",
          );
          conflict(
            actionContext(
              context,
              access,
              approvedHelpTools,
              request,
            ).installed_tools.includes(record.tool),
            "This tool has no installed persistence adapter.",
          );
        }
        await appendOperationEvent(client, request.request_id, {
          kind: "action",
          payload: record,
        });
        return actionContext(context, access, approvedHelpTools, request);
      });
    },
    async complete(request, proposalInput, resultInput) {
      const proposal = TutorProposalSchema.parse(proposalInput);
      const result = TutorToolResultSchema.parse(resultInput);
      return transaction(async (client) => {
        conflict(request.session_id === sessionId, "Wrong action session.");
        const context = await dialogueContext(client, access, sessionId, true);
        const savedOperation = context.operations.find(
          (o) => o.request_id === request.request_id,
        );
        const savedProposal = records(context, request.request_id).find(
          (r) => r.phase === "proposed",
        );
        conflict(
          savedOperation?.dialogue_request &&
            same(savedOperation.dialogue_request, request) &&
            savedProposal?.phase === "proposed" &&
            same(savedProposal.proposal, proposal),
          "Action request or proposal differs from its saved identity.",
        );
        const saved = receipt(context, request.request_id);
        if (saved) {
          conflict(
            saved.status === "executed" &&
              same(saved.result, result) &&
              saved.action === proposal.action,
            "Action result differs from its saved receipt.",
          );
          return saved;
        }
        const operation = authorizeRequest(context, request);
        conflict(
          context.unresolved_provider_calls === 0,
          "Reconcile provider outcomes before accepting a tool result.",
        );
        const prior = records(context, request.request_id);
        const proposed = prior.find((r) => r.phase === "proposed");
        const dispatched = prior.at(-1);
        conflict(
          proposed?.phase === "proposed" &&
            same(proposed.proposal, proposal) &&
            dispatched?.phase === "dispatch_started" &&
            dispatched.tool === proposal.action,
          "Tool completion has no matching approved dispatch.",
        );
        const installed = actionContext(
          context,
          access,
          approvedHelpTools,
          request,
        ).installed_tools;
        conflict(
          installed.includes(proposal.action),
          "Tool delivery is not installed.",
        );
        validateProposal(
          proposal,
          request,
          actionContext(context, access, approvedHelpTools, request),
          installed,
          { completed: true },
        );
        let accepted = true;
        if (request.trigger.kind === "controller") {
          const decision = decideTutoring(
            context.content,
            context.evidence,
            request.trigger.evaluation_id,
            request.requested_at,
          );
          const generated =
            result.kind === "generated" ? result.content : undefined;
          if (proposal.action === "advance_lesson") {
            conflict(
              result.kind === "advance_lesson" &&
                result.evaluation_id === request.trigger.evaluation_id &&
                result.controller_action === decision.applied.action,
              "The proposed controller transition changed.",
            );
          } else {
            conflict(
              generated,
              "The selected instructional tool has no generated result.",
            );
            const expected =
              proposal.action === "generate_diagnostic"
                ? "diagnostic_followup"
                : proposal.action === "generate_followup"
                  ? "neutral_clarification"
                  : proposal.action === "generate_retest"
                    ? "immediate_retest"
                    : null;
            conflict(
              expected
                ? generated.kind === "question" && generated.intent === expected
                : proposal.action === "explain" &&
                    generated.kind === "help" &&
                    generated.assistance_type !== "neutral_clarification",
              "The result does not match the selected instructional action.",
            );
            validateGeneratedDialogue(
              context.content,
              context.scope,
              request,
              generated,
              {
                grounding: "supported",
                disclosure: "safe_scaffolding",
                permitted_by_controller: true,
              },
            );
          }
          // The controller reauthorizes the slot and commits every transition in this transaction.
          const applied = await applyTutoringInTransaction(
            client,
            access,
            sessionId,
            request.trigger.evaluation_id,
            {
              content: context.content,
              ...(generated?.kind === "question"
                ? { generatedQuestion: generated }
                : {}),
              ...(generated?.kind === "help"
                ? { generatedHelp: generated }
                : {}),
            },
          );
          conflict(
            applied,
            "This evaluation was already applied by another operation.",
          );
          const state = await client.query(
            "SELECT revision FROM dialogue_sessions WHERE session_id=$1",
            [sessionId],
          );
          const appliedRevision = z
            .object({ revision: z.int().nonnegative() })
            .parse(state.rows[0]).revision;
          if (generated) {
            const at = await databaseTime(client);
            for (const delivery of [
              { outcome: "generated", content: generated },
              {
                outcome: "accepted",
                content_id: generated.content_id,
                applied_attempt_id:
                  generated.kind === "question" ? applied.nextAttemptId : null,
                applied_revision:
                  generated.kind === "question"
                    ? appliedRevision
                    : request.expected_revision,
              },
            ]) {
              await appendOperationEvent(client, request.request_id, {
                kind: "dialogue",
                payload: DialogueEventSchema.parse({
                  ...delivery,
                  version: DIALOGUE_VERSION,
                  event_id: randomUUID(),
                  request_id: request.request_id,
                  at,
                }),
              });
            }
          }
          // These are controller deliveries: their existing tutor display acknowledgement owns assistance.
          // Do not set dialogue_operations.intervention_id, which belongs to conversational-help delivery.
          await appendOperationEvent(client, request.request_id, {
            kind: "controller_applied",
            payload: {
              evaluation_id: request.trigger.evaluation_id,
              controller_action: applied.decision.applied.action,
              next_attempt_id: applied.nextAttemptId,
              intervention_id: applied.interventionId,
              applied_revision: appliedRevision,
            },
          });
          await client.query(
            "UPDATE dialogue_operations SET status='resolved' WHERE request_id=$1",
            [request.request_id],
          );
        } else {
          conflict(
            result.kind === "generated" && result.content.kind === "help",
            "This tool has no conversation delivery adapter.",
          );
          // #85 validates semantic grounding/disclosure before invoking complete.
          accepted = await commitConversationHelpInTransaction(
            client,
            context,
            operation,
            result.content,
            {
              grounding: "supported",
              disclosure: "safe_scaffolding",
              permitted_by_controller: true,
            },
          );
        }
        const output = OrchestrationReceiptSchema.parse(
          accepted
            ? {
                status: "executed",
                request_id: request.request_id,
                action: proposal.action,
                result,
              }
            : {
                status: "stopped",
                request_id: request.request_id,
                reason: "invalid_output",
                reconcile: false,
                fallback: dialogueFallback("invalid_output"),
              },
        );
        await appendOperationEvent(client, request.request_id, {
          kind: "action",
          payload: OrchestrationRecordSchema.parse(
            accepted
              ? {
                  action_id: request.request_id,
                  phase: "executed",
                  tool: proposal.action,
                  result,
                }
              : {
                  action_id: request.request_id,
                  phase: "failed",
                  stage: "commit",
                  reason: "invalid_output",
                  outcome_unknown: false,
                },
          ),
        });
        await appendOperationEvent(client, request.request_id, {
          kind: "action_receipt",
          payload: output,
        });
        return output;
      });
    },
    async fail(request, recordInput, receiptInput) {
      const record = OrchestrationRecordSchema.parse(recordInput);
      const output = OrchestrationReceiptSchema.parse(receiptInput);
      conflict(
        record.phase === "failed" &&
          record.action_id === request.request_id &&
          output.request_id === request.request_id &&
          output.status === "stopped",
        "Invalid failure receipt.",
      );
      await transaction(async (client) => {
        conflict(request.session_id === sessionId, "Wrong action session.");
        const context = await dialogueContext(client, access, sessionId, true);
        const operation = context.operations.find(
          (o) => o.request_id === request.request_id,
        );
        conflict(
          operation?.dialogue_request &&
            same(operation.dialogue_request, request),
          "Unknown action reservation.",
        );
        const saved = receipt(context, request.request_id);
        if (saved) {
          const failed = records(context, request.request_id).find(
            (item) => item.phase === "failed",
          );
          conflict(
            same(saved, output) && same(failed, record),
            "Action receipt and failure evidence are immutable.",
          );
          return;
        }
        await appendOperationEvent(client, request.request_id, {
          kind: "action",
          payload: record,
        });
        await appendOperationEvent(client, request.request_id, {
          kind: "action_receipt",
          payload: output,
        });
        if (!output.reconcile && request.trigger.kind === "controller")
          await client.query(
            "UPDATE dialogue_operations SET status='fallback' WHERE request_id=$1 AND status='pending'",
            [request.request_id],
          );
        if (!output.reconcile)
          await failConversationInTransaction(
            client,
            context,
            operation,
            output.fallback.reason,
          );
      });
    },
  };
}
