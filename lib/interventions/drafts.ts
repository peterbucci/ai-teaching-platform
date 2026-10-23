import { z } from "zod";
import {
  InterventionActivitySchema,
  InterventionSelectionSchema,
  InterventionEvidenceSchema,
} from "./contracts.ts";

export const InterventionGenerationRequestSchema = z.strictObject({
  request_id: z.uuid(),
  draft_id: z.uuid(),
  expected_revision: z.number().int().nonnegative(),
  selection: InterventionSelectionSchema,
  revision_instructions: z.string().trim().max(1500).default(""),
});
export type InterventionGenerationRequest = z.infer<
  typeof InterventionGenerationRequestSchema
>;
export const InterventionProvenanceSchema = z.strictObject({
  model: z.string().min(1),
  response_id: z.string().min(1),
  prompt_template_version: z.string().min(1),
  generated_at: z.iso.datetime({ offset: true }),
  usage: z
    .strictObject({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      totalTokens: z.number().int().nonnegative(),
    })
    .nullable(),
});
export const InterventionDraftSchema = z.strictObject({
  id: z.uuid(),
  assignment_id: z.uuid(),
  revision: z.number().int().positive(),
  status: z.literal("private_draft"),
  activity: InterventionActivitySchema,
  evidence: InterventionEvidenceSchema,
  provenance: InterventionProvenanceSchema,
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});
export type InterventionDraft = z.infer<typeof InterventionDraftSchema>;
export const InterventionGenerationResponseSchema = z.strictObject({
  status: z.enum(["completed", "pending", "failed"]),
  request_id: z.uuid(),
  draft: InterventionDraftSchema.nullable(),
  error: z.string().optional(),
});
export type InterventionGenerationResponse = z.infer<
  typeof InterventionGenerationResponseSchema
>;
