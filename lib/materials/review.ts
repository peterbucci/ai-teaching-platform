import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { MaterialExtractionPreviewSchema } from "./contracts.ts";
import { AttributionSchema } from "../lessons/source-contracts.ts";

export class MaterialReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MaterialReviewError";
  }
}

const ReceiptSchema = z.strictObject({
  // Reject previews signed before strict PDF stream validation, including renewal.
  extractionPolicy: z.literal("material-extraction-v2"),
  actorId: z.uuid(),
  requestId: z.uuid(),
  expiresAt: z.number().int(),
  preview: MaterialExtractionPreviewSchema,
});

export const MaterialReviewSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(200),
    attribution: AttributionSchema,
    permitted_use: z.literal(true),
    reviewed: z.literal(true),
    document_id: z.uuid().optional(),
    expected_latest_version: z.number().int().positive().optional(),
    passages: z
      .array(
        z.strictObject({
          passage_id: z.string().min(1).max(100),
          text: z.string().max(50_000),
          included: z.boolean(),
        }),
      )
      .min(1)
      .max(1000),
  })
  .refine(
    (value) =>
      Boolean(value.document_id) === Boolean(value.expected_latest_version),
    {
      message:
        "A source revision needs both its document and expected version.",
    },
  );

export function createPreviewReceipt(
  actorId: string,
  preview: unknown,
  secret: string,
  now = Date.now(),
  requestId: string = randomUUID(),
) {
  const receipt = ReceiptSchema.parse({
    extractionPolicy: "material-extraction-v2",
    actorId,
    requestId,
    expiresAt: now + 2 * 60 * 60 * 1000,
    preview,
  });
  const payload = Buffer.from(JSON.stringify(receipt)).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

export function verifyPreviewReceipt(
  token: string,
  actorId: string,
  contentHash: string,
  secret: string,
  now = Date.now(),
  allowExpired = false,
) {
  if (token.length > 1_000_000)
    throw new MaterialReviewError(
      "The extraction receipt is invalid. Preview the source again.",
    );
  const [payload, signature, extra] = token.split(".");
  const expected = createHmac("sha256", secret)
    .update(payload ?? "")
    .digest();
  const supplied = Buffer.from(signature ?? "", "base64url");
  if (
    !payload ||
    extra !== undefined ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    throw new MaterialReviewError(
      "The extraction receipt is invalid. Preview the source again.",
    );
  }
  const parsed = ReceiptSchema.safeParse(
    JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
  );
  if (!parsed.success)
    throw new MaterialReviewError(
      "This preview uses an outdated or invalid extraction check. Preview the original source again before saving.",
    );
  const receipt = parsed.data;
  if (
    receipt.actorId !== actorId ||
    receipt.preview.contentHash !== contentHash
  ) {
    throw new MaterialReviewError(
      "The source changed or belongs to another account. Preview it again.",
    );
  }
  if (!allowExpired && receipt.expiresAt < now)
    throw new MaterialReviewError(
      "This preview expired. Keep your corrections and preview the original source again.",
    );
  return receipt;
}

/** Refresh an authentic unchanged preview without losing corrections or retry identity. */
export function renewPreviewReceipt(
  token: string,
  actorId: string,
  contentHash: string,
  secret: string,
  now = Date.now(),
) {
  const previous = verifyPreviewReceipt(
    token,
    actorId,
    contentHash,
    secret,
    now,
    true,
  );
  return {
    preview: previous.preview,
    receipt: createPreviewReceipt(
      actorId,
      previous.preview,
      secret,
      now,
      previous.requestId,
    ),
  };
}

export function reviewedPassages(
  preview: z.infer<typeof MaterialExtractionPreviewSchema>,
  input: unknown,
) {
  const review = MaterialReviewSchema.parse(input);
  if (
    review.passages.length !== preview.passages.length ||
    new Set(review.passages.map((p) => p.passage_id)).size !==
      preview.passages.length
  ) {
    throw new MaterialReviewError(
      "Review every extracted passage exactly once.",
    );
  }
  const changes = new Map(review.passages.map((p) => [p.passage_id, p]));
  const passages = preview.passages.flatMap((original) => {
    const change = changes.get(original.passage_id);
    if (!change)
      throw new MaterialReviewError(
        "The reviewed passage does not belong to this extraction.",
      );
    if (!change.included) return [];
    if (!change.text.trim())
      throw new MaterialReviewError(
        "Included passages cannot be empty. Exclude the passage instead.",
      );
    if (
      /[\p{Cc}\p{Co}\p{Cs}\ufffd]/u.test(change.text.replace(/[\r\n\t]/g, ""))
    )
      throw new MaterialReviewError(
        "Remove unreadable characters from the corrected passage.",
      );
    return [{ ...original, text: change.text }];
  });
  if (!passages.length)
    throw new MaterialReviewError(
      "Include at least one passage before saving.",
    );
  if (passages.reduce((sum, p) => sum + p.text.length, 0) > 50_000)
    throw new MaterialReviewError(
      "Corrected passages must total at most 50,000 characters.",
    );
  return { review, passages };
}
