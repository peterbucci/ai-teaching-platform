import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { PoolClient } from "pg";
import { z } from "zod";
import { evidenceRow } from "../db.ts";
import {
  EvidenceError,
  transaction,
  type EvidenceAccess,
} from "../evidence/store.ts";
import { LessonDraftContentSchema } from "../lessons/contracts.ts";
import {
  SourcePassageSchema,
  UploadedSourceReferenceSchema,
} from "../lessons/source-contracts.ts";
import { readSourceVersion } from "../lessons/sources.ts";
import {
  LessonRowSchema,
  ownedLessonDraft,
  readLessonDraft,
  requireLessonTeacher,
  writeLessonDraftInTransaction,
} from "../lessons/store.ts";
import {
  CheckedObjectiveSuggestionSchema,
  CreateObjectiveDraftSchema,
  ObjectiveItemSchema,
  ObjectiveWorkflowSchema,
  SaveObjectiveDraftSchema,
  type CheckedObjectiveSuggestion,
} from "./contracts.ts";
import {
  deriveObjectiveConcepts,
  ObjectiveReviewError,
  prepareObjectiveEdits,
  validateObjectiveEvidence,
} from "./rules.ts";

export type ObjectiveLesson = z.infer<typeof LessonRowSchema>;

function reviewFailure(error: unknown): never {
  if (error instanceof ObjectiveReviewError)
    throw new EvidenceError(400, error.message);
  throw error;
}

/** Must execute inside the same transaction as an expected-revision write. */
export async function objectiveDraftContext(
  client: PoolClient,
  access: EvidenceAccess,
  lessonId: string,
  expectedRevision?: number,
) {
  z.uuid().parse(lessonId);
  const lesson = await ownedLessonDraft(
    client,
    access,
    lessonId,
    expectedRevision,
  );
  const workflow = lesson.draft?.objective_workflow;
  if (!workflow) throw new EvidenceError(404, "Objectives draft not found.");
  const ref = workflow.source_ref;
  const result = await client.query(
    `SELECT v.document_sha256,v.excerpt_sha256,v.attribution,v.passages,v.review_status
     FROM source_versions v JOIN source_documents d ON d.id=v.document_id
     WHERE v.document_id=$1 AND v.version=$2 AND d.owner_id=$3`,
    [ref.source_id, ref.source_version, access.actor.profileId],
  );
  if (!result.rows[0])
    throw new EvidenceError(404, "Source version not found.");
  const row = z
    .object({
      document_sha256: z.string(),
      excerpt_sha256: z.string(),
      attribution: UploadedSourceReferenceSchema.shape.attribution,
      passages: z.array(SourcePassageSchema),
      review_status: z.enum(["extracted", "approved"]),
    })
    .parse(result.rows[0]);
  if (
    row.review_status !== "approved" ||
    ref.access_scope.teacher_id !== access.actor.profileId ||
    ref.document_sha256 !== row.document_sha256 ||
    ref.excerpt_sha256 !== row.excerpt_sha256 ||
    !isDeepStrictEqual(ref.attribution, row.attribution)
  )
    throw new EvidenceError(
      409,
      "Objectives require the exact approved source version.",
    );
  const contentRef = lesson.draft?.content_ref;
  if (
    !contentRef ||
    !("source_kind" in contentRef) ||
    !isDeepStrictEqual(
      {
        ...ref,
        package_id: lesson.id,
        content_version: contentRef.content_version,
      },
      contentRef,
    )
  )
    throw new EvidenceError(
      409,
      "This draft source changed. Create a new objectives draft for the new source version.",
    );
  return {
    lesson: {
      ...lesson,
      draft: { ...lesson.draft, objective_workflow: workflow },
    },
    workflow,
    passages: row.passages,
  };
}

export async function createObjectiveDraft(
  access: EvidenceAccess,
  value: unknown,
) {
  const input = CreateObjectiveDraftSchema.parse(value);
  const source = await readSourceVersion(
    access,
    input.source_id,
    input.source_version,
  );
  if (source.review_status !== "approved")
    throw new EvidenceError(
      409,
      "Review and approve the source material before creating objectives.",
    );
  return transaction(async (client) => {
    await requireLessonTeacher(client, access);
    // A caller-created request UUID is also the draft identity. Retried creation is durable.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      input.request_id,
    ]);
    const draft = LessonDraftContentSchema.parse({
      content_ref: {
        ...source.source_ref,
        package_id: input.request_id,
        content_version: "1",
      },
      assignment_key: input.request_id,
      attribution: source.attribution,
      passages: source.passages.map((passage) => ({
        id: passage.passage_id,
        source_id: source.document_id,
        source_version: source.version,
        text: passage.text,
        url: source.attribution.url,
        start_line: null,
        end_line: null,
        sha256: createHash("sha256").update(passage.text).digest("hex"),
        ...(passage.page_number === undefined
          ? {}
          : { page_number: passage.page_number }),
        ...(passage.section === undefined ? {} : { section: passage.section }),
      })),
      objective_workflow: {
        source_ref: source.source_ref,
        creation: { request_id: input.request_id, title: input.title },
        items: [],
        reviewed: null,
      },
    });
    const created = await client.query(
      "INSERT INTO lessons(id,owner_id,title,draft,revision) VALUES($1,$2,$3,$4::jsonb,1) ON CONFLICT(id) DO NOTHING RETURNING *",
      [
        input.request_id,
        access.actor.profileId,
        input.title,
        JSON.stringify(draft),
      ],
    );
    if (created.rows[0])
      return LessonRowSchema.parse(evidenceRow(created.rows[0]));
    const saved = await ownedLessonDraft(client, access, input.request_id);
    if (
      !isDeepStrictEqual(
        saved.draft?.objective_workflow?.creation,
        draft.objective_workflow?.creation,
      ) ||
      !isDeepStrictEqual(
        saved.draft?.objective_workflow?.source_ref,
        source.source_ref,
      )
    )
      throw new EvidenceError(
        409,
        "This creation request was already used for a different draft.",
      );
    return saved;
  });
}

