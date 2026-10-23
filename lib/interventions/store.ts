import "server-only";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { PoolClient } from "pg";
import { z } from "zod";
import { assignmentReview } from "../assignments/store.ts";
import { evidenceRow } from "../db.ts";
import { validateContentRef } from "../evidence/content.ts";
import {
  readAssignmentContent,
  resolveAssignmentContent,
} from "../lessons/store.ts";
import {
  EvidenceError,
  transaction,
  type EvidenceAccess,
} from "../evidence/store.ts";
import { readAssignmentEvidence } from "../teacher/store.ts";
import {
  buildInterventionEvidence,
  interventionRevisionEvidence,
} from "./evidence.ts";
import {
  interventionPrompt,
  InterventionValidationError,
  validateInterventionActivity,
} from "./generate.ts";
import { requestIntervention } from "./provider.ts";
import {
  INTERVENTION_PROMPT_VERSION,
  type InterventionEvidence,
} from "./contracts.ts";
import {
  InterventionDraftSchema,
  InterventionGenerationRequestSchema,
  InterventionGenerationResponseSchema,
  type InterventionDraft,
  type InterventionGenerationRequest,
  type InterventionGenerationResponse,
} from "./drafts.ts";

const requestRow = z.object({
  request_id: z.uuid(),
  draft_id: z.uuid(),
  request_hash: z.string(),
  status: z.enum(["pending", "completed", "failed"]),
  result_snapshot: z.unknown(),
  error: z.string().nullable(),
});
const draftRow = z.object({
  id: z.uuid(),
  revision: z.number().int(),
  snapshot: z.unknown(),
  created_at: z.iso.datetime({ offset: true }),
});

async function authorize(
  client: PoolClient,
  access: EvidenceAccess,
  assignmentId: string,
) {
  z.uuid().parse(assignmentId);
  const owned = await client.query(
    `SELECT a.id FROM assignments a JOIN classes c ON c.id=a.class_id
     WHERE a.id=$1 AND c.teacher_id=$2 FOR SHARE OF c,a`,
    [assignmentId, access.actor.profileId],
  );
  if (!owned.rows.length) throw new EvidenceError(404, "Assignment not found.");
}

/** The same immutable assignment source must still be authorized at dispatch and save. */
async function requireCurrentSource(
  client: PoolClient,
  access: EvidenceAccess,
  evidence: InterventionEvidence,
) {
  const content = await resolveAssignmentContent(
    client,
    access,
    evidence.selection.assignment_id,
    "teacher",
  );
  try {
    validateContentRef(content, evidence.content_ref);
    if (
      evidence.sources.some(
        (source) =>
          content.passages.get(source.passage_id)?.text !== source.text,
      )
    )
      throw new Error("Source passages changed");
  } catch {
    throw new EvidenceError(
      409,
      "The draft no longer matches its assigned lesson and source version.",
    );
  }
}

function response(
  row: z.infer<typeof requestRow>,
  current: unknown,
): InterventionGenerationResponse {
  return InterventionGenerationResponseSchema.parse({
    status: row.status,
    request_id: row.request_id,
    draft: row.status === "completed" ? row.result_snapshot : current,
    ...(row.error ? { error: row.error } : {}),
  });
}

async function currentDraft(
  client: PoolClient,
  access: EvidenceAccess,
  draftId: string,
) {
  const found = await client.query(
    `SELECT id,revision,snapshot,created_at FROM teacher_intervention_drafts
     WHERE id=$1 AND teacher_id=$2 FOR UPDATE`,
    [draftId, access.actor.profileId],
  );
  return found.rows[0] ? draftRow.parse(evidenceRow(found.rows[0])) : null;
}

export async function readInterventionDrafts(
  access: EvidenceAccess,
  assignmentId: string,
) {
  return transaction(async (client) => {
    await authorize(client, access, assignmentId);
    const rows = await client.query(
      `SELECT snapshot FROM teacher_intervention_drafts WHERE teacher_id=$1 AND assignment_id=$2
       AND revision>0 ORDER BY updated_at DESC LIMIT 30`,
      [access.actor.profileId, assignmentId],
    );
    return rows.rows.map((row) => InterventionDraftSchema.parse(row.snapshot));
  });
}

export async function readInterventionDraft(
  access: EvidenceAccess,
  draftId: string,
): Promise<InterventionDraft> {
  z.uuid().parse(draftId);
  return transaction(async (client) => {
    const rows = await client.query(
      `SELECT d.snapshot FROM teacher_intervention_drafts d JOIN assignments a ON a.id=d.assignment_id
       JOIN classes c ON c.id=a.class_id WHERE d.id=$1 AND d.teacher_id=$2 AND c.teacher_id=$2 AND d.revision>0`,
      [draftId, access.actor.profileId],
    );
    if (!rows.rows[0]) throw new EvidenceError(404, "Draft not found.");
    return InterventionDraftSchema.parse(rows.rows[0].snapshot);
  });
}

