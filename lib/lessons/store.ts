import {
  retainObjectiveWorkflow,
  lessonWithoutObjectiveWorkflow,
  assertObjectiveReviewForLesson,
  ObjectiveReviewError,
} from "../objectives/rules.ts";
import "server-only";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { PoolClient } from "pg";
import { z } from "zod";
import { evidenceRow } from "../db.ts";
import {
  EvidenceError,
  transaction,
  type EvidenceAccess,
} from "../evidence/store.ts";
import { ContentRefSchema } from "../evidence/contracts.ts";
import {
  loadApprovedContent,
  validateContentRef,
  type ApprovedContent,
} from "../evidence/content.ts";
import {
  LessonContentSchema,
  LessonDraftContentSchema,
  type LessonContent,
  type LessonDraftContent,
} from "./contracts.ts";
import { AttributionSchema, SourcePassageSchema } from "./source-contracts.ts";
import { hydrateLessonContent, LessonValidationError } from "./validate.ts";

const LessonRowSchema = z.object({
  id: z.string(),
  owner_id: z.uuid().nullable(),
  title: z.string(),
  draft: LessonDraftContentSchema.nullable(),
  revision: z.number().int(),
  approved_revision: z.number().int().nullable(),
});
const VersionRowSchema = z.object({
  lesson_id: z.string(),
  version: z.string(),
  content_ref: ContentRefSchema,
  content: LessonContentSchema.nullable(),
  owner_id: z.uuid().nullable(),
});

export async function requireLessonTeacher(
  client: PoolClient,
  access: EvidenceAccess,
) {
  const result = await client.query(
    "SELECT 1 FROM classes WHERE teacher_id=$1 LIMIT 1",
    [access.actor.profileId],
  );
  if (!result.rowCount)
    throw new EvidenceError(403, "Teacher access is required.");
}
export async function ownedLessonDraft(
  client: PoolClient,
  access: EvidenceAccess,
  id: string,
  revision?: number,
) {
  const result = await client.query(
    "SELECT * FROM lessons WHERE id=$1 AND owner_id=$2 FOR UPDATE",
    [id, access.actor.profileId],
  );
  if (!result.rows[0]) throw new EvidenceError(404, "Lesson draft not found.");
  const lesson = LessonRowSchema.parse(evidenceRow(result.rows[0]));
  if (revision !== undefined && lesson.revision !== revision)
    throw new EvidenceError(
      409,
      "The draft changed. Reload before applying changes.",
    );
  return lesson;
}
async function validateOwnedContent(
  client: PoolClient,
  owner: string,
  content: LessonContent,
) {
  const ref = content.content_ref;
  if (!("source_kind" in ref) || ref.access_scope.teacher_id !== owner)
    throw new EvidenceError(
      409,
      "Lesson requires an owned uploaded source version.",
    );
  const result = await client.query(
    `SELECT v.document_sha256,v.excerpt_sha256,v.attribution,v.passages,v.review_status FROM source_versions v JOIN source_documents d ON d.id=v.document_id
    WHERE v.document_id=$1 AND v.version=$2 AND d.owner_id=$3`,
    [ref.source_id, ref.source_version, owner],
  );
  if (!result.rows[0])
    throw new EvidenceError(404, "Source version not found.");
  const source = z
    .object({
      document_sha256: z.string(),
      excerpt_sha256: z.string(),
      attribution: AttributionSchema,
      passages: z.array(SourcePassageSchema),
      review_status: z.enum(["extracted", "approved"]),
    })
    .parse(result.rows[0]);
  if (
    source.review_status !== "approved" ||
    source.document_sha256 !== ref.document_sha256 ||
    source.excerpt_sha256 !== ref.excerpt_sha256 ||
    !isDeepStrictEqual(source.attribution, ref.attribution)
  )
    throw new EvidenceError(
      409,
      "The lesson source is unapproved or has mismatched provenance.",
    );
  if (
    source.passages.length !== content.passages.length ||
    content.passages.some((p) => {
      const stored = source.passages.find((s) => s.passage_id === p.id);
      return (
        !stored ||
        stored.text !== p.text ||
        stored.page_number !== p.page_number ||
        stored.section !== p.section
      );
    })
  )
    throw new EvidenceError(
      409,
      "Lesson passages differ from the approved source version.",
    );
  try {
    return hydrateLessonContent(content);
  } catch (error) {
    if (error instanceof LessonValidationError)
      throw new EvidenceError(409, error.message);
    throw error;
  }
}