export async function listObjectiveDrafts(access: EvidenceAccess) {
  return transaction(async (client) => {
    await requireLessonTeacher(client, access);
    const result = await client.query(
      "SELECT * FROM lessons WHERE owner_id=$1 AND draft ? 'objective_workflow' ORDER BY created_at DESC,id LIMIT 100",
      [access.actor.profileId],
    );
    return result.rows.map((row) => LessonRowSchema.parse(evidenceRow(row)));
  });
}

export async function readObjectiveDraft(
  access: EvidenceAccess,
  lessonId: string,
) {
  z.uuid().parse(lessonId);
  const lesson = await readLessonDraft(access, lessonId);
  const workflow = lesson.draft?.objective_workflow;
  if (!workflow) throw new EvidenceError(404, "Objectives draft not found.");
  const source = await readSourceVersion(
    access,
    workflow.source_ref.source_id,
    workflow.source_ref.source_version,
  );
  if (
    source.review_status !== "approved" ||
    !isDeepStrictEqual(source.source_ref, workflow.source_ref)
  )
    throw new EvidenceError(
      409,
      "Objectives require the exact approved source version.",
    );
  return {
    lesson: {
      ...lesson,
      draft: { ...lesson.draft, objective_workflow: workflow },
    },
    source,
  };
}

export async function saveObjectiveDraft(
  access: EvidenceAccess,
  value: unknown,
) {
  const input = SaveObjectiveDraftSchema.parse(value);
  return transaction(async (client) => {
    const { lesson, workflow, passages } = await objectiveDraftContext(
      client,
      access,
      input.lesson_id,
      input.expected_revision,
    );
    let items;
    try {
      items = prepareObjectiveEdits(
        input.items,
        workflow.items,
        passages,
        access.actor.profileId,
        new Date().toISOString(),
      );
    } catch (error) {
      reviewFailure(error);
    }
    const next = ObjectiveWorkflowSchema.parse({
      ...workflow,
      items,
      reviewed: null,
    });
    return writeLessonDraftInTransaction(client, lesson.id, input.title, {
      ...lesson.draft,
      objective_workflow: next,
    });
  });
}

export async function approveObjectives(
  access: EvidenceAccess,
  value: unknown,
) {
  const input = z
    .strictObject({
      lesson_id: z.uuid(),
      expected_revision: z.number().int().positive(),
    })
    .parse(value);
  return transaction(async (client) => {
    const { lesson, workflow, passages } = await objectiveDraftContext(
      client,
      access,
      input.lesson_id,
      input.expected_revision,
    );
    if (workflow.reviewed) return lesson;
    let concepts;
    try {
      for (const item of workflow.items)
        validateObjectiveEvidence(item, passages);
      concepts = deriveObjectiveConcepts(workflow, lesson.draft?.concepts);
    } catch (error) {
      reviewFailure(error);
    }
    const next = ObjectiveWorkflowSchema.parse({
      ...workflow,
      reviewed: {
        revision: lesson.revision + 1,
        reviewed_by: access.actor.profileId,
        reviewed_at: new Date().toISOString(),
      },
    });
    return writeLessonDraftInTransaction(client, lesson.id, lesson.title, {
      ...lesson.draft,
      concepts,
      objective_workflow: next,
    });
  });
}

/** Server-only proposal application. Caller records its actual result in the same transaction. */
export async function applyObjectiveSuggestionsInTransaction(
  client: PoolClient,
  access: EvidenceAccess,
  lessonId: string,
  expectedRevision: number,
  proposals: CheckedObjectiveSuggestion[],
) {
  const suggestions = z
    .array(CheckedObjectiveSuggestionSchema)
    .min(1)
    .max(12)
    .parse(proposals);
  const { lesson, workflow, passages } = await objectiveDraftContext(
    client,
    access,
    lessonId,
    expectedRevision,
  );
  if (workflow.items.length + suggestions.length > 40)
    throw new EvidenceError(
      400,
      "A lesson is limited to 40 objectives. Remove some before adding suggestions.",
    );
  const items = suggestions.map((suggestion) => {
    try {
      validateObjectiveEvidence(
        {
          passage_ids: suggestion.passage_ids,
          support_evidence: suggestion.support.evidence,
        },
        passages,
      );
    } catch (error) {
      reviewFailure(error);
    }
    if (
      suggestion.support.status === "supported" &&
      !suggestion.support.evidence.length
    )
      throw new EvidenceError(
        400,
        "A supported suggestion must include exact source evidence.",
      );
    return ObjectiveItemSchema.parse({
      concept_id: randomUUID(),
      concept_name: suggestion.concept_name,
      objective: suggestion.objective,
      passage_ids: suggestion.passage_ids,
      emphasis: suggestion.emphasis,
      support_evidence: suggestion.support.evidence,
      support_note: "",
      teacher_verified: false,
      origin: "ai",
      ai_baseline: {
        concept_name: suggestion.concept_name,
        objective: suggestion.objective,
        passage_ids: suggestion.passage_ids,
        support_status: suggestion.support.status,
      },
      uncertainty: suggestion.uncertainty,
      support: suggestion.support,
      review: null,
    });
  });
  return writeLessonDraftInTransaction(client, lesson.id, lesson.title, {
    ...lesson.draft,
    objective_workflow: {
      ...workflow,
      items: [...workflow.items, ...items],
      reviewed: null,
    },
  });
}
