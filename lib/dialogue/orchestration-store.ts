import "server-only";
import { z } from "zod";
import { type EvidenceAccess, transaction } from "../evidence/store.ts";
import {
  DIALOGUE_LIMITS,
  DialogueHistorySchema,
  DialogueRequestSchema,
  type DialogueRequest,
} from "./contracts.ts";
import { dialogueFallback } from "./rules.ts";
import {
  appendOperationEvent,
  conflict,
  currentOperation,
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
} from "../tutoring/orchestration/contracts.ts";

function authorizeRequest(context: DialogueContext, input: DialogueRequest) {
  const request = DialogueRequestSchema.parse(input);
  const operation = currentOperation(context, request.request_id);
  conflict(
    operation.dialogue_request && same(operation.dialogue_request, request),
    "Action request differs from its saved authorized request.",
  );
  return operation;
}
function actionContext(
  context: DialogueContext,
  access: EvidenceAccess,
  approvedTools: readonly ("clarify" | "explain")[],
): OrchestrationContext {
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
    state: view.dialogue.state,
    evidence: context.evidence,
    content: context.content,
    history: DialogueHistorySchema.parse(history),
    lesson_policy: approvedTools,
    installed_tools: approvedTools,
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
 * Only grounded conversational help is installed; generated assessment handoff,
 * reading delivery and controller progression require their reviewed adapters. */
export function createOrchestrationPersistence(
  access: EvidenceAccess,
  sessionId: string,
  approvedHelpTools: readonly ("clarify" | "explain")[] = [],
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
          context: actionContext(context, access, approvedHelpTools),
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
          return actionContext(context, access, approvedHelpTools);
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
            approvedHelpTools.some((tool) => tool === record.tool),
            "This tool has no installed persistence adapter.",
          );
        }
        await appendOperationEvent(client, request.request_id, {
          kind: "action",
          payload: record,
        });
        return actionContext(context, access, approvedHelpTools);
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
        conflict(
          approvedHelpTools.some((tool) => tool === proposal.action) &&
            result.kind === "generated" &&
            result.content.kind === "help",
          "Tool delivery is not installed.",
        );
        // #85 validates semantic grounding/disclosure before invoking complete.
        const accepted = await commitConversationHelpInTransaction(
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
