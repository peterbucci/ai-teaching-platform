import type { LessonDraftContent } from "../../../lib/lessons/contracts.ts";

/** Presentation only. Approval and publication always use server validation. */
export function resumeLessonStep(
  draft: LessonDraftContent | null,
  approved: boolean,
) {
  // Older prepared lessons predate the optional authoring workflows. Their
  // content is still reviewable; do not send them into unavailable editors.
  if (draft && !draft.objective_workflow && !draft.question_bank)
    return approved ? "publication" : "approval";
  if (!draft?.objective_workflow?.reviewed && !draft?.concepts?.length)
    return "objectives";
  if (draft.objective_workflow && !draft.objective_workflow.reviewed)
    return "objectives";
  if (!draft.question_bank?.approval) return "questions";
  if (!draft.sequence) return "sequence";
  return approved ? "publication" : "approval";
}

export function lessonStepHref(id: string, step: string) {
  const lesson = `/teacher/lessons/${encodeURIComponent(id)}`;
  if (step === "objectives")
    return `/teacher/objectives/${encodeURIComponent(id)}`;
  if (step === "questions") return `${lesson}/questions`;
  return `${lesson}?step=${encodeURIComponent(step)}`;
}

export function sequenceCoverage(draft: LessonDraftContent | null) {
  const selected = new Set(draft?.sequence?.concept_ids ?? []);
  return {
    included: (draft?.concepts ?? []).filter((concept) =>
      selected.has(concept.id),
    ),
    outside: (draft?.concepts ?? []).filter(
      (concept) => !selected.has(concept.id),
    ),
    bankCount: draft?.questions?.length ?? 0,
    preparedCount: (draft?.questions ?? []).filter((question) =>
      Boolean(
        draft?.sequence && question.sequence_id === draft.sequence.sequence_id,
      ),
    ).length,
  };
}
