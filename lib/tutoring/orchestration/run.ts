import "server-only";
import { isDeepStrictEqual } from "node:util";
import {
  DIALOGUE_LIMITS,
  DialogueRequestSchema,
  StudentDialogueContentSchema,
  type DialogueRequest,
} from "../../dialogue/contracts.ts";
import {
  dialogueFallback,
  validateGeneratedDialogue,
} from "../../dialogue/rules.ts";
import { decideTutoring } from "../decide.ts";
import {
  OrchestrationReceiptSchema,
  OrchestrationRecordSchema,
  TutorProposalSchema,
  TutorToolResultSchema,
  type OrchestrationContext,
  type OrchestrationFailure,
  type OrchestrationPorts,
  type OrchestrationReceipt,
  type OrchestrationRecord,
  type TutorProposal,
  type TutorToolResult,
} from "./contracts.ts";
import { OrchestrationError } from "./errors.ts";
import {
  availableTools,
  buildProposalPrompt,
  validateContext,
  validateProposal,
} from "./policy.ts";

function stopped(
  request: DialogueRequest,
  reason: OrchestrationFailure,
  reconcile = false,
): OrchestrationReceipt {
  const fallbackReason =
    reason === "pending" || reason === "storage_error"
      ? "provider_error"
      : reason === "forbidden" ||
          reason === "invalid_context" ||
          reason === "invalid_proposal" ||
          reason === "source_mismatch" ||
          reason === "unsupported"
        ? "invalid_output"
        : reason;
  return OrchestrationReceiptSchema.parse({
    status: "stopped",
    request_id: request.request_id,
    reason,
    reconcile,
    fallback: dialogueFallback(fallbackReason),
  });
}

/** Abort and stop; a late provider result never resumes this execution. #75 must
 * keep the reservation unknown until reconciled, even if abort reaches the SDK. */
