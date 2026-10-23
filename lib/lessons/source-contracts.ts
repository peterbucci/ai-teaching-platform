import { z } from "zod";

const text = z.string().trim().min(1);
export const AttributionSchema = z.strictObject({
  title: text,
  authors: z.array(text).min(1),
  copyright: text,
  section: text,
  url: z.url().nullable(),
  license: text,
  license_url: z.url().nullable(),
  cautions: z.array(text),
});
/** Private source identity is independent of any lesson publication. */
export const UploadedSourceReferenceSchema = z.strictObject({
  source_kind: z.literal("uploaded"),
  source_id: z.uuid(),
  source_version: z.number().int().positive(),
  document_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  excerpt_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  attribution: AttributionSchema,
  access_scope: z.strictObject({ teacher_id: z.uuid() }),
});
export type UploadedSourceReference = z.infer<
  typeof UploadedSourceReferenceSchema
>;
export const SourcePassageSchema = z.strictObject({
  passage_id: text.max(120),
  text: z.string().min(1).max(50000),
  page_number: z.number().int().positive().optional(),
  section: text.optional(),
});
export type SourcePassage = z.infer<typeof SourcePassageSchema>;
