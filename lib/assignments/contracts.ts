import { z } from "zod";
import { ContentRefSchema } from "../evidence/contracts.ts";

export const ReadingSchema = z.strictObject({
  content_ref: ContentRefSchema,
  attribution: z.strictObject({
    title: z.string(),
    authors: z.array(z.string()),
    copyright: z.string(),
    section: z.string(),
    url: z.url(),
    license: z.string(),
    license_url: z.url(),
    cautions: z.array(z.string()),
  }),
  sections: z.array(
    z.strictObject({ id: z.string(), title: z.string(), text: z.string() }),
  ),
});
export const OpenPassageSchema = z.strictObject({
  passage_id: z.string().min(1),
  citation_id: z.uuid().optional(),
});
export const PassageDeliverySchema = z.strictObject({
  intervention_id: z.uuid(),
  passage: ReadingSchema.shape.sections.element,
  content_ref: ContentRefSchema,
});
export type AssignedReadingView = z.infer<typeof ReadingSchema>;
