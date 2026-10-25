import {
  parseTeacherWorkspaceContext,
  teacherWorkspaceHref,
  type TeacherWorkspaceContext,
  type TeacherWorkspaceParams,
} from "../../lib/teacher/workspace-contracts.ts";

/** Display-only metadata from teacherAssignments; never grants access. */
export type WorkspaceAssignment = {
  id: string;
  title: string;
  class_name: string;
  version?: string;
  availability?: "active" | "inactive" | "unavailable";
};

export function workspaceDestination(path: string, view?: string | null) {
  if (
    path === "/teacher/assignments" &&
    ["progress", "review", "preview"].includes(view ?? "")
  )
    return "Progress";
  if (path.startsWith("/teacher/assignments")) return "Assignments";
  if (/^\/teacher\/(lessons|materials|objectives)(\/|$)/.test(path))
    return "Lessons";
  if (path.startsWith("/teacher/interventions")) return "Interventions";
  if (path.startsWith("/teacher/students")) return "Roster";
  if (/^\/teacher\/(evidence|insights|patterns|sessions)(\/|$)/.test(path))
    return "Student work";
  return "Overview";
}

export function resolveWorkspaceSelection(
  params: TeacherWorkspaceParams,
  context: TeacherWorkspaceContext | undefined,
  assignments: WorkspaceAssignment[],
) {
  // A page's server-resolved context wins over a stale URL (e.g. a saved draft's
  // actual assignment). An explicit unknown ID never becomes the first item.
  const parsed = parseTeacherWorkspaceContext({ ...params, ...context });
  const assignment = assignments.find(
    (item) => item.id === (parsed.assignment ?? assignments[0]?.id),
  );
  return {
    assignment,
    context: { ...parsed, assignment: assignment?.id ?? parsed.assignment },
  };
}

export function workspaceNavigationHref(
  path: string,
  context: Partial<TeacherWorkspaceContext>,
  view?: "progress" | "review" | "preview",
) {
  // Preserve investigation filters, but a shared navigation action must not
  // carry a draft, request, pane or selected intervention starting responses.
  const href = teacherWorkspaceHref(path, context, { seedAttempt: [] });
  return view ? `${href}&view=${view}` : href;
}

export function switchedAssignmentHref(
  assignment: string,
  origin: TeacherWorkspaceContext["origin"],
) {
  // A different published version/class invalidates record and concept IDs.
  return workspaceNavigationHref(
    "/teacher/assignments",
    { assignment, origin },
    "progress",
  );
}
