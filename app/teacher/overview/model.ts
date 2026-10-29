import type { TeacherLessonSummary } from "../../../lib/lessons/publishing-contracts.ts";
import type { TeacherWorkspaceContext } from "../../../lib/teacher/workspace-contracts.ts";
import { teacherWorkspaceHref } from "../../../lib/teacher/workspace-contracts.ts";
import {
  teachingPriorities,
  teacherEvidenceRows,
  type EvidenceSnapshot,
  type EvidenceRow,
} from "../evidence/model.ts";

export type OverviewAssignment = {
  id: string;
  title: string;
  class_name: string;
  class_id?: string;
  availability: "active" | "inactive" | "unavailable";
  version?: string;
  snapshot:
    (EvidenceSnapshot & { conceptTitles: Record<string, string> }) | null;
};
export type WorkItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  action: string;
  kind: "lesson" | "private" | "approved" | "delivered";
  assignmentId?: string;
  updatedAt?: string;
};
export type Priority = {
  id: string;
  group: "decision" | "evaluation" | "missing";
  kind: string;
  where: string;
  title: string;
  detail: string;
  note: string;
  href: string;
  action: string;
  count: number;
  rank: number;
};

/** Start fresh: never carry another assignment's student, source or selection. */
export function assignmentHref(
  path: string,
  assignment: string,
  origin: TeacherWorkspaceContext["origin"],
) {
  return teacherWorkspaceHref(path, { assignment, origin, returnTo: "desk" });
}
export function responseHref(
  assignment: string,
  origin: TeacherWorkspaceContext["origin"],
  row: EvidenceRow,
  concept?: string,
) {
  return `${teacherWorkspaceHref("/teacher/evidence", {
    assignment,
    origin,
    returnTo: "desk",
    concept,
    attempt: row.attempt.id,
    session: row.session_id,
    evaluation: row.evaluation?.id,
  })}#response-detail-title`;
}
export function progressHref(
  assignment: string,
  origin: TeacherWorkspaceContext["origin"],
) {
  return `${assignmentHref("/teacher/assignments", assignment, origin)}&view=progress`;
}
export function unfinishedLesson(lesson: TeacherLessonSummary) {
  // A published current version is immutable and is not an unfinished draft.
  return (
    !lesson.content_version ||
    !lesson.published_versions.includes(lesson.content_version)
  );
}

/** Reuse the established metrics; no cross-assignment student totals or AI ranking. */
export function overviewPriorities(
  assignments: OverviewAssignment[],
  work: WorkItem[],
  origin: TeacherWorkspaceContext["origin"],
): Priority[] {
  const priorities: Priority[] = [];
  for (const assignment of assignments) {
    const snapshot = assignment.snapshot;
    if (!snapshot || assignment.availability !== "active") continue;
    const where = `${assignment.class_name} · ${assignment.title}`;
    for (const item of teachingPriorities(snapshot)) {
      const title =
        snapshot.conceptTitles[item.concept_id] ?? "Assigned concept";
      const evaluation = item.kind === "evaluation";
      const followup = item.kind === "followup";
      priorities.push({
        id: `${assignment.id}:${item.concept_id}:${item.kind}`,
        group: evaluation ? "evaluation" : "decision",
        kind: evaluation
          ? "Evaluation to check"
          : followup
            ? "Earlier difficulty"
            : "Reasoning to review",
        where,
        title: evaluation
          ? `Check saved answers · ${title}`
          : followup
            ? `Compare earlier and later work · ${title}`
            : `Look into ${title}`,
        detail: `${item.count} of ${item.denominator} ${followup ? "assessed students have repeated earlier partial or incorrect answers" : evaluation ? "enrolled students have a pending, failed or rejected latest evaluation" : item.kind === "uncertain" ? "enrolled students have an uncertain latest evaluation" : "enrolled students have a partial or incorrect latest answer"}.`,
        note: followup
          ? "Later work may be correct. Compare the sequence before deciding."
          : "",
        href: item.row
          ? responseHref(assignment.id, origin, item.row, item.concept_id)
          : teacherWorkspaceHref("/teacher/evidence", {
              assignment: assignment.id,
              origin,
              concept: item.concept_id,
              returnTo: "desk",
            }),
        action: evaluation ? "Check answers" : "Review evidence",
        count: item.count,
        rank: evaluation ? 4 : followup ? 2 : item.kind === "uncertain" ? 1 : 0,
      });
    }
    if (snapshot.metrics.no_activity_students)
      priorities.push({
        id: `${assignment.id}:missing`,
        group: "missing",
        kind: "No submitted answer",
        where,
        title: `${snapshot.metrics.no_activity_students} of ${snapshot.metrics.enrolled_students} students haven’t answered in this view`,
        detail: "Counted separately for this assignment and evidence filter.",
        note: "Missing work is not evidence of a misunderstanding or lack of effort.",
        href: progressHref(assignment.id, origin),
        action: "Review progress",
        count: snapshot.metrics.no_activity_students,
        rank: 5,
      });
  }
  for (const item of work) {
    if (item.kind !== "approved" && item.kind !== "delivered") continue;
    const assignment = assignments.find(
      (value) => value.id === item.assignmentId,
    );
    if (!assignment) continue;
    priorities.push({
      id: item.id,
      group: "decision",
      kind:
        item.kind === "approved"
          ? "Ready for delivery review"
          : "Delivered activity",
      where: `${assignment.class_name} · ${assignment.title}`,
      title: item.title,
      detail: item.detail,
      note:
        item.kind === "approved"
          ? "Approval sends nothing. Delivery remains a separate teacher action."
          : "Inspect recorded follow-up; immediate success does not establish retention.",
      href: item.href,
      action: item.action,
      count: 0,
      rank: 3,
    });
  }
  return priorities.sort(
    (a, b) =>
      a.rank - b.rank ||
      b.count - a.count ||
      a.where.localeCompare(b.where) ||
      a.id.localeCompare(b.id),
  );
}

export function recentActivity(
  assignments: OverviewAssignment[],
  origin: TeacherWorkspaceContext["origin"],
) {
  return assignments
    .flatMap((assignment) =>
      assignment.snapshot
        ? teacherEvidenceRows(assignment.snapshot).map((row) => ({
            id: row.attempt.id,
            title: row.student_name,
            where: `${assignment.class_name} · ${assignment.title}`,
            at: row.attempt.submitted_at!,
            origin: row.data_origin,
            href: responseHref(
              assignment.id,
              origin,
              row,
              row.attempt.question.concept_ids[0],
            ),
          }))
        : [],
    )
    .sort(
      (a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id),
    )
    .slice(0, 5);
}