/** Server-only full context. Student responses must use explicit existing projections. */
export async function resolveAssignmentContent(
  client: PoolClient,
  access: EvidenceAccess,
  assignmentId: string,
  role: "student" | "teacher",
): Promise<ApprovedContent> {
  z.uuid().parse(assignmentId);
  const result = await client.query(
    `SELECT a.content_ref AS assignment_ref,a.approved_concept_ids,a.approved_passage_ids,a.approved_misconception_ids,
    a.approval,l.owner_id,c.teacher_id,v.lesson_id,v.version,v.content_ref,v.content FROM assignments a JOIN classes c ON c.id=a.class_id
    JOIN lesson_versions v ON v.lesson_id=a.lesson_id AND v.version=a.lesson_version JOIN lessons l ON l.id=v.lesson_id
    WHERE a.id=$1 AND (($3='teacher' AND c.teacher_id=$2) OR ($3='student' AND EXISTS
    (SELECT 1 FROM enrollments e WHERE e.class_id=a.class_id AND e.student_id=$2)))`,
    [assignmentId, access.actor.profileId, role],
  );
  if (!result.rows[0]) throw new EvidenceError(404, "Assignment not found.");
  const row = VersionRowSchema.extend({
    assignment_ref: ContentRefSchema,
    teacher_id: z.uuid(),
    approved_concept_ids: z.array(z.string()),
    approved_passage_ids: z.array(z.string()),
    approved_misconception_ids: z.array(z.string()),
    approval: z.object({ status: z.literal("approved") }),
  }).parse(result.rows[0]);
  if (row.owner_id !== null && row.owner_id !== row.teacher_id)
    throw new EvidenceError(404, "Assignment not found.");
  const content =
    row.owner_id === null
      ? loadApprovedContent()
      : await validateOwnedContent(
          client,
          row.owner_id,
          LessonContentSchema.parse(row.content),
        );
  try {
    validateContentRef(content, row.content_ref);
    validateContentRef(content, row.assignment_ref);
    const same = (ids: string[], set: Set<string>) =>
      ids.length === set.size &&
      new Set(ids).size === ids.length &&
      ids.every((id) => set.has(id));
    if (
      !same(row.approved_concept_ids, content.concept_ids) ||
      !same(row.approved_passage_ids, content.passage_ids) ||
      !same(
        row.approved_misconception_ids,
        new Set(content.misconceptions.keys()),
      )
    )
      throw new Error("Scope mismatch");
  } catch {
    throw new EvidenceError(
      409,
      "The pinned lesson version or approved scope is unavailable.",
    );
  }
  return content;
}
export async function readAssignmentContent(
  access: EvidenceAccess,
  assignmentId: string,
  role: "student" | "teacher",
) {
  return transaction((client) =>
    resolveAssignmentContent(client, access, assignmentId, role),
  );
}

