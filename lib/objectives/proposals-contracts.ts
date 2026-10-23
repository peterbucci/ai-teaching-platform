import { z } from "zod";

import { CheckedObjectiveSuggestionSchema } from "./contracts.ts";
export const CheckedSuggestionSchema = CheckedObjectiveSuggestionSchema;
const metadata = z.object({
  phase: z.enum(["suggestion", "support"]),
  model: z.string().nullable(),
  responseId: z.string().nullable(),
  latencyMs: z.number(),
  usage: z
    .object({
      inputTokens: z.number(),
      outputTokens: z.number(),
      totalTokens: z.number(),
    })
    .nullable(),
});
export const GenerationOutcomeSchema = z.discriminatedUnion("ok", [
  z.strictObject({
    ok: z.literal(true),
    suggestions: z.array(CheckedSuggestionSchema).max(8),
    provider: z.array(metadata),
  }),
  z.strictObject({
    ok: z.literal(false),
    code: z.string(),
    message: z.string(),
    provider: z.array(metadata),
  }),
]);
export const ObjectiveProposalSchema = z.object({
  request_id: z.uuid(),
  lesson_id: z.string(),
  expected_revision: z.number().int().positive(),
  status: z.enum(["pending", "completed", "failed", "stale", "applied"]),
  result: GenerationOutcomeSchema.nullable(),
  applied_revision: z.number().int().positive().nullable(),
  accepted_indices: z.array(z.number().int()).nullable(),
  created_at: z.iso.datetime({ offset: true }),
});
export type ObjectiveProposal = z.infer<typeof ObjectiveProposalSchema>;
export const SuggestRequestSchema = z.strictObject({
  request_id: z.uuid(),
  expected_revision: z.number().int().positive(),
});
export const AcceptSuggestionsSchema = SuggestRequestSchema.extend({
  indices: z.array(z.number().int().nonnegative().max(7)).min(1).max(8),
}).refine(
  (value) => new Set(value.indices).size === value.indices.length,
  "Choose each suggestion once.",
);
