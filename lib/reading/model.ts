import { z } from "zod";
import { ReadingSchema } from "../assignments/contracts.ts";

export const ReaderLocationSchema = z.strictObject({
  assignmentId: z.uuid().optional(),
  contentVersion: z.string().min(1).max(200).optional(),
  passageId: z.string().min(1).max(200).optional(),
  sessionId: z.uuid().optional(),
});
export type ReaderLocation = z.infer<typeof ReaderLocationSchema>;

const ReaderAssignmentSchema = z.strictObject({
  id: z.uuid(),
  title: z.string(),
  classId: z.uuid(),
  className: z.string(),
});
const ReaderChoiceSchema = z.strictObject({
  id: z.uuid(),
  classId: z.uuid(),
  className: z.string(),
  sourceTitle: z.string(),
  sourceChapter: z
    .strictObject({ number: z.string().nullable(), title: z.string() })
    .nullable(),
  sourceSection: z.string(),
  contentVersion: z.string(),
  passageIds: z.array(z.string()),
});
export const StudentReaderViewSchema = z.strictObject({
  readings: z.array(ReaderChoiceSchema),
  assignment: ReaderAssignmentSchema,
  reading: ReadingSchema.extend({
    sourcePath: z.array(
      z.strictObject({
        number: z.string().nullable(),
        title: z.string(),
        kind: z.enum(["chapter", "section"]),
      }),
    ),
    sections: z.array(
      ReadingSchema.shape.sections.element.extend({
        url: z.url(),
        conceptIds: z.array(z.string()),
      }),
    ),
    concepts: z.array(
      z.strictObject({
        id: z.string(),
        title: z.string(),
        passageIds: z.array(z.string()),
      }),
    ),
  }),
  selectedPassageId: z.string(),
  session: z
    .strictObject({
      id: z.uuid(),
      currentAttemptId: z.uuid().nullable(),
      pendingPassageId: z.string().nullable(),
    })
    .nullable(),
  bookmarkedPassageIds: z.array(z.string()),
});
export type StudentReaderView = z.infer<typeof StudentReaderViewSchema>;

export const ReadingBookmarkSchema = z.strictObject({
  assignment_id: z.uuid(),
  content_version: z.string().min(1).max(200),
  passage_id: z.string().min(1).max(200),
});
export const ReadingBookmarkResultSchema = z.strictObject({
  passage_id: z.string(),
  saved: z.boolean(),
});