/** Optimistic authoring API: editing clears approval; publishing never edits this row's old versions. */
export async function saveLessonDraft(access: EvidenceAccess, input: unknown) {
  const request = z
    .strictObject({
      lesson_id: z.string().min(1).optional(),
      expected_revision: z.number().int().nonnegative(),
      title: z.string().trim().min(1).max(300),
      draft: LessonDraftContentSchema,
    })
    .parse(input);
  return transaction(async (client) => {
    await requireLessonTeacher(client, access);
    const draft = retainObjectiveWorkflow(null, request.draft);
    delete draft.approval;
    if (!request.lesson_id) {
      if (request.expected_revision !== 0)
        throw new EvidenceError(409, "A new draft starts at revision zero.");
      const id = randomUUID();
      const result = await client.query(
        "INSERT INTO lessons(id,owner_id,title,draft,revision) VALUES($1,$2,$3,$4::jsonb,1) RETURNING *",
        [id, access.actor.profileId, request.title, JSON.stringify(draft)],
      );
      return LessonRowSchema.parse(evidenceRow(result.rows[0]));
    }
    const previous = await ownedLessonDraft(
      client,
      access,
      request.lesson_id,
      request.expected_revision,
    );
    let retained;
    try {
      retained = retainObjectiveWorkflow(previous.draft, draft);
    } catch (error) {
      if (error instanceof ObjectiveReviewError)
        throw new EvidenceError(409, error.message);
      throw error;
    }
    return writeLessonDraftInTransaction(
      client,
      previous.id,
      request.title,
      retained,
    );
  });
}
/** Internal authoring primitive. Call only after locking an owned expected revision. */
export async function writeLessonDraftInTransaction(
  client: PoolClient,
  lessonId: string,
  title: string,
  draft: LessonDraftContent,
) {
  const clean = LessonDraftContentSchema.parse(draft);
  delete clean.approval;
  const result = await client.query(
    "UPDATE lessons SET title=$2,draft=$3::jsonb,revision=revision+1,approved_revision=NULL WHERE id=$1 RETURNING *",
    [lessonId, title, JSON.stringify(clean)],
  );
  return LessonRowSchema.parse(evidenceRow(result.rows[0]));
}

