import { z } from "zod";
import { StudentSessionViewSchema } from "../evidence/contracts.ts";

export const TutorViewSchema = StudentSessionViewSchema.extend({
  interventions: z.array(
    StudentSessionViewSchema.shape.interventions.element.extend({
      related_attempt_id: z.uuid(),
    }),
  ),
  progress: z.strictObject({
    phase: z.enum(["answer", "evaluate", "feedback", "completed", "failed"]),
    current_attempt_id: z.uuid().nullable(),
    failed_evaluation_id: z.uuid().nullable(),
    retry_allowed: z.boolean(),
    retry_after: z.iso.datetime({ offset: true }).nullable(),
    message: z.string(),
    next_review_at: z.iso.datetime({ offset: true }).nullable(),
  }),
  citations: z.array(
    z.strictObject({
      intervention_id: z.uuid(),
      passage_id: z.string(),
      content_version: z.string(),
      text: z.string(),
      url: z.url(),
    }),
  ),
});
export type TutorView = z.infer<typeof TutorViewSchema>;
export const TutorStepSchema = z.strictObject({
  attempt_id: z.uuid(),
  retry_of: z.uuid().optional(),
});
