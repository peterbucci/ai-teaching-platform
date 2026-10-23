import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { PoolClient } from "pg";
import { evidenceRow } from "../db.ts";
import {
  EvidenceError,
  transaction,
  type EvidenceAccess,
} from "../evidence/store.ts";
import {
  AttributionSchema,
  SourcePassageSchema,
  UploadedSourceReferenceSchema,
} from "./source-contracts.ts";

const passages = z
  .array(SourcePassageSchema)
  .min(1)
  .max(500)
  .superRefine((items, context) => {
    if (new Set(items.map((item) => item.passage_id)).size !== items.length)
      context.addIssue({ code: "custom", message: "Duplicate passage IDs" });
    if (items.reduce((total, item) => total + item.text.length, 0) > 50_000)
      context.addIssue({
        code: "custom",
        message: "A source version is limited to 50,000 extracted characters",
      });
  });

/** Server input only: never trust a browser-supplied hash, owner or version ID. */
export const CreateSourceVersionSchema = z
  .strictObject({
    request_id: z.uuid(),
    document_id: z.uuid().optional(),
    expected_latest_version: z.number().int().nonnegative().optional(),
    original_bytes: z
      .instanceof(Uint8Array)
      .refine(
        (bytes) => bytes.byteLength > 0 && bytes.byteLength <= 5_000_000,
        "A source file must contain between 1 and 5,000,000 bytes",
      ),
    file_name: z.string().trim().min(1).max(255),
    mime_type: z.string().trim().min(1).max(120),
    attribution: AttributionSchema,
    extraction: passages,
    passages,
    review_status: z.enum(["extracted", "approved"]),
    permitted_use: z.literal(true),
  })
  .refine(
    (input) =>
      (input.document_id === undefined) ===
      (input.expected_latest_version === undefined),
    "A revision requires both its document ID and expected latest version",
  );
export type CreateSourceVersionInput = z.infer<
  typeof CreateSourceVersionSchema
>;

const StoredSourceVersionSchema = z.object({
  document_id: z.uuid(),
  version: z.number().int().positive(),
  request_id: z.uuid(),
  owner_id: z.uuid(),
  latest_version: z.number().int().positive(),
  file_name: z.string(),
  mime_type: z.string(),
  document_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  excerpt_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  attribution: AttributionSchema,
  extraction: passages,
  passages,
  review_status: z.enum(["extracted", "approved"]),
  permitted_use: z.literal(true),
  created_at: z.iso.datetime({ offset: true }),
});
type StoredSourceVersion = z.infer<typeof StoredSourceVersionSchema>;
export const SourceVersionSchema = StoredSourceVersionSchema.omit({
  owner_id: true,
}).extend({ source_ref: UploadedSourceReferenceSchema });
export type SourceVersion = z.infer<typeof SourceVersionSchema>;

// Explicit metadata columns ensure private original bytes never enter projections.
const sourceColumns = `v.document_id, v.version, v.request_id, d.owner_id,
  d.latest_version, v.file_name, v.mime_type, v.document_sha256, v.excerpt_sha256,
  v.attribution, v.extraction, v.passages, v.review_status, v.permitted_use, v.created_at`;

function sourceVersion(row: unknown) {
  const { owner_id, ...version } = StoredSourceVersionSchema.parse(
    evidenceRow(row),
  );
  return SourceVersionSchema.parse({
    ...version,
    source_ref: UploadedSourceReferenceSchema.parse({
      source_kind: "uploaded",
      source_id: version.document_id,
      source_version: version.version,
      document_sha256: version.document_sha256,
      excerpt_sha256: version.excerpt_sha256,
      attribution: version.attribution,
      access_scope: { teacher_id: owner_id },
    }),
  });
}

function sameRequest(
  stored: StoredSourceVersion,
  input: CreateSourceVersionInput,
  documentHash: string,
  excerptHash: string,
) {
  const sameDocument = input.document_id
    ? input.document_id === stored.document_id &&
      input.expected_latest_version === stored.version - 1
    : stored.version === 1;
  return (
    sameDocument &&
    stored.document_sha256 === documentHash &&
    stored.excerpt_sha256 === excerptHash &&
    stored.file_name === input.file_name &&
    stored.mime_type === input.mime_type &&
    stored.review_status === input.review_status &&
    JSON.stringify(stored.attribution) === JSON.stringify(input.attribution) &&
    JSON.stringify(stored.extraction) === JSON.stringify(input.extraction) &&
    JSON.stringify(stored.passages) === JSON.stringify(input.passages)
  );
}

