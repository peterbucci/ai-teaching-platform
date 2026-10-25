import "server-only";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireActor, AuthError } from "../../../lib/auth.ts";
import { evidenceRow } from "../../../lib/db.ts";
import {
  EvidenceError,
  evidenceAccess,
  transaction,
  type EvidenceAccess,
} from "../../../lib/evidence/store.ts";
import { assignmentReview } from "../../../lib/assignments/store.ts";
import { readAssignmentContent } from "../../../lib/lessons/store.ts";
import { readAssignmentEvidence } from "../../../lib/teacher/store.ts";
import { readInterventionDrafts } from "../../../lib/interventions/store.ts";
import { readInterventionReview } from "../../../lib/interventions/approval.ts";
import {
  AssignmentWorkspaceSchema,
  filterAssignments,
  type AssignmentStatus,
} from "./workspace-model.ts";

const HeaderSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  class_id: z.uuid(),
  class_name: z.string(),
  lesson_id: z.string(),
  lesson_title: z.string(),
  lesson_version: z.string(),
  teacher_approved_at: z.iso.datetime({ offset: true }).nullable(),
});

// Page-local metadata only: keep class identity available even when a pinned
// content snapshot cannot resolve. All content, actions and metrics use services.
export async function assignmentIndex(access: EvidenceAccess) {
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    const classes = await client.query(
      "SELECT id,name FROM classes WHERE teacher_id=$1 ORDER BY name,id",
      [access.actor.profileId],
    );
    const assignments = await client.query(
      `SELECT a.id,a.title,a.class_id,c.name AS class_name,a.lesson_id,
       COALESCE(l.title,a.lesson_id) AS lesson_title,a.lesson_version,a.teacher_approved_at
       FROM assignments a JOIN classes c ON c.id=a.class_id
       LEFT JOIN lessons l ON l.id=a.lesson_id
       WHERE c.teacher_id=$1 ORDER BY c.name,a.title,a.id`,
      [access.actor.profileId],
    );
    return {
      classes: z
        .array(z.object({ id: z.uuid(), name: z.string() }))
        .parse(classes.rows),
      assignments: z
        .array(HeaderSchema)
        .parse(assignments.rows.map(evidenceRow)),
    };
  });
}

export async function withAssignmentAccess<T>(
  operation: (access: EvidenceAccess) => Promise<T>,
) {
  try {
    return await operation(evidenceAccess(await requireActor()));
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect("/login");
    if (
      error instanceof z.ZodError ||
      (error instanceof EvidenceError && [403, 404].includes(error.status))
    )
      notFound();
    throw error;
  }
}

export async function loadAssignments(
  raw: Record<string, string | string[] | undefined>,
) {
  return withAssignmentAccess(async (access) => {
    const context = AssignmentWorkspaceSchema.parse(raw);
    const index = await assignmentIndex(access);
    if (
      context.class &&
      !index.classes.some((item) => item.id === context.class)
    )
      notFound();
    if (
      context.assignment &&
      !index.assignments.some((item) => item.id === context.assignment)
    )
      notFound();
    const assignments = await Promise.all(
      index.assignments.map(async (item) => {
        try {
          const review = await assignmentReview(access, item.id);
          return {
            ...item,
            review,
            status: (review.teacher_approved_at
              ? "active"
              : "inactive") as AssignmentStatus,
          };
        } catch (error) {
          if (
            error instanceof z.ZodError ||
            (error instanceof EvidenceError &&
              [404, 409].includes(error.status))
          )
            return {
              ...item,
              review: null,
              status: "unavailable" as AssignmentStatus,
            };
          throw error;
        }
      }),
    );
    const visible = filterAssignments(assignments, context);
    const selected = context.assignment
      ? (assignments.find((item) => item.id === context.assignment) ?? null)
      : (visible[0] ?? null);
    const content = selected?.review
      ? await readAssignmentContent(access, selected.id, "teacher")
      : null;
    const progress =
      selected?.review && (context.view === "progress" || context.student)
        ? await readAssignmentEvidence(access, selected.id, context.origin)
        : null;
    if (
      context.student &&
      !progress?.students.some((s) => s.student_id === context.student)
    )
      notFound();
    if (context.concept && !content?.concept_ids.has(context.concept))
      notFound();
    const followups = progress
      ? await Promise.all(
          (await readInterventionDrafts(access, progress.assignment_id)).map(
            (draft) => readInterventionReview(access, draft.id),
          ),
        )
      : [];
    return {
      context,
      classes: index.classes,
      assignments,
      visible,
      selected,
      content,
      progress,
      followups,
    };
  });
}
