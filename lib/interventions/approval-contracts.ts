import { z } from "zod";
import { ContentRefSchema } from "../evidence/contracts.ts";
import {
  InterventionActivitySchema,
  InterventionEvidenceSchema,
  type InterventionActivity,
} from "./contracts.ts";
import {
  InterventionDraftSchema,
  InterventionProvenanceSchema,
} from "./drafts.ts";

const recipientIds = z
  .array(z.uuid())
  .min(1)
  .max(500)
  .refine((ids) => new Set(ids).size === ids.length, "Duplicate recipients");
const request = {
  request_id: z.uuid(),
  expected_revision: z.number().int().positive(),
};
export const InterventionActionSchema = z.discriminatedUnion("action", [
  z.strictObject({
    ...request,
    action: z.literal("save"),
    activity: InterventionActivitySchema,
  }),
  z.strictObject({ ...request, action: z.literal("dismiss") }),
  z.strictObject({
    ...request,
    action: z.literal("approve"),
    recipient_ids: recipientIds,
  }),
  z.strictObject({
    ...request,
    action: z.literal("deliver"),
    approval_id: z.uuid(),
  }),
]);
export type InterventionAction = z.infer<typeof InterventionActionSchema>;

export const InterventionApprovalSchema = z.strictObject({
  id: z.uuid(),
  draft_id: z.uuid(),
  assignment_id: z.uuid(),
  approved_revision: z.number().int().positive(),
  approved_by: z.uuid(),
  approved_at: z.iso.datetime({ offset: true }),
  recipient_ids: recipientIds,
  activity: InterventionActivitySchema,
  content_ref: ContentRefSchema,
  evidence: InterventionEvidenceSchema,
  provenance: InterventionProvenanceSchema,
});
export type InterventionApproval = z.infer<typeof InterventionApprovalSchema>;
export const InterventionDeliverySchema = z.strictObject({
  id: z.uuid(),
  approval_id: z.uuid(),
  delivered_by: z.uuid(),
  delivered_at: z.iso.datetime({ offset: true }),
  recipient_ids: recipientIds,
});
export const InterventionReviewSchema = z.strictObject({
  draft: InterventionDraftSchema,
  eligible_recipients: z.array(
    z.strictObject({ student_id: z.uuid(), display_name: z.string() }),
  ),
  approval: InterventionApprovalSchema.nullable(),
  delivery: InterventionDeliverySchema.nullable(),
});
export type InterventionReview = z.infer<typeof InterventionReviewSchema>;

const StudentQuestionSchema = z.strictObject({
  question_id: z.string().min(1),
  prompt_text: z.string().min(1),
  concept_ids: z.array(z.string()),
  source_passage_ids: z.array(z.string()),
});
export const StudentInterventionActivitySchema = z.strictObject({
  title: z.string(),
  learning_objective: z.string(),
  explanation: z.string(),
  exercise_text: z.string(),
  practice_questions: z.array(StudentQuestionSchema),
  fresh_check: StudentQuestionSchema,
  source_references: InterventionActivitySchema.shape.source_references,
});
export type StudentInterventionActivity = z.infer<
  typeof StudentInterventionActivitySchema
>;
/** Explicit allowlist: never serialize a draft, rubric, recommendation or evidence to students. */
export function toStudentInterventionActivity(
  activity: InterventionActivity,
): StudentInterventionActivity {
  const question = (q: InterventionActivity["fresh_check"]) => ({
    question_id: q.question_id,
    prompt_text: q.prompt_text,
    concept_ids: q.concept_ids,
    source_passage_ids: q.source_passage_ids,
  });
  return StudentInterventionActivitySchema.parse({
    title: activity.title,
    learning_objective: activity.learning_objective,
    explanation: activity.explanation,
    exercise_text: activity.exercise_text,
    practice_questions: activity.practice_questions.map(question),
    fresh_check: question(activity.fresh_check),
    source_references: activity.source_references,
  });
}
export const StudentInterventionSchema = z.strictObject({
  approval_id: z.uuid(),
  draft_id: z.uuid(),
  assignment_id: z.uuid(),
  delivered_at: z.iso.datetime({ offset: true }),
  displayed_at: z.iso.datetime({ offset: true }).nullable(),
  content_ref: ContentRefSchema,
  activity: StudentInterventionActivitySchema,
});
export type StudentIntervention = z.infer<typeof StudentInterventionSchema>;
