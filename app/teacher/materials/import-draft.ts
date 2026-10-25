import { z } from "zod";
import {
  MaterialExtractionPreviewSchema,
  MAX_EXTRACTED_CHARACTERS,
} from "../../../lib/materials/contracts.ts";

// Unfinished local work is recoverable; the existing importer still validates
// the signed receipt, original bytes, actor, passage IDs and revision on save.
export const MaterialImportDraftSchema = z
  .object({
    mode: z.enum(["paste", "file"]),
    text: z.string().max(MAX_EXTRACTED_CHARACTERS),
    filename: z.string().max(255).nullable(),
    preview: MaterialExtractionPreviewSchema.nullable(),
    receipt: z.string().max(1_000_000),
    passages: z
      .array(
        z.object({
          passage_id: z.string().max(100),
          text: z.string().max(MAX_EXTRACTED_CHARACTERS),
          included: z.boolean(),
        }),
      )
      .max(500),
    title: z.string().max(200),
    authors: z.string().max(4000),
    copyright: z.string().max(4000),
    license: z.string().max(4000),
    sourceUrl: z.string().max(2000),
  })
  .superRefine((draft, context) => {
    if (!draft.preview) {
      if (draft.receipt || draft.passages.length) {
        context.addIssue({
          code: "custom",
          message: "Review needs its original preview.",
        });
      }
      return;
    }
    if (
      !draft.receipt ||
      draft.preview.passages.length !== draft.passages.length ||
      draft.passages.some(
        (passage, index) =>
          passage.passage_id !== draft.preview?.passages[index]?.passage_id,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Passages must retain their extraction identity and order.",
      });
    }
  });

export type MaterialImportDraft = z.infer<typeof MaterialImportDraftSchema>;

export function materialRecoveryKey(
  actorId: string,
  documentId?: string,
  version?: number,
) {
  return `learning-pulse:material-import:${actorId}:${documentId ?? "new"}:${version ?? 0}`;
}

export function parseMaterialRecovery(
  value: string | null,
): MaterialImportDraft | null {
  if (!value || value.length > 2_000_000) return null;
  try {
    const parsed = MaterialImportDraftSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
