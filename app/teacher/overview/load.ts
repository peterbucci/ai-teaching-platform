import "server-only";
import type { EvidenceAccess } from "../../../lib/evidence/store.ts";
import { EvidenceError } from "../../../lib/evidence/store.ts";
import {
  teacherAssignments,
  readAssignmentEvidence,
} from "../../../lib/teacher/store.ts";
import { assignmentReview } from "../../../lib/assignments/store.ts";
import { readAssignmentContent } from "../../../lib/lessons/store.ts";
import {
  listTeacherLessons,
  lessonPublishingReview,
} from "../../../lib/lessons/publishing.ts";
import { readInterventionDrafts } from "../../../lib/interventions/store.ts";
import { readInterventionReview } from "../../../lib/interventions/approval.ts";
import type { TeacherWorkspaceContext } from "../../../lib/teacher/workspace-contracts.ts";
import {
  lessonStepHref,
  resumeLessonStep,
} from "../lessons/authoring-state.ts";
import {
  assignmentHref,
  unfinishedLesson,
  type OverviewAssignment,
  type WorkItem,
} from "./model.ts";

const services = {
  teacherAssignments,
  readAssignmentEvidence,
  assignmentReview,
  readAssignmentContent,
  listTeacherLessons,
  lessonPublishingReview,
  readInterventionDrafts,
  readInterventionReview,
};
/** Page-local read composition. Each service retains its own authorization.
 * At most four assignments load concurrently; failures never become zero counts. */
export async function loadOverview(
  access: EvidenceAccess,
  context: TeacherWorkspaceContext,
  overrides: Partial<typeof services> = {},
) {
  const reads = { ...services, ...overrides };
  const owned = await reads.teacherAssignments(access);
  if (context.assignment && !owned.some((a) => a.id === context.assignment))
    throw new EvidenceError(404, "Assignment not found.");
  const assignments: OverviewAssignment[] = [];
  const work: WorkItem[] = [];
  const notices: string[] = [];
  for (let offset = 0; offset < owned.length; offset += 4) {
    const batch = await Promise.all(
      owned.slice(offset, offset + 4).map(async (summary) => {
        const assignment: OverviewAssignment = {
          ...summary,
          availability: "unavailable",
          snapshot: null,
        };
        const items: WorkItem[] = [];
        const errors: string[] = [];
        try {
          const review = await reads.assignmentReview(access, summary.id);
          assignment.class_id = review.class_id;
          assignment.version = review.content_ref.content_version;
          assignment.availability = review.teacher_approved_at
            ? "active"
            : "inactive";
          const [evidence, content] = await Promise.all([
            reads.readAssignmentEvidence(access, summary.id, context.origin),
            reads.readAssignmentContent(access, summary.id, "teacher"),
          ]);
          assignment.snapshot = {
            ...evidence,
            conceptTitles: Object.fromEntries(
              [...content.concepts].map(([id, concept]) => [id, concept.title]),
            ),
          };
        } catch {
          errors.push(
            `Evidence unavailable for ${summary.class_name} · ${summary.title}. Its counts are excluded; open the assignment to review or reload to retry.`,
          );
        }
        try {
          const drafts = await reads.readInterventionDrafts(access, summary.id);
          if (drafts.length === 30)
            errors.push(
              `Showing the 30 most recently saved interventions for ${summary.title}; older drafts may not appear here.`,
            );
          for (const draft of drafts) {
            if (draft.status === "dismissed") continue;
            try {
              const review =
                draft.status === "approved"
                  ? await reads.readInterventionReview(access, draft.id)
                  : null;
              const kind = review?.delivery
                ? "delivered"
                : draft.status === "approved"
                  ? "approved"
                  : "private";
              items.push({
                id: draft.id,
                title: draft.activity.title,
                kind,
                assignmentId: summary.id,
                detail:
                  kind === "private"
                    ? `${summary.class_name} · private intervention · revision ${draft.revision}`
                    : kind === "approved"
                      ? `Revision ${review!.approval!.approved_revision} approved for ${review!.approval!.recipient_ids.length} selected students.`
                      : `Delivered to ${review!.delivery!.recipient_ids.length} selected students. Open the activity to inspect follow-up.`,
                action:
                  kind === "private"
                    ? "Continue intervention"
                    : kind === "approved"
                      ? "Review delivery"
                      : "Review follow-up",
                href: `${assignmentHref("/teacher/interventions", summary.id, draft.evidence.selection.origin)}&draft=${encodeURIComponent(draft.id)}`,
                updatedAt: draft.updated_at,
              });
            } catch {
              errors.push(
                `A saved intervention for ${summary.title} could not be loaded. Open Interventions to retry.`,
              );
            }
          }
        } catch {
          errors.push(
            `Saved interventions for ${summary.title} are unavailable. Reload to retry.`,
          );
        }
        return { assignment, items, errors };
      }),
    );
    for (const result of batch) {
      assignments.push(result.assignment);
      work.push(...result.items);
      notices.push(...result.errors);
    }
  }
  try {
    const lessons = (await reads.listTeacherLessons(access)).filter(
      unfinishedLesson,
    );
    for (const lesson of lessons) {
      try {
        const review = await reads.lessonPublishingReview(access, lesson.id);
        const approved =
          review.lesson.approved_revision === review.lesson.revision;
        const step = resumeLessonStep(review.lesson.draft, approved);
        work.push({
          id: lesson.id,
          title: lesson.title,
          kind: "lesson",
          detail: `Lesson draft · revision ${lesson.revision} · ${approved ? "approved, unpublished" : "private work"}`,
          action: "Continue lesson",
          href: lessonStepHref(lesson.id, step),
        });
      } catch {
        notices.push(
          `Saved lesson “${lesson.title}” is unavailable. Open Lessons to retry.`,
        );
      }
    }
  } catch (error) {
    // Existing lesson service requires at least one owned class, including for
    // a teacher without assignments. Do not invent a new course/role authority.
    notices.push(
      error instanceof EvidenceError && error.status === 403
        ? "Lesson access requires an existing teacher-owned class."
        : "Saved lessons are unavailable. Reload to retry.",
    );
  }
  return { assignments, work, notices };
}
