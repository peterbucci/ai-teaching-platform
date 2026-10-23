import { z } from "zod";
import {
  AssistanceSnapshotSchema,
  AttemptSchema,
  ContentRefSchema,
  CorrectnessSchema,
  EvaluationSchema,
} from "../evidence/contracts.ts";
import { ClassMetricsSchema } from "../teacher/metrics.ts";
import { InterventionEvidenceSchema } from "./contracts.ts";

export const InterventionFollowupActionSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("start") }),
  z.strictObject({
    action: z.literal("submit"),
    request_id: z.uuid(),
    response_text: z
      .string()
      .min(1)
      .max(12000)
      .refine((value) => value.trim().length > 0),
  }),
  z.strictObject({
    action: z.literal("retry"),
    request_id: z.uuid(),
    expected_evaluation_id: z.uuid().nullable(),
  }),
]);
export type InterventionFollowupAction = z.infer<
  typeof InterventionFollowupActionSchema
>;
export const StudentInterventionFollowupSchema = z.strictObject({
  approval_id: z.uuid(),
  started_at: z.iso.datetime({ offset: true }).nullable(),
  attempt_id: z.uuid().nullable(),
  submitted_at: z.iso.datetime({ offset: true }).nullable(),
  response_text: z.string().nullable(),
  assistance: AssistanceSnapshotSchema.nullable(),
  evaluation_status: z.enum(["not_submitted", "pending", "accepted", "failed"]),
  evaluation_id: z.uuid().nullable(),
  results: z.array(
    z.strictObject({ concept_id: z.string(), correctness: CorrectnessSchema }),
  ),
  uncertain: z.boolean(),
  feedback: z.string().nullable(),
  retry_allowed: z.boolean(),
  retry_after: z.iso.datetime({ offset: true }).nullable(),
  evaluator_type: EvaluationSchema.shape.evaluator.shape.type.nullable(),
  evaluation_provenance: z
    .enum(["injected_fixture", "configured_model", "human_review", "unknown"])
    .nullable(),
});
export type StudentInterventionFollowup = z.infer<
  typeof StudentInterventionFollowupSchema
>;
export const InterventionComparisonSchema = z.strictObject({
  approval_id: z.uuid(),
  draft_id: z.uuid(),
  approved_revision: z.number().int().positive(),
  assignment_id: z.uuid(),
  content_ref: ContentRefSchema,
  counts: z.strictObject({
    intended: z.number().int(),
    started: z.number().int(),
    submitted: z.number().int(),
    missing: z.number().int(),
    accepted: z.number().int(),
    pending: z.number().int(),
    failed: z.number().int(),
    uncertain: z.number().int(),
  }),
  original_evidence: InterventionEvidenceSchema,
  metrics: ClassMetricsSchema,
  recipients: z.array(
    z.strictObject({
      student_id: z.uuid(),
      display_name: z.string(),
      displayed_at: z.iso.datetime({ offset: true }).nullable(),
      session_id: z.uuid().nullable(),
      followup: StudentInterventionFollowupSchema,
      attempt: AttemptSchema.nullable(),
      evaluation: EvaluationSchema.nullable(),
      evaluations: z.array(EvaluationSchema),
    }),
  ),
});
export type InterventionComparison = z.infer<
  typeof InterventionComparisonSchema
>;
