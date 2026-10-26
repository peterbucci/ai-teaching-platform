import type { InterventionEvidence } from "../../../lib/interventions/contracts.ts";
import {
  teacherWorkspaceHref,
  type TeacherWorkspaceContext,
} from "../../../lib/teacher/workspace-contracts.ts";

/** A changed starting set must be expanded and reviewed on the server again. */
export function matchesReviewedSelection(
  selected: string[],
  reviewed: string[],
) {
  return (
    selected.length === reviewed.length &&
    selected.every((id) => reviewed.includes(id))
  );
}

export function interventionPreviewHref(
  context: TeacherWorkspaceContext,
  selected: string[],
) {
  return teacherWorkspaceHref("/teacher/interventions", context, {
    seedAttempt: selected,
  });
}

export function evidenceScopeCounts(evidence: InterventionEvidence) {
  return {
    starting: evidence.selection.attempt_ids.length,
    supporting: evidence.observations.filter(
      (item) => item.role === "supporting",
    ).length,
    contrary: evidence.observations.filter(
      (item) => item.role === "contradictory",
    ).length,
    context: evidence.observations.filter((item) => item.role === "context")
      .length,
  };
}
