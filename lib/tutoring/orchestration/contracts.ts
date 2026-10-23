import { z } from "zod";
import {
  GeneratedDialogueSchema,
  StudentDialogueFallbackSchema,
  type DialogueHistory,
  type DialogueRequest,
  type DialogueState,
} from "../../dialogue/contracts.ts";
import type { DialogueReview } from "../../dialogue/rules.ts";
import {
  ActionSchema,
  ContentRefSchema,
  type SessionEvidence,
} from "../../evidence/contracts.ts";
import type { ApprovedContent } from "../../evidence/content.ts";

export const ORCHESTRATION_VERSION = "tutor-orchestration-v1";
const text = z
  .string()
  .refine((value) => value.trim().length > 0, "Required text");
const ids = z
  .array(text.max(200))
  .min(1)
  .max(12)
  .refine(
    (items) => new Set(items).size === items.length,
    "Duplicate references",
  );
const base = {
  version: z.literal(ORCHESTRATION_VERSION),
  content_ref: ContentRefSchema,
  concept_ids: ids,
  source_passage_ids: ids,
  reason_summary: text.max(600),
};
// Tool names are not new controller actions or lesson states.
export const TutorProposalSchema = z.discriminatedUnion("action", [
  z.strictObject({
    ...base,
    action: z.literal("retrieve_passages"),
    arguments: z.strictObject({}),
  }),
  z.strictObject({
    ...base,
    action: z.literal("clarify"),
    arguments: z.strictObject({ focus: z.enum(["terminology", "reasoning"]) }),
  }),
  z.strictObject({
    ...base,
    action: z.literal("explain"),
    arguments: z.strictObject({
      style: z.enum(["hint", "example", "alternative_explanation"]),
    }),
  }),
  z.strictObject({
    ...base,
    action: z.literal("generate_diagnostic"),
    arguments: z.strictObject({
      target_misconception_ids: z
        .array(text.max(200))
        .max(4)
        .refine(
          (items) => new Set(items).size === items.length,
          "Duplicate hypotheses",
        ),
    }),
  }),
  z.strictObject({
    ...base,
    action: z.literal("generate_followup"),
    arguments: z.strictObject({ intent: z.literal("neutral_clarification") }),
  }),
  z.strictObject({
    ...base,
    action: z.literal("generate_retest"),
    arguments: z.strictObject({}),
  }),
  z.strictObject({
    ...base,
    action: z.literal("return_to_lesson"),
    arguments: z.strictObject({}),
  }),
  z.strictObject({
    ...base,
    action: z.literal("advance_lesson"),
    arguments: z.strictObject({}),
  }),
]);
export type TutorProposal = z.infer<typeof TutorProposalSchema>;
export type TutorTool = TutorProposal["action"];
export const TutorToolSchema = z.enum([
  "retrieve_passages",
  "clarify",
  "explain",
  "generate_diagnostic",
  "generate_followup",
  "generate_retest",
  "return_to_lesson",
  "advance_lesson",
]);
export const OrchestrationFailureSchema = z.enum([
  "disabled",
  "forbidden",
  "invalid_context",
  "invalid_proposal",
  "source_mismatch",
  "stale",
  "cancelled",
  "limit_reached",
  "unsupported",
  "invalid_output",
  "provider_error",
  "timeout",
  "storage_error",
  "pending",
]);
export type OrchestrationFailure = z.infer<typeof OrchestrationFailureSchema>;
export const TutorToolResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("passages"),
    content_ref: ContentRefSchema,
    concept_ids: ids,
    passages: z
      .array(z.strictObject({ id: text, text: text, url: z.url().nullable() }))
      .min(1)
      .max(12),
    assistance_type: z.literal("reading"),
  }),
  z.strictObject({
    kind: z.literal("generated"),
    content: GeneratedDialogueSchema,
  }),
  z.strictObject({ kind: z.literal("return_to_lesson"), attempt_id: z.uuid() }),
  z.strictObject({
    kind: z.literal("advance_lesson"),
    evaluation_id: z.uuid(),
    controller_action: ActionSchema,
  }),
]);
export type TutorToolResult = z.infer<typeof TutorToolResultSchema>;
export const OrchestrationReceiptSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("executed"),
    request_id: z.uuid(),
    action: TutorToolSchema,
    result: TutorToolResultSchema,
  }),
  z.strictObject({
    status: z.literal("stopped"),
    request_id: z.uuid(),
    reason: OrchestrationFailureSchema,
    reconcile: z.boolean(),
    fallback: StudentDialogueFallbackSchema,
  }),
]);
export type OrchestrationReceipt = z.infer<typeof OrchestrationReceiptSchema>;
const recordBase = { action_id: z.uuid() };
// Private audit; never project proposal reasons or rejected output to students.
export const OrchestrationRecordSchema = z.discriminatedUnion("phase", [
  z.strictObject({
    ...recordBase,
    phase: z.literal("proposed"),
    proposal: TutorProposalSchema.nullable(),
    invalid_proposal: z.boolean(),
  }),
  z.strictObject({
    ...recordBase,
    phase: z.literal("validated"),
    allowed_actions: z.array(TutorToolSchema),
    decision: z.enum(["accepted", "rejected"]),
    reason: OrchestrationFailureSchema.nullable(),
  }),
  z.strictObject({
    ...recordBase,
    phase: z.literal("dispatch_started"),
    tool: TutorToolSchema,
  }),
  z.strictObject({
    ...recordBase,
    phase: z.literal("executed"),
    tool: TutorToolSchema,
    result: TutorToolResultSchema,
  }),
  z.strictObject({
    ...recordBase,
    phase: z.literal("failed"),
    stage: z.enum(["context", "proposal", "validation", "dispatch", "commit"]),
    reason: OrchestrationFailureSchema,
    outcome_unknown: z.boolean(),
  }),
]);
export type OrchestrationRecord = z.infer<typeof OrchestrationRecordSchema>;

