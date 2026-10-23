import { z } from "zod";
import { UploadedSourceReferenceSchema } from "../lessons/source-contracts.ts";

const text = z.string().trim().min(1);
export const ObjectiveEmphasisSchema = z.enum([
  "essential",
  "supporting",
  "optional",
]);
export const ObjectiveEvidenceSchema = z.strictObject({
  passage_id: text.max(120),
  quote: text.max(4000),
});
export const ObjectiveSupportSchema = z.strictObject({
  status: z.enum(["supported", "uncertain", "unsupported"]),
  reason: text.max(2000),
  evidence: z.array(ObjectiveEvidenceSchema).max(20),
});
export const CheckedObjectiveSuggestionSchema = z.strictObject({
  concept_name: text.max(200),
  objective: text.max(2000),
  passage_ids: z.array(text.max(120)).min(1).max(20),
  emphasis: ObjectiveEmphasisSchema.nullable(),
  uncertainty: z.string().trim().max(2000).nullable(),
  support: ObjectiveSupportSchema,
});
export type CheckedObjectiveSuggestion = z.infer<
  typeof CheckedObjectiveSuggestionSchema
>;

/** Browser-editable values only. Review actor/time and AI checks are server-owned. */
export const ObjectiveEditSchema = z.strictObject({
  concept_id: z.uuid(),
  concept_name: text.max(200),
  objective: text.max(2000),
  passage_ids: z.array(text.max(120)).max(20),
  emphasis: ObjectiveEmphasisSchema.nullable(),
  support_evidence: z.array(ObjectiveEvidenceSchema).max(20),
  support_note: z.string().trim().max(2000),
  teacher_verified: z.boolean(),
});
export type ObjectiveEdit = z.infer<typeof ObjectiveEditSchema>;
export const ObjectiveReviewSchema = z.strictObject({
  reviewed_by: z.uuid(),
  reviewed_at: z.iso.datetime({ offset: true }),
});
export const ObjectiveItemSchema = ObjectiveEditSchema.extend({
  origin: z.enum(["manual", "ai"]),
  ai_baseline: z
    .strictObject({
      concept_name: text.max(200),
      objective: text.max(2000),
      passage_ids: z.array(text.max(120)).max(20),
      support_status: z.enum(["supported", "uncertain", "unsupported"]),
    })
    .nullable(),
  uncertainty: z.string().trim().max(2000).nullable(),
  support: ObjectiveSupportSchema,
  review: ObjectiveReviewSchema.nullable(),
});
export type ObjectiveItem = z.infer<typeof ObjectiveItemSchema>;
export const ObjectiveWorkflowSchema = z.strictObject({
  source_ref: UploadedSourceReferenceSchema,
  creation: z.strictObject({ request_id: z.uuid(), title: text.max(300) }),
  items: z.array(ObjectiveItemSchema).max(40),
  reviewed: ObjectiveReviewSchema.extend({
    revision: z.number().int().positive(),
  }).nullable(),
});
export type ObjectiveWorkflow = z.infer<typeof ObjectiveWorkflowSchema>;
export const CreateObjectiveDraftSchema = z.strictObject({
  request_id: z.uuid(),
  title: text.max(300),
  source_id: z.uuid(),
  source_version: z.number().int().positive(),
});
export const SaveObjectiveDraftSchema = z.strictObject({
  lesson_id: z.uuid(),
  expected_revision: z.number().int().positive(),
  title: text.max(300),
  items: z.array(ObjectiveEditSchema).max(40),
});
