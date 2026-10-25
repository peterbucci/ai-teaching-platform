import {
  parseTeacherWorkspaceContext,
  teacherWorkspaceHref,
  type TeacherWorkspaceContext,
  type TeacherWorkspaceParams,
} from "../../lib/teacher/workspace-contracts.ts";
import {
  resolveTeacherNavigationContext,
  teacherNavigationHref,
} from "./navigation-context.ts";

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
  contextIsAuthoritative = false,
) {
  // Reuse the repaired foundation's snapshot/canonical-draft precedence. The
  // display adapter additionally refuses malformed explicit URL selections,
  // rather than turning the foundation's safe error fallback into a first item.
  if (!contextIsAuthoritative) parseTeacherWorkspaceContext(params);
  const parsed = parseTeacherWorkspaceContext(
    resolveTeacherNavigationContext(context, params, contextIsAuthoritative),
  );
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
  const selected = parseTeacherWorkspaceContext({
    ...context,
    seedAttempt: [],
  });
  // Explicit assignment views are investigations (including #117's student /
  // concept progress filters), unlike course-level assignment discovery.
  if (view && path === "/teacher/assignments")
    return `${teacherWorkspaceHref(path, selected)}&view=${view}`;
  switch (path) {
    case "/teacher":
    case "/teacher/evidence":
    case "/teacher/interventions":
    case "/teacher/lessons":
    case "/teacher/assignments":
    case "/teacher/students":
    case "/teacher/materials":
    case "/teacher/objectives":
      return teacherNavigationHref(path, selected);
    default:
      return teacherWorkspaceHref(path, selected);
  }
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
