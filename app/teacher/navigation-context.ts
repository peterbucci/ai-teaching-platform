import {
  parseTeacherWorkspaceContext,
  teacherWorkspaceHref,
  type TeacherWorkspaceContext,
  type TeacherWorkspaceParams,
} from "../../lib/teacher/workspace-contracts.ts";

export type TeacherNavigationPath =
  | "/teacher"
  | "/teacher/evidence"
  | "/teacher/interventions"
  | "/teacher/lessons"
  | "/teacher/assignments"
  | "/teacher/students"
  | "/teacher/materials"
  | "/teacher/objectives";

export function resolveTeacherNavigationContext(
  context: TeacherWorkspaceContext | undefined,
  params: TeacherWorkspaceParams,
  contextIsAuthoritative = false,
): TeacherWorkspaceContext {
  // A loaded draft's scope has already been resolved from its authorized saved
  // evidence. Even identities absent from that scope must stay absent.
  if (contextIsAuthoritative)
    return context ?? parseTeacherWorkspaceContext({});
  try {
    // A just-acknowledged draft replaces the URL with its complete saved scope.
    // Do not refill absent identities from the earlier preparation page. This
    // resolves links only; destination loaders still authorize the URL.
    if (params.draft !== undefined) return parseTeacherWorkspaceContext(params);
    // Ordinary investigations still follow browser selection updates. Removing
    // all seed parameters deliberately clears the previous selection.
    return parseTeacherWorkspaceContext({
      ...context,
      ...params,
      seedAttempt: params.seedAttempt ?? [],
    });
  } catch {
    // Destination loaders continue to validate authorization and URL inputs.
    return context ?? parseTeacherWorkspaceContext({});
  }
}

export function teacherNavigationHref(
  path: TeacherNavigationPath,
  context: TeacherWorkspaceContext,
) {
  if (
    path === "/teacher/lessons" ||
    path === "/teacher/materials" ||
    path === "/teacher/objectives"
  )
    return path;
  if (path === "/teacher/evidence" || path === "/teacher/interventions")
    return teacherWorkspaceHref(path, context);

  // Keep only the scope understood by each destination. In particular, an
  // answer search must not become the Students page's name search.
  const query = new URLSearchParams();
  if (context.assignment) query.set("assignment", context.assignment);
  if (path !== "/teacher/assignments") query.set("origin", context.origin);
  if (path === "/teacher/students" && context.student)
    query.set("student", context.student);
  return query.size ? `${path}?${query}` : path;
}
