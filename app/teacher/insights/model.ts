import type { SessionEvidence } from "../../../lib/evidence/contracts.ts";
import type { PatternGroup } from "../../../lib/teacher/patterns.ts";
import {
  teacherWorkspaceHref,
  type TeacherWorkspaceContext,
} from "../../../lib/teacher/workspace-contracts.ts";
import { canPrepareFromRow, type EvidenceRow } from "../evidence/model.ts";

export const patternStatusLabels = {
  suspected: "Suggested, not yet checked",
  supported: "Supported by follow-up",
  uncertain: "Unclear",
  not_supported: "Evidence against",
} as const;

/** Resolve identities against the authorized snapshot, including historical
 * evaluations. Never guess that a supporting evaluation is in the same session. */
export function evaluationRows(
  rows: EvidenceRow[],
  sessions: SessionEvidence[],
) {
  const byAttempt = new Map(rows.map((row) => [row.attempt.id, row]));
  const result = new Map<string, EvidenceRow>();
  for (const session of sessions)
    for (const evaluation of session.evaluations) {
      const row = byAttempt.get(evaluation.attempt_id);
      if (row && row.session_id === session.session.id)
        result.set(evaluation.id, { ...row, evaluation });
    }
  return result;
}

export function concernResponses(
  group: PatternGroup,
  refs: Map<string, EvidenceRow>,
) {
  const ids = new Set(
    group.students.flatMap((student) =>
      student.history.flatMap((observation) => [
        observation.evaluation_id,
        ...observation.supporting_evaluation_ids,
        ...observation.contradicting_evaluation_ids,
      ]),
    ),
  );
  const related = [...ids]
    .map((id) => refs.get(id))
    .filter((row): row is EvidenceRow => Boolean(row));
  return new Set(related.map((row) => row.attempt.id)).size;
}

export function investigationContext(
  context: TeacherWorkspaceContext,
): TeacherWorkspaceContext {
  // A returned inspected record must not narrow the concern to one response or
  // accidentally become an intervention seed. Only the investigation scope survives.
  return {
    assignment: context.assignment,
    origin: context.origin,
    concept: context.concept,
    misconception: context.misconception,
    returnTo: context.returnTo,
    seedAttempt: [],
  };
}

export function originalEvidenceHref(
  context: TeacherWorkspaceContext,
  row: EvidenceRow,
) {
  return teacherWorkspaceHref(
    "/teacher/evidence",
    investigationContext(context),
    {
      attempt: row.attempt.id,
      evaluation: row.evaluation?.id,
      session: row.session_id,
    },
  );
}

export function originalSessionHref(
  context: TeacherWorkspaceContext,
  row: EvidenceRow,
) {
  const href = teacherWorkspaceHref(
    `/teacher/sessions/${row.session_id}`,
    investigationContext(context),
    {
      attempt: row.attempt.id,
      evaluation: row.evaluation?.id,
      session: row.session_id,
    },
  );
  return `${href}#${row.evaluation ? `evaluation-${row.evaluation.id}` : `attempt-${row.attempt.id}`}`;
}

export function concernPreparation(
  group: PatternGroup,
  rows: EvidenceRow[],
  context: TeacherWorkspaceContext,
): string | null {
  if (
    !group.misconception_id ||
    group.misconception_id === "other_or_uncertain"
  )
    return null;
  const ids = new Set(
    group.students
      .filter(
        (student) =>
          student.current.status === "suspected" ||
          student.current.status === "supported",
      )
      .map((student) => student.current.attempt_id),
  );
  const seeds = rows
    .filter(
      (row) =>
        ids.has(row.attempt.id) && canPrepareFromRow(row, group.concept_id),
    )
    .map((row) => row.attempt.id);
  // Preserve the entire supported scope or ask the teacher to select it in Evidence.
  if (!seeds.length || seeds.length > 60) return null;
  return teacherWorkspaceHref(
    "/teacher/interventions",
    investigationContext(context),
    { seedAttempt: seeds },
  );
}

export function assistanceLabel(row: EvidenceRow, concept: string) {
  const assistance = row.attempt.assistance;
  if (!assistance) return "Assistance not recorded";
  const independent =
    assistance.independent_retrieval_eligible_by_concept[concept];
  return `${independent === true ? "Independent retrieval eligible" : independent === false ? "Not independent retrieval" : "Independence not recorded"} · ${assistance.assistance_level.replaceAll("_", " ")}`;
}
