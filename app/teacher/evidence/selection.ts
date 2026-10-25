import type { TeacherWorkspaceContext } from "../../../lib/teacher/workspace-contracts.ts";
import {
  canPrepareFromRow,
  teacherEvidenceRows,
  type EvidenceSnapshot,
} from "./model.ts";

/** Resolve only within an already authorized, origin-filtered assignment snapshot. */
export function resolveEvidenceSelection(
  data: EvidenceSnapshot,
  context: TeacherWorkspaceContext,
) {
  const allRows = teacherEvidenceRows(data);
  if (
    context.student &&
    !data.students.some((student) => student.student_id === context.student)
  )
    return null;
  const requestedSession = context.session
    ? data.evidence.find((item) => item.session.id === context.session)
    : undefined;
  if (context.session && !requestedSession) return null;
  if (
    requestedSession &&
    context.student &&
    requestedSession.session.student_id !== context.student
  )
    return null;
  const requestedEvaluation = context.evaluation
    ? data.evidence
        .flatMap((item) => item.evaluations)
        .find((item) => item.id === context.evaluation)
    : undefined;
  if (context.evaluation && !requestedEvaluation) return null;
  if (
    context.attempt &&
    requestedEvaluation &&
    requestedEvaluation.attempt_id !== context.attempt
  )
    return null;
  const requestedAttempt = context.attempt ?? requestedEvaluation?.attempt_id;
  const requested = requestedAttempt
    ? allRows.find((row) => row.attempt.id === requestedAttempt)
    : undefined;
  if (requestedAttempt && !requested) return null;
  const matchesIdentity = (row: (typeof allRows)[number]) =>
    (!context.student || row.student_id === context.student) &&
    (!context.session || row.session_id === context.session);
  if (requested && !matchesIdentity(requested)) return null;
  const scopedRows = allRows.filter(matchesIdentity);
  const concept =
    context.concept ??
    requested?.attempt.question.concept_ids[0] ??
    data.metrics.concepts.find((item) =>
      scopedRows.some((row) =>
        row.attempt.question.concept_ids.includes(item.concept_id),
      ),
    )?.concept_id ??
    data.metrics.concepts[0]?.concept_id;
  const metric = data.metrics.concepts.find(
    (item) => item.concept_id === concept,
  );
  if (context.concept && !metric) return null;
  const conceptRows = allRows.filter(
    (row) =>
      row.attempt.question.concept_ids.includes(concept ?? "") &&
      (!context.student || row.student_id === context.student),
  );
  if (requested && !conceptRows.includes(requested)) return null;
  if (
    context.seedAttempt.some(
      (id) =>
        !allRows.some(
          (row) =>
            row.attempt.id === id && canPrepareFromRow(row, concept ?? ""),
        ),
    )
  )
    return null;
  const query = (context.q ?? "").toLocaleLowerCase();
  const visibleRows = conceptRows.filter(
    (row) =>
      !query ||
      `${row.student_name} ${row.attempt.question.prompt_text} ${row.attempt.response_text}`
        .toLocaleLowerCase()
        .includes(query),
  );
  // Keep the class results available for deliberate navigation, but never use
  // another session's result to satisfy an explicit investigation identity.
  const selected = requested ?? visibleRows.find(matchesIdentity);
  const session = selected
    ? data.evidence.find((item) => item.session.id === selected.session_id)
    : undefined;
  const evaluation = requestedEvaluation ?? selected?.evaluation;
  return {
    requested,
    concept,
    metric,
    conceptRows,
    query,
    visibleRows,
    selected,
    session,
    evaluation,
  };
}
