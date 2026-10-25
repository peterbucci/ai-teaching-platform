import type { InterventionEvidence } from "../../../lib/interventions/contracts.ts";
import type { InterventionDraft } from "../../../lib/interventions/drafts.ts";
import {
  parseTeacherWorkspaceContext,
  teacherWorkspaceHref,
  type TeacherWorkspaceContext,
  type TeacherWorkspaceParams,
} from "../../../lib/teacher/workspace-contracts.ts";

function evidenceContext(
  context: TeacherWorkspaceContext,
  evidence: InterventionEvidence,
): TeacherWorkspaceContext {
  return {
    assignment: evidence.selection.assignment_id,
    origin: evidence.selection.origin,
    concept: evidence.selection.concept_id,
    misconception: evidence.selection.misconception_id ?? undefined,
    seedAttempt: [...evidence.selection.attempt_ids],
    returnTo: context.returnTo,
  };
}

/** Call only after reading the actor's authorized saved draft. URL filters must
 * not replace its evidence scope or combine identities from different responses. */
export function snapshotInterventionContext(
  context: TeacherWorkspaceContext,
  draft: Pick<InterventionDraft, "assignment_id" | "evidence">,
): TeacherWorkspaceContext | null {
  const evidence = draft.evidence;
  if (
    draft.assignment_id !== evidence.selection.assignment_id ||
    (context.assignment && context.assignment !== draft.assignment_id)
  )
    return null;
  const selected =
    context.attempt || context.evaluation
      ? evidence.observations.find(
          (item) =>
            (!context.attempt || context.attempt === item.attempt.id) &&
            (!context.evaluation ||
              context.evaluation === item.evaluation.id) &&
            (!context.session || context.session === item.session_id) &&
            (!context.student || context.student === item.student_id),
        )
      : undefined;
  return {
    ...evidenceContext(context, evidence),
    ...(selected
      ? {
          student: selected.student_id,
          session: selected.session_id,
          attempt: selected.attempt.id,
          evaluation: selected.evaluation.id,
        }
      : {}),
  };
}

/** Validate an acknowledged request before changing the displayed draft or URL.
 * The API response is authorized separately; this prevents one editor from
 * adopting another request's draft or retaining an unrelated recovery scope. */
export function acknowledgedInterventionContext(
  params: TeacherWorkspaceParams,
  draft: Pick<InterventionDraft, "id" | "assignment_id" | "evidence">,
  expectedDraftId?: string | null,
): TeacherWorkspaceContext {
  if (expectedDraftId && draft.id !== expectedDraftId)
    throw new Error(
      "The generation result belongs to another draft. The current activity is unchanged.",
    );
  const context = snapshotInterventionContext(
    parseTeacherWorkspaceContext(params),
    draft,
  );
  if (!context)
    throw new Error(
      "The generation result does not match this assignment. The current activity is unchanged.",
    );
  return context;
}

export function interventionObservationHref(
  context: TeacherWorkspaceContext,
  evidence: InterventionEvidence,
  attemptId: string,
) {
  const observation = evidence.observations.find(
    (item) => item.attempt.id === attemptId,
  );
  if (!observation)
    throw new Error(
      "Response is not part of this intervention's saved evidence.",
    );
  return `${teacherWorkspaceHref(
    `/teacher/sessions/${observation.session_id}`,
    evidenceContext(context, evidence),
    {
      student: observation.student_id,
      session: observation.session_id,
      attempt: observation.attempt.id,
      evaluation: observation.evaluation.id,
    },
  )}#evaluation-${observation.evaluation.id}`;
}
