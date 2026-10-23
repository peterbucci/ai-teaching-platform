import { z } from "zod";
import { ContentRefSchema } from "../evidence/contracts.ts";
import { LessonDraftContentSchema } from "./contracts.ts";

export const PublishingValidationIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
});
export type PublishingValidationIssue = z.infer<
  typeof PublishingValidationIssueSchema
>;

export const TeacherLessonSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  revision: z.number().int().nonnegative(),
  approved_revision: z.number().int().nullable(),
  content_version: z.string().nullable(),
  published_versions: z.array(z.string()),
});
export type TeacherLessonSummary = z.infer<typeof TeacherLessonSummarySchema>;

export const LessonPublishingReviewSchema = z.object({
  lesson: z.object({
    id: z.string(),
    title: z.string(),
    revision: z.number().int().nonnegative(),
    approved_revision: z.number().int().nullable(),
    draft: LessonDraftContentSchema.nullable(),
  }),
  validation: z.object({
    valid: z.boolean(),
    issues: z.array(PublishingValidationIssueSchema),
  }),
  published_versions: z.array(
    z.object({
      version: z.string(),
      published_at: z.iso.datetime({ offset: true }),
      content_ref: ContentRefSchema,
    }),
  ),
  classes: z.array(z.object({ id: z.uuid(), name: z.string() })),
  assignments: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      instructions: z.string(),
      class_id: z.uuid(),
      class_name: z.string(),
      lesson_version: z.string(),
      teacher_approved_at: z.iso.datetime({ offset: true }).nullable(),
    }),
  ),
});
export type LessonPublishingReview = z.infer<
  typeof LessonPublishingReviewSchema
>;