export async function readLessonDraft(
  access: EvidenceAccess,
  lessonId: string,
) {
  return transaction((client) => ownedLessonDraft(client, access, lessonId));
}
export async function approveLessonDraft(
  access: EvidenceAccess,
  lessonId: string,
  expectedRevision: number,
) {
  z.number().int().positive().parse(expectedRevision);
  return transaction(async (client) => {
    const lesson = await ownedLessonDraft(
      client,
      access,
      lessonId,
      expectedRevision,
    );
    if (lesson.approved_revision === expectedRevision) return lesson;
    if (!lesson.draft)
      throw new EvidenceError(409, "The lesson draft is empty.");
    try {
      assertObjectiveReviewForLesson(lesson.draft);
    } catch (error) {
      if (error instanceof ObjectiveReviewError)
        throw new EvidenceError(409, error.message);
      throw error;
    }
    const content = LessonContentSchema.parse({
      ...lessonWithoutObjectiveWorkflow(lesson.draft),
      approval: {
        status: "approved",
        approved_by: access.actor.profileId,
        approved_at: new Date().toISOString(),
        approval_type: "teacher_review",
        approval_note: "Teacher explicitly approved this draft revision.",
      },
    });
    if (content.content_ref.package_id !== lesson.id)
      throw new EvidenceError(409, "Draft belongs to a different lesson.");
    await validateOwnedContent(client, access.actor.profileId, content);
    const existing = await client.query(
      "SELECT 1 FROM lesson_versions WHERE lesson_id=$1 AND version=$2",
      [lesson.id, content.content_ref.content_version],
    );
    if (existing.rowCount)
      throw new EvidenceError(
        409,
        "Published versions are immutable. Choose a new lesson version.",
      );
    const result = await client.query(
      "UPDATE lessons SET draft=$2::jsonb,approved_revision=revision WHERE id=$1 RETURNING *",
      [lesson.id, JSON.stringify({ ...lesson.draft, ...content })],
    );
    return LessonRowSchema.parse(evidenceRow(result.rows[0]));
  });
}
export async function publishLessonVersion(
  access: EvidenceAccess,
  lessonId: string,
  expectedRevision: number,
) {
  z.number().int().positive().parse(expectedRevision);
  return transaction(async (client) => {
    const lesson = await ownedLessonDraft(
      client,
      access,
      lessonId,
      expectedRevision,
    );
    if (lesson.approved_revision !== expectedRevision)
      throw new EvidenceError(
        409,
        "Approve the current draft before publishing.",
      );
    if (!lesson.draft)
      throw new EvidenceError(409, "The lesson draft is empty.");
    const content = LessonContentSchema.parse(
      lessonWithoutObjectiveWorkflow(lesson.draft),
    );
    const approved = await validateOwnedContent(
      client,
      access.actor.profileId,
      content,
    );
    const ref = content.content_ref;
    if (!("source_kind" in ref) || ref.package_id !== lesson.id)
      throw new EvidenceError(409, "Wrong lesson source.");
    const previous = await client.query(
      "SELECT content FROM lesson_versions WHERE lesson_id=$1 AND version=$2",
      [lesson.id, ref.content_version],
    );
    if (previous.rows[0]) {
      const saved = LessonContentSchema.parse(previous.rows[0].content);
      if (!isDeepStrictEqual(saved, content))
        throw new EvidenceError(409, "Published version cannot be replaced.");
      return {
        lesson_id: lesson.id,
        version: ref.content_version,
        content_ref: ref,
      };
    }
    await client.query(
      `INSERT INTO lesson_versions(lesson_id,version,content_ref,content,source_document_id,source_version,approved_concept_ids,approved_passage_ids,approved_misconception_ids,published_by)
      VALUES($1,$2,$3::jsonb,$4::jsonb,$5,$6,$7,$8,$9,$10)`,
      [
        lesson.id,
        ref.content_version,
        JSON.stringify(ref),
        JSON.stringify(content),
        ref.source_id,
        ref.source_version,
        [...approved.concept_ids],
        [...approved.passage_ids],
        [...approved.misconceptions.keys()],
        access.actor.profileId,
      ],
    );
    return {
      lesson_id: lesson.id,
      version: ref.content_version,
      content_ref: ref,
    };
  });
}
/** Publication and classroom activation are deliberately separate operations. */
export async function createLessonAssignment(
  access: EvidenceAccess,
  input: unknown,
) {
  const request = z
    .strictObject({
      class_id: z.uuid(),
      lesson_id: z.string().min(1),
      version: z.string().min(1),
      title: z.string().trim().min(1).max(300),
    })
    .parse(input);
  return transaction(async (client) => {
    const owned = await client.query(
      "SELECT 1 FROM classes WHERE id=$1 AND teacher_id=$2 FOR SHARE",
      [request.class_id, access.actor.profileId],
    );
    if (!owned.rowCount) throw new EvidenceError(404, "Class not found.");
    const version = await client.query(
      `SELECT v.*,l.owner_id FROM lesson_versions v JOIN lessons l ON l.id=v.lesson_id WHERE v.lesson_id=$1 AND v.version=$2 AND (l.owner_id=$3 OR l.owner_id IS NULL)`,
      [request.lesson_id, request.version, access.actor.profileId],
    );
    if (!version.rows[0])
      throw new EvidenceError(404, "Published lesson version not found.");
    const row = VersionRowSchema.parse(version.rows[0]);
    const content =
      row.owner_id === null
        ? loadApprovedContent()
        : await validateOwnedContent(
            client,
            access.actor.profileId,
            LessonContentSchema.parse(row.content),
          );
    validateContentRef(content, row.content_ref);
    const id = randomUUID();
    await client.query(
      `INSERT INTO assignments(id,class_id,title,content_ref,approved_concept_ids,approved_passage_ids,approved_misconception_ids,approval,lesson_id,lesson_version)
      VALUES($1,$2,$3,$4::jsonb,$5,$6,$7,$8::jsonb,$9,$10)`,
      [
        id,
        request.class_id,
        request.title,
        JSON.stringify(row.content_ref),
        [...content.concept_ids],
        [...content.passage_ids],
        [...content.misconceptions.keys()],
        JSON.stringify(content.approval),
        row.lesson_id,
        row.version,
      ],
    );
    return {
      id,
      class_id: request.class_id,
      lesson_id: row.lesson_id,
      lesson_version: row.version,
    };
  });
}

export { LessonRowSchema };