// An interrupted process never reissues its paid call. The reservation becomes a
// terminal unknown outcome; a late result cannot replace a newer revision.
async function expirePending(client: PoolClient, access: EvidenceAccess) {
  await client.query(
    `UPDATE teacher_intervention_requests SET status='failed',completed_at=clock_timestamp(),
     error='Generation outcome is unknown after interruption. The previous draft is intact. Review it before explicitly starting a new request.'
     WHERE teacher_id=$1 AND status='pending' AND created_at < clock_timestamp()-interval '2 minutes'`,
    [access.actor.profileId],
  );
}

export async function readInterventionRequest(
  access: EvidenceAccess,
  assignmentId: string,
  requestId: string,
) {
  z.uuid().parse(requestId);
  return transaction(async (client) => {
    await authorize(client, access, assignmentId);
    await expirePending(client, access);
    const rows = await client.query(
      `SELECT r.*,d.snapshot AS current_snapshot FROM teacher_intervention_requests r
       JOIN teacher_intervention_drafts d ON d.id=r.draft_id
       WHERE r.teacher_id=$1 AND r.assignment_id=$2 AND r.request_id=$3`,
      [access.actor.profileId, assignmentId, requestId],
    );
    if (!rows.rows[0])
      throw new EvidenceError(404, "Generation request not found.");
    return response(
      requestRow.parse(rows.rows[0]),
      rows.rows[0].current_snapshot,
    );
  });
}

