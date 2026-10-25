import type { SessionEvidence } from "../../lib/evidence/contracts.ts";
import {
  parseTeacherWorkspaceContext,
  type TeacherWorkspaceParams,
} from "../../lib/teacher/workspace-contracts.ts";

/** Use only with records returned by readTeacherSession and pinned content.
 * URL validation does not grant access to the session or another assignment.
 */
export function resolveTeacherSessionContext(
  params: TeacherWorkspaceParams,
  evidence: Pick<SessionEvidence, "session" | "attempts" | "evaluations">,
  conceptIds: ReadonlySet<string>,
  rosterStudentIds: ReadonlySet<string>,
) {
  const context = parseTeacherWorkspaceContext({
    ...params,
    // Existing direct, Insights and roster links retain their historic default.
    returnTo: params.returnTo ?? "insights",
  });
  const { session, attempts, evaluations } = evidence;
  if (
    (context.assignment && context.assignment !== session.assignment_id) ||
    (context.student && context.student !== session.student_id) ||
    (context.session && context.session !== session.id) ||
    (context.origin !== "all" && context.origin !== session.data_origin) ||
    (context.attempt &&
      !attempts.some((attempt) => attempt.id === context.attempt)) ||
    (context.evaluation &&
      !evaluations.some(
        (evaluation) =>
          evaluation.id === context.evaluation &&
          (!context.attempt || evaluation.attempt_id === context.attempt),
      )) ||
    (context.returnTo === "progress" &&
      ((context.class && context.class !== session.class_id) ||
        (context.progressStudent &&
          !rosterStudentIds.has(context.progressStudent)) ||
        (context.progressConcept && !conceptIds.has(context.progressConcept))))
  )
    return null;
  // Return selection is independent of the target record; absent selections
  // remain absent rather than adopting the opened session's student/concepts.
  return { ...context, assignment: session.assignment_id };
}
