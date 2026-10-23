import "server-only";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { evidenceRow } from "../db.ts";
import {
  EvidenceError,
  transaction,
  type EvidenceAccess,
} from "../evidence/store.ts";
import { LessonContentSchema, type LessonContent } from "./contracts.ts";
import {
  LessonPublishingReviewSchema,
  TeacherLessonSummarySchema,
  type LessonPublishingReview,
  type PublishingValidationIssue,
  type TeacherLessonSummary,
} from "./publishing-contracts.ts";
import { validateOwnedContent } from "./store.ts";

/** Metadata only. Private lesson content is loaded after an owned lesson lookup. */
export async function listTeacherLessons(
  access: EvidenceAccess,
): Promise<TeacherLessonSummary[]> {
  return transaction(async (client) => {
    const teacher = await client.query(
      "SELECT 1 FROM classes WHERE teacher_id=$1 LIMIT 1",
      [access.actor.profileId],
    );
    if (!teacher.rowCount)
      throw new EvidenceError(403, "Teacher access is required.");
    const rows = await client.query(
      `SELECT l.id,l.title,l.revision,l.approved_revision,
         l.draft #>> '{content_ref,content_version}' AS content_version,
         ARRAY(SELECT v.version FROM lesson_versions v WHERE v.lesson_id=l.id
           ORDER BY v.published_at DESC,v.version) AS published_versions
       FROM lessons l WHERE l.owner_id=$1 ORDER BY l.created_at DESC,l.id`,
      [access.actor.profileId],
    );
    return z.array(TeacherLessonSummarySchema).parse(rows.rows);
  });
}

/** Teacher-only review, with no approval, publication, or assignment side effect. */
export async function lessonPublishingReview(
  access: EvidenceAccess,
  lessonId: string,
): Promise<LessonPublishingReview> {
  z.string().min(1).parse(lessonId);
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    const rows = await client.query(
      `SELECT id,title,revision,approved_revision,draft FROM lessons
       WHERE id=$1 AND owner_id=$2`,
      [lessonId, access.actor.profileId],
    );
    if (!rows.rows[0]) throw new EvidenceError(404, "Lesson draft not found.");
    const lesson = LessonPublishingReviewSchema.shape.lesson.parse(
      rows.rows[0],
    );
    const versions = await client.query(
      `SELECT version,published_at,content_ref,content FROM lesson_versions
       WHERE lesson_id=$1 ORDER BY published_at DESC,version`,
      [lesson.id],
    );
    const classes = await client.query(
      "SELECT id,name FROM classes WHERE teacher_id=$1 ORDER BY name,id",
      [access.actor.profileId],
    );
    const assignments = await client.query(
      `SELECT a.id,a.title,a.instructions,a.class_id,c.name AS class_name,
         a.lesson_version,a.teacher_approved_at
       FROM assignments a JOIN classes c ON c.id=a.class_id
       WHERE a.lesson_id=$1 AND c.teacher_id=$2 ORDER BY c.name,a.title,a.id`,
      [lesson.id, access.actor.profileId],
    );
    const issues: PublishingValidationIssue[] = [];
    // This approval-shaped value permits the same structural validation used by
    // approval. It is never saved and does not approve this draft.
    const candidate = LessonContentSchema.safeParse({
      ...lesson.draft,
      approval: {
        status: "approved",
        approved_by: access.actor.profileId,
        approved_at: new Date().toISOString(),
        approval_type: "teacher_review",
        approval_note:
          "Validation preview only; teacher approval is still required.",
      },
    });
    if (!candidate.success) {
      issues.push(
        ...candidate.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      );
    } else {
      if (candidate.data.content_ref.package_id !== lesson.id)
        issues.push({
          path: "content_ref.package_id",
          message: "The content belongs to a different lesson.",
        });
      try {
        await validateOwnedContent(
          client,
          access.actor.profileId,
          candidate.data,
        );
      } catch (error) {
        if (
          error instanceof EvidenceError &&
          (error.status === 404 || error.status === 409)
        )
          issues.push({ path: "content", message: error.message });
        else throw error;
      }
      const published = versions.rows.find(
        (row) => row.version === candidate.data.content_ref.content_version,
      );
      if (
        published &&
        (lesson.approved_revision !== lesson.revision ||
          !isDeepStrictEqual(published.content, lesson.draft))
      )
        issues.push({
          path: "content_ref.content_version",
          message:
            "This version is already published. Choose a new lesson version before approving changed content.",
        });
    }
    return LessonPublishingReviewSchema.parse(
      evidenceRow({
        lesson,
        validation: { valid: issues.length === 0, issues },
        published_versions: versions.rows,
        classes: classes.rows,
        assignments: assignments.rows,
      }),
    );
  });
}

/** Exact immutable snapshot for the owner previewing a version before assigning. */
export async function readPublishedLessonForReview(
  access: EvidenceAccess,
  lessonId: string,
  version: string,
): Promise<LessonContent> {
  z.string().min(1).parse(lessonId);
  z.string().min(1).parse(version);
  return transaction(async (client) => {
    const rows = await client.query(
      `SELECT v.content FROM lesson_versions v JOIN lessons l ON l.id=v.lesson_id
       WHERE v.lesson_id=$1 AND v.version=$2 AND l.owner_id=$3`,
      [lessonId, version, access.actor.profileId],
    );
    if (!rows.rows[0])
      throw new EvidenceError(404, "Published lesson version not found.");
    const content = LessonContentSchema.parse(rows.rows[0].content);
    await validateOwnedContent(client, access.actor.profileId, content);
    if (
      content.content_ref.package_id !== lessonId ||
      content.content_ref.content_version !== version
    )
      throw new EvidenceError(
        409,
        "The published lesson version is unavailable.",
      );
    return content;
  });
}