async function reserve(
  access: EvidenceAccess,
  input: InterventionGenerationRequest,
) {
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return transaction(async (client) => {
    await authorize(client, access, input.selection.assignment_id);
    // Serialize reservations for this teacher, including different draft IDs.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `intervention:${access.actor.profileId}`,
    ]);
    await expirePending(client, access);
    const existing = await client.query(
      "SELECT * FROM teacher_intervention_requests WHERE teacher_id=$1 AND request_id=$2 FOR UPDATE",
      [access.actor.profileId, input.request_id],
    );
    if (existing.rows[0]) {
      const row = requestRow.parse(existing.rows[0]);
      if (row.request_hash !== hash)
        throw new EvidenceError(
          409,
          "This request ID was already used for different draft content.",
        );
      const draft = await currentDraft(client, access, row.draft_id);
      return { replay: response(row, draft?.snapshot ?? null) };
    }
    const budget = await client.query(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE status='pending')::int AS pending
       FROM teacher_intervention_requests WHERE teacher_id=$1 AND created_at>clock_timestamp()-interval '1 hour'`,
      [access.actor.profileId],
    );
    const counts = z
      .object({ total: z.number(), pending: z.number() })
      .parse(budget.rows[0]);
    if (counts.pending)
      throw new EvidenceError(
        409,
        "Another generation is still pending. Check its status before starting another.",
      );
    if (counts.total >= 10)
      throw new EvidenceError(
        409,
        "The hourly limit of 10 draft requests has been reached. Review saved drafts or try later.",
      );
    let draft = await currentDraft(client, access, input.draft_id);
    if (!draft) {
      if (input.expected_revision !== 0)
        throw new EvidenceError(
          409,
          "The draft changed. Reload before requesting a revision.",
        );
      const inserted = await client.query(
        `INSERT INTO teacher_intervention_drafts(id,teacher_id,assignment_id) VALUES($1,$2,$3)
         RETURNING id,revision,snapshot,created_at`,
        [input.draft_id, access.actor.profileId, input.selection.assignment_id],
      );
      draft = draftRow.parse(evidenceRow(inserted.rows[0]));
    } else {
      const scope = await client.query(
        "SELECT 1 FROM teacher_intervention_drafts WHERE id=$1 AND assignment_id=$2",
        [input.draft_id, input.selection.assignment_id],
      );
      if (!scope.rows.length)
        throw new EvidenceError(409, "Draft and assignment do not match.");
    }
    if (draft.revision !== input.expected_revision)
      throw new EvidenceError(
        409,
        "The draft changed. Reload the latest revision before generating.",
      );
    if (
      draft.snapshot !== null &&
      InterventionDraftSchema.parse(draft.snapshot).status !== "private_draft"
    )
      throw new EvidenceError(
        409,
        "Approved and dismissed drafts cannot be regenerated.",
      );
    if (
      draft.snapshot !== null &&
      !isDeepStrictEqual(
        InterventionDraftSchema.parse(draft.snapshot).evidence.selection,
        input.selection,
      )
    )
      throw new EvidenceError(
        409,
        "A revision must use the draft's saved evidence selection. Start a new draft for different evidence.",
      );
    const attempts = await client.query(
      "SELECT count(*)::int AS count FROM teacher_intervention_requests WHERE draft_id=$1",
      [input.draft_id],
    );
    if (z.object({ count: z.number() }).parse(attempts.rows[0]).count >= 6)
      throw new EvidenceError(
        409,
        "This draft has reached its limit of 6 generation requests. Review the saved work.",
      );
    await client.query(
      `INSERT INTO teacher_intervention_requests(request_id,teacher_id,assignment_id,draft_id,expected_revision,request_hash,request,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,'pending')`,
      [
        input.request_id,
        access.actor.profileId,
        input.selection.assignment_id,
        input.draft_id,
        input.expected_revision,
        hash,
        input,
      ],
    );
    return { draft };
  });
}

/** Explicit teacher-only operation; a provider proposal can only save a private draft. */
export async function generateInterventionDraft(
  access: EvidenceAccess,
  raw: unknown,
  provider: typeof requestIntervention = requestIntervention,
): Promise<InterventionGenerationResponse> {
  const input = InterventionGenerationRequestSchema.parse(raw);
  await assignmentReview(access, input.selection.assignment_id);
  const content = await readAssignmentContent(
    access,
    input.selection.assignment_id,
    "teacher",
  );
  const reserved = await reserve(access, input);
  if (reserved.replay) return reserved.replay;
  const previous = reserved.draft;
  let provenance: unknown = null;
  try {
    const previousDraft =
      previous.snapshot === null
        ? null
        : InterventionDraftSchema.parse(previous.snapshot);
    const bundle = previousDraft
      ? interventionRevisionEvidence(
          content,
          previousDraft.evidence,
          previousDraft.provenance.prompt_template_version,
        )
      : buildInterventionEvidence(
          await readAssignmentEvidence(
            access,
            input.selection.assignment_id,
            input.selection.origin,
          ),
          content,
          input.selection,
        );
    await transaction(async (client) => {
      await authorize(client, access, input.selection.assignment_id);
      await requireCurrentSource(client, access, bundle);
      const saved = await client.query(
        `UPDATE teacher_intervention_requests SET evidence=$3 WHERE teacher_id=$1 AND request_id=$2 AND status='pending' RETURNING request_id`,
        [access.actor.profileId, input.request_id, bundle],
      );
      if (!saved.rows.length)
        throw new EvidenceError(409, "This generation is no longer pending.");
    });
    const outcome = await provider(
      interventionPrompt(
        bundle,
        input.revision_instructions,
        previousDraft?.activity,
      ),
    );
    provenance = {
      model: outcome.model,
      response_id: outcome.responseId ?? null,
      usage: outcome.usage ?? null,
    };
    if (!outcome.ok) throw new EvidenceError(503, outcome.message);
    const generatedAt = new Date().toISOString();
    const activity = validateInterventionActivity(outcome.result, bundle, {
      model: outcome.model,
      generated_at: generatedAt,
    });
    const draft = InterventionDraftSchema.parse({
      id: input.draft_id,
      assignment_id: input.selection.assignment_id,
      revision: input.expected_revision + 1,
      status: "private_draft",
      activity,
      evidence: bundle,
      provenance: {
        model: outcome.model,
        response_id: outcome.responseId,
        usage: outcome.usage,
        prompt_template_version: INTERVENTION_PROMPT_VERSION,
        generated_at: generatedAt,
      },
      created_at: previous.created_at,
      updated_at: generatedAt,
    });
    return await transaction(async (client) => {
      await authorize(client, access, input.selection.assignment_id);
      await requireCurrentSource(client, access, bundle);
      const operation = await client.query(
        "SELECT status FROM teacher_intervention_requests WHERE teacher_id=$1 AND request_id=$2 FOR UPDATE",
        [access.actor.profileId, input.request_id],
      );
      const current = await currentDraft(client, access, input.draft_id);
      if (
        current?.revision !== input.expected_revision ||
        (current?.snapshot !== null &&
          current?.snapshot !== undefined &&
          InterventionDraftSchema.parse(current.snapshot).status !==
            "private_draft") ||
        operation.rows[0]?.status !== "pending"
      )
        throw new EvidenceError(
          409,
          "The draft changed while generation was running. The newer draft was preserved.",
        );
      await client.query(
        "UPDATE teacher_intervention_drafts SET revision=$3,snapshot=$4,updated_at=clock_timestamp() WHERE id=$1 AND teacher_id=$2 AND revision=$5",
        [
          input.draft_id,
          access.actor.profileId,
          draft.revision,
          draft,
          input.expected_revision,
        ],
      );
      await client.query(
        `UPDATE teacher_intervention_requests SET status='completed',result_snapshot=$3,provenance=$4,completed_at=clock_timestamp()
         WHERE teacher_id=$1 AND request_id=$2`,
        [access.actor.profileId, input.request_id, draft, draft.provenance],
      );
      return { status: "completed", request_id: input.request_id, draft };
    });
  } catch (error) {
    const message =
      error instanceof EvidenceError
        ? error.message
        : error instanceof InterventionValidationError
          ? `${error.message} The previous draft is intact.`
          : error instanceof z.ZodError
            ? "The generated activity failed validation. The previous draft is intact."
            : "The activity could not be generated or validated. The previous draft is intact.";
    await transaction(async (client) => {
      await authorize(client, access, input.selection.assignment_id);
      await client.query(
        `UPDATE teacher_intervention_requests SET status='failed',error=$3,provenance=$4,completed_at=clock_timestamp()
         WHERE teacher_id=$1 AND request_id=$2 AND status='pending'`,
        [access.actor.profileId, input.request_id, message, provenance],
      );
    });
    return readInterventionRequest(
      access,
      input.selection.assignment_id,
      input.request_id,
    );
  }
}
