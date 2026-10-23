import { z } from "zod";

export const MAX_MATERIAL_BYTES = 5_000_000;
export const MAX_EXTRACTED_CHARACTERS = 50_000;
// Operational review bound: avoid thousands of tiny page/heading cards.
export const MAX_MATERIAL_PASSAGES = 500;
export const MAX_PASSAGE_CHARACTERS = 3_000;

export const MaterialPassageSchema = z
  .object({
    // Local extraction keys. The shared source store scopes these to a version.
    passage_id: z.string().regex(/^p\d{3,5}$/),
    text: z.string().min(1).max(MAX_PASSAGE_CHARACTERS),
    page_number: z.number().int().positive().optional(),
    section: z.string().min(1).max(300).optional(),
  })
  .strict();

export const MaterialExtractionPreviewSchema = z
  .object({
    inputKind: z.enum(["paste", "txt", "md", "pdf"]),
    originalFilename: z.string().min(1).max(255).nullable(),
    mediaType: z.string().max(100),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    // Decoded/extracted characters before whitespace normalization and trimming.
    characterCount: z.number().int().positive().max(MAX_EXTRACTED_CHARACTERS),
    passages: z.array(MaterialPassageSchema).min(1).max(MAX_MATERIAL_PASSAGES),
    warnings: z.array(z.string().max(500)).max(10),
  })
  .strict()
  .superRefine((preview, context) => {
    const ids = new Set<string>();
    let characters = 0;
    for (const passage of preview.passages) {
      characters += passage.text.length;
      if (ids.has(passage.passage_id)) {
        context.addIssue({ code: "custom", message: "Duplicate passage key." });
      }
      ids.add(passage.passage_id);
    }
    if (characters > MAX_EXTRACTED_CHARACTERS) {
      context.addIssue({
        code: "custom",
        message: "Source text exceeds 50,000 characters.",
      });
    }
  });

export type MaterialPassage = z.infer<typeof MaterialPassageSchema>;
export type MaterialExtractionPreview = z.infer<
  typeof MaterialExtractionPreviewSchema
>;

export type MaterialExtractionInput =
  | { kind: "paste"; text: string }
  | { kind: "file"; bytes: Uint8Array; filename: string; mediaType: string };

export type MaterialExtractionErrorCode =
  | "invalid_input"
  | "empty_material"
  | "file_too_large"
  | "text_too_long"
  | "unsupported_type"
  | "invalid_utf8"
  | "unreadable_text"
  | "unreadable_pdf"
  | "encrypted_pdf"
  | "pdf_images_unsupported"
  | "pdf_timeout"
  | "pdf_busy";

export class MaterialExtractionError extends Error {
  readonly code: MaterialExtractionErrorCode;

  constructor(code: MaterialExtractionErrorCode, message: string) {
    super(message);
    this.name = "MaterialExtractionError";
    this.code = code;
  }
}