/** #75 loads this after actor/enrollment checks and #53 exact assignment resolution.
 * Never accept these permissions, evidence or history from model/browser input. */
export type OrchestrationContext = {
  actor_profile_id: string;
  state: DialogueState;
  evidence: SessionEvidence;
  content: ApprovedContent;
  history: DialogueHistory;
  lesson_policy: readonly TutorTool[];
  installed_tools: readonly TutorTool[];
};
export type ProposalPrompt = { instructions: string; input: string };
export type OrchestrationPorts = {
  /** Atomically claim action_id=request_id under #75's existing reservation.
   * Authorize every replay and require identical payload. Unknown remains blocked. */
  claim(
    request: DialogueRequest,
  ): Promise<
    | { kind: "claimed"; context: OrchestrationContext }
    | { kind: "replay"; receipt: OrchestrationReceipt }
    | { kind: "blocked"; reason: OrchestrationFailure }
  >;
  /** Recheck original anchor/revision/cancellation under session lock, append once,
   * return fresh usage/state after any provider reservations. */
  checkpoint(
    request: DialogueRequest,
    record: OrchestrationRecord,
  ): Promise<OrchestrationContext>;
  /** #74 makes one structured call with shared #75 reservation, limits and signal.
   * #75 saves raw proposal/provenance privately; no hidden retry or local counter. */
  propose(
    prompt: ProposalPrompt,
    schema: typeof TutorProposalSchema,
    signal: AbortSignal,
  ): Promise<unknown>;
  /** #74 generation + independent review, each separately reserved by #75.
   * Computation only: no writes or display acknowledgement. */
  generate?(input: {
    proposal: TutorProposal;
    request: DialogueRequest;
    context: OrchestrationContext;
    signal: AbortSignal;
  }): Promise<{ content: unknown; review: DialogueReview }>;
  /** Atomically recheck anchor, apply permitted existing-controller effect (if any),
   * save exact result + executed record and release reservation. Generated alone
   * is never a presented question or displayed assistance. */
  complete(
    request: DialogueRequest,
    proposal: TutorProposal,
    result: TutorToolResult,
  ): Promise<OrchestrationReceipt>;
  /** Use existing operation history; unknown provider/commit outcomes stay blocked
   * for read-only reconciliation. Never erase previous records on failure. */
  fail(
    request: DialogueRequest,
    record: OrchestrationRecord,
    receipt: OrchestrationReceipt,
  ): Promise<void>;
};