/** Append an immutable extraction/review snapshot; corrections create a new version. */
export async function createSourceVersion(
  access: EvidenceAccess,
  value: CreateSourceVersionInput,
): Promise<SourceVersion> {
  const input = CreateSourceVersionSchema.parse(value);
  const originalBytes = Buffer.from(input.original_bytes);
  const documentHash = createHash("sha256").update(originalBytes).digest("hex");
  // Ordered reviewed passage objects are the stable, documented excerpt hash input.
  const excerptHash = createHash("sha256")
    .update(JSON.stringify(input.passages))
    .digest("hex");
  return transaction(async (client) => {
    const teacher = await client.query(
      "SELECT id FROM classes WHERE teacher_id=$1 LIMIT 1 FOR SHARE",
      [access.actor.profileId],
    );
    if (!teacher.rows.length)
      throw new EvidenceError(
        403,
        "Only a class teacher can save source material.",
      );
    // Serialize matching request identities, including the first document creation.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('source-version:' || $1))",
      [input.request_id],
    );
    const prior = await client.query(
      `SELECT ${sourceColumns} FROM source_versions v
       JOIN source_documents d ON d.id=v.document_id
       WHERE v.request_id=$1 AND d.owner_id=$2`,
      [input.request_id, access.actor.profileId],
    );
    if (prior.rows[0]) {
      const stored = StoredSourceVersionSchema.parse(
        evidenceRow(prior.rows[0]),
      );
      if (!sameRequest(stored, input, documentHash, excerptHash))
        throw new EvidenceError(
          409,
          "This request already saved different source material.",
        );
      return sourceVersion(stored);
    }
    const documentId = input.document_id ?? randomUUID();
    let latest = 0;
    if (input.document_id) {
      const owned = await client.query(
        `SELECT latest_version FROM source_documents
         WHERE id=$1 AND owner_id=$2 FOR UPDATE`,
        [documentId, access.actor.profileId],
      );
      if (!owned.rows[0])
        throw new EvidenceError(404, "Source document not found.");
      latest = z
        .object({ latest_version: z.number().int().nonnegative() })
        .parse(owned.rows[0]).latest_version;
      if (latest !== input.expected_latest_version)
        throw new EvidenceError(
          409,
          "The source changed. Reload it before saving a revision.",
        );
    } else {
      await client.query(
        "INSERT INTO source_documents(id,owner_id) VALUES ($1,$2)",
        [documentId, access.actor.profileId],
      );
    }
    await client.query(
      `INSERT INTO source_versions(document_id,version,request_id,original_bytes,
       file_name,mime_type,document_sha256,excerpt_sha256,attribution,extraction,
       passages,review_status,permitted_use)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12,true)`,
      [
        documentId,
        latest + 1,
        input.request_id,
        originalBytes,
        input.file_name,
        input.mime_type,
        documentHash,
        excerptHash,
        JSON.stringify(input.attribution),
        JSON.stringify(input.extraction),
        JSON.stringify(input.passages),
        input.review_status,
      ],
    );
    await client.query(
      "UPDATE source_documents SET latest_version=$2 WHERE id=$1",
      [documentId, latest + 1],
    );
    const saved = await client.query(
      `SELECT ${sourceColumns} FROM source_versions v
       JOIN source_documents d ON d.id=v.document_id
       WHERE v.document_id=$1 AND v.version=$2 AND d.owner_id=$3`,
      [documentId, latest + 1, access.actor.profileId],
    );
    return sourceVersion(saved.rows[0]);
  });
}

export async function readSourceVersion(
  access: EvidenceAccess,
  documentId: string,
  version: number,
): Promise<SourceVersion> {
  return transaction((client) =>
    readSourceVersionInTransaction(client, access, documentId, version),
  );
}

/** Reuse the caller's authoring transaction without opening a second pool client. */
export async function readSourceVersionInTransaction(
  client: PoolClient,
  access: EvidenceAccess,
  documentId: string,
  version: number,
): Promise<SourceVersion> {
  z.uuid().parse(documentId);
  z.number().int().positive().parse(version);
  const result = await client.query(
    `SELECT ${sourceColumns} FROM source_versions v
       JOIN source_documents d ON d.id=v.document_id
       WHERE v.document_id=$1 AND v.version=$2 AND d.owner_id=$3`,
    [documentId, version, access.actor.profileId],
  );
  if (!result.rows[0])
    throw new EvidenceError(404, "Source version not found.");
  return sourceVersion(result.rows[0]);
}

export async function listSourceVersions(
  access: EvidenceAccess,
): Promise<SourceVersion[]> {
  return transaction(async (client) => {
    const result = await client.query(
      `SELECT ${sourceColumns} FROM source_versions v
       JOIN source_documents d ON d.id=v.document_id WHERE d.owner_id=$1
       ORDER BY v.created_at DESC, v.document_id, v.version DESC`,
      [access.actor.profileId],
    );
    return result.rows.map(sourceVersion);
  });
}