async function bounded<T>(
  call: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number = DIALOGUE_LIMITS.timeoutMs,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      call(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new OrchestrationError("timeout", true));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function sameMembers(left: string[], right: string[]) {
  return (
    left.length === right.length && left.every((item) => right.includes(item))
  );
}

async function executeTool(
  proposal: TutorProposal,
  request: DialogueRequest,
  context: OrchestrationContext,
  ports: Pick<OrchestrationPorts, "generate">,
): Promise<TutorToolResult> {
  switch (proposal.action) {
    case "retrieve_passages": {
      const passages = proposal.source_passage_ids.map((id) => {
        const passage = context.content.passages.get(id);
        if (!passage) throw new OrchestrationError("source_mismatch");
        return { id: passage.id, text: passage.text, url: passage.url };
      });
      if (
        passages.reduce((size, p) => size + p.text.length, 0) >
        DIALOGUE_LIMITS.responseCharacters
      )
        throw new OrchestrationError("limit_reached");
      // Match the existing reading service: displayed passage exposure is derived
      // from approved concept/question mappings, never the model's target list.
      const exposedConcepts = new Set<string>();
      for (const concept of context.content.concepts.values())
        if (
          concept.source_passage_ids.some((id) =>
            proposal.source_passage_ids.includes(id),
          )
        )
          exposedConcepts.add(concept.id);
      for (const question of context.content.questions.values())
        if (
          question.source_passage_ids.some((id) =>
            proposal.source_passage_ids.includes(id),
          )
        )
          question.concept_ids.forEach((id) => exposedConcepts.add(id));
      return TutorToolResultSchema.parse({
        kind: "passages",
        content_ref: context.content.content_ref,
        concept_ids: [...exposedConcepts],
        passages,
        assistance_type: "reading",
      });
    }
    case "return_to_lesson":
      return {
        kind: "return_to_lesson",
        attempt_id: request.lesson.attempt_id,
      };
    case "advance_lesson": {
      if (request.trigger.kind !== "controller")
        throw new OrchestrationError("forbidden");
      const decision = decideTutoring(
        context.content,
        context.evidence,
        request.trigger.evaluation_id,
        request.requested_at,
      );
      // This is a checked instruction for #75's atomic existing-controller commit.
      // It is not reported executed until complete() confirms the actual effect.
      return {
        kind: "advance_lesson",
        evaluation_id: request.trigger.evaluation_id,
        controller_action: decision.applied.action,
      };
    }
    default: {
      if (!ports.generate) throw new OrchestrationError("unsupported");
      const generated = await bounded(
        (signal) => ports.generate!({ proposal, request, context, signal }),
        2 * DIALOGUE_LIMITS.timeoutMs,
      );
      let content;
      try {
        content = validateGeneratedDialogue(
          context.content,
          {
            concept_ids: new Set(proposal.concept_ids),
            passage_ids: new Set(proposal.source_passage_ids),
            misconception_ids: new Set(
              proposal.action === "generate_diagnostic"
                ? proposal.arguments.target_misconception_ids
                : [],
            ),
          },
          request,
          generated.content,
          generated.review,
        );
      } catch {
        throw new OrchestrationError("invalid_output");
      }
      const source = content.kind === "question" ? content.question : content;
      if (!sameMembers(source.concept_ids, proposal.concept_ids))
        throw new OrchestrationError("invalid_output");
      if (proposal.action === "clarify" || proposal.action === "explain") {
        if (
          content.kind !== "help" ||
          (proposal.action === "clarify" &&
            content.assistance_type !== "neutral_clarification") ||
          (proposal.action === "explain" &&
            content.assistance_type === "neutral_clarification")
        )
          throw new OrchestrationError("invalid_output");
      } else {
        const intent =
          proposal.action === "generate_diagnostic"
            ? "diagnostic_followup"
            : proposal.action === "generate_followup"
              ? "neutral_clarification"
              : "immediate_retest";
        if (content.kind !== "question" || content.intent !== intent)
          throw new OrchestrationError("invalid_output");
        const normalized = (value: string) =>
          value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
        if (
          context.evidence.attempts.some(
            (attempt) =>
              attempt.question.question_id === content.content_id ||
              normalized(attempt.question.prompt_text) ===
                normalized(content.question.prompt_text),
          )
        )
          throw new OrchestrationError("invalid_output");
      }
      return { kind: "generated", content };
    }
  }
}

/** Revalidate and finish an already dispatched tool using recorded-only generation.
 * This entry point never claims an operation, proposes an action, or starts a provider. */
export async function recoverRecordedTool(
  request: DialogueRequest,
  proposal: TutorProposal,
  context: OrchestrationContext,
  ports: Pick<OrchestrationPorts, "generate" | "complete">,
): Promise<OrchestrationReceipt> {
  validateProposal(
    proposal,
    request,
    context,
    availableTools(request, context, {
      proposalPending: false,
      completed: true,
    }),
    { completed: true },
  );
  const result = TutorToolResultSchema.parse(
    await executeTool(proposal, request, context, ports),
  );
  return OrchestrationReceiptSchema.parse(
    await ports.complete(request, proposal, result),
  );
}

/** One proposal, one permitted tool, then stop for the next saved observation.
 * This function has no database, classifier, answer submission, retry or loop. */
export async function runTutorOrchestration(
  input: unknown,
  ports: OrchestrationPorts,
): Promise<OrchestrationReceipt> {
  const request = DialogueRequestSchema.parse(input);
  let claimed = false;
  let stage: Extract<OrchestrationRecord, { phase: "failed" }>["stage"] =
    "context";
  async function checkpoint(record: OrchestrationRecord) {
    try {
      return await ports.checkpoint(
        request,
        OrchestrationRecordSchema.parse(record),
      );
    } catch (error) {
      if (error instanceof OrchestrationError) throw error;
      throw new OrchestrationError("storage_error", true);
    }
  }
  try {
    const reservation = await ports.claim(request);
    if (reservation.kind === "blocked")
      return stopped(
        request,
        reservation.reason,
        reservation.reason === "pending",
      );
    if (reservation.kind === "replay") {
      const receipt = OrchestrationReceiptSchema.parse(reservation.receipt);
      if (receipt.request_id !== request.request_id)
        throw new OrchestrationError("invalid_context");
      return receipt;
    }
    claimed = true;
    let context = reservation.context;
    validateContext(request, context);
    const executable = availableTools(request, context, {
      proposalPending: true,
      completed: true,
    }).filter(
      (tool) =>
        ports.generate ||
        ![
          "clarify",
          "explain",
          "generate_diagnostic",
          "generate_followup",
          "generate_retest",
        ].includes(tool),
    );
    // A disabled policy or missing adapter is different from a spent call budget.
    const allowed = availableTools(request, context, {
      proposalPending: true,
    }).filter((tool) => executable.includes(tool));
    if (!allowed.length)
      throw new OrchestrationError(
        executable.length ? "limit_reached" : "disabled",
      );
    stage = "proposal";
    const raw = await bounded((signal) =>
      ports.propose(
        buildProposalPrompt(request, context, allowed),
        TutorProposalSchema,
        signal,
      ),
    );
    const parsed = TutorProposalSchema.safeParse(raw);
    context = await checkpoint({
      phase: "proposed",
      action_id: request.request_id,
      proposal: parsed.success ? parsed.data : null,
      invalid_proposal: !parsed.success,
    });
    stage = "validation";
    if (!parsed.success) {
      await checkpoint({
        phase: "validated",
        action_id: request.request_id,
        allowed_actions: allowed,
        decision: "rejected",
        reason: "invalid_proposal",
      });
      throw new OrchestrationError("invalid_proposal");
    }
    const proposal = parsed.data;
    const currentAllowed = availableTools(request, context, {
      proposalPending: false,
    }).filter((tool) => allowed.includes(tool));
    try {
      validateProposal(proposal, request, context, currentAllowed);
    } catch (error) {
      await checkpoint({
        phase: "validated",
        action_id: request.request_id,
        allowed_actions: currentAllowed,
        decision: "rejected",
        reason:
          error instanceof OrchestrationError
            ? error.reason
            : "invalid_proposal",
      });
      throw error;
    }
    context = await checkpoint({
      phase: "validated",
      action_id: request.request_id,
      allowed_actions: currentAllowed,
      decision: "accepted",
      reason: null,
    });
    // Recheck after every async boundary; cancellation or newer evidence wins.
    validateProposal(
      proposal,
      request,
      context,
      availableTools(request, context, { proposalPending: false }).filter(
        (tool) => allowed.includes(tool),
      ),
    );
    context = await checkpoint({
      phase: "dispatch_started",
      action_id: request.request_id,
      tool: proposal.action,
    });
    validateProposal(
      proposal,
      request,
      context,
      availableTools(request, context, { proposalPending: false }).filter(
        (tool) => allowed.includes(tool),
      ),
    );
    stage = "dispatch";
    const result = TutorToolResultSchema.parse(
      await executeTool(proposal, request, context, ports),
    );
    stage = "commit";
    const receipt = OrchestrationReceiptSchema.parse(
      await ports.complete(request, proposal, result),
    );
    if (
      receipt.request_id !== request.request_id ||
      receipt.status !== "executed" ||
      receipt.action !== proposal.action ||
      !isDeepStrictEqual(receipt.result, result)
    )
      throw new OrchestrationError("storage_error", true);
    return receipt;
  } catch (error) {
    const failure =
      error instanceof OrchestrationError
        ? error
        : new OrchestrationError(
            stage === "commit" || stage === "context"
              ? "storage_error"
              : "provider_error",
            true,
          );
    const receipt = stopped(
      request,
      failure.reason,
      failure.reconcile || stage === "commit",
    );
    if (claimed) {
      try {
        await ports.fail(
          request,
          {
            phase: "failed",
            action_id: request.request_id,
            stage,
            reason: failure.reason,
            outcome_unknown: receipt.status === "stopped" && receipt.reconcile,
          },
          receipt,
        );
      } catch {
        return stopped(request, "storage_error", true);
      }
    }
    return receipt;
  }
}

/** Explicit projection: the private receipt is for #75 only. Display acknowledgement
 * remains #75's existing delivery flow; returning this value records no assistance. */
export function toStudentOrchestrationReceipt(input: OrchestrationReceipt) {
  const receipt = OrchestrationReceiptSchema.parse(input);
  if (receipt.status === "stopped")
    return {
      status: receipt.status,
      request_id: receipt.request_id,
      reconcile: receipt.reconcile,
      fallback: receipt.fallback,
    };
  const result = receipt.result;
  if (result.kind !== "generated") return receipt;
  const content = result.content;
  const safe =
    content.kind === "help"
      ? {
          kind: "help",
          content_id: content.content_id,
          text: content.text,
          concept_ids: content.concept_ids,
          source_passage_ids: content.source_passage_ids,
          content_ref: content.content_ref,
        }
      : {
          kind: "question",
          content_id: content.content_id,
          question: {
            question_id: content.question.question_id,
            prompt_text: content.question.prompt_text,
            concept_ids: content.question.concept_ids,
            source_passage_ids: content.question.source_passage_ids,
            content_ref: content.question.content_ref,
          },
        };
  return {
    status: receipt.status,
    request_id: receipt.request_id,
    result: {
      kind: "generated" as const,
      content: StudentDialogueContentSchema.parse(safe),
    },
  };
}
