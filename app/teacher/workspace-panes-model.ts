export const TEACHER_WORKSPACE_PANE_PARAM = "workspacePane";

export type TeacherWorkspacePaneId = "navigation" | "main" | "context";
export type TeacherWorkspacePaneViewport = "wide" | "medium" | "compact";

export function availableTeacherWorkspacePanes(
  hasNavigation: boolean,
  hasContext: boolean,
): TeacherWorkspacePaneId[] {
  return [
    ...(hasNavigation ? (["navigation"] as const) : []),
    "main",
    ...(hasContext ? (["context"] as const) : []),
  ];
}

/** Pane selection is presentation state, never assignment or record authority. */
export function resolveTeacherWorkspacePane(
  search: Pick<URLSearchParams, "getAll">,
  available: readonly TeacherWorkspacePaneId[],
  initial: TeacherWorkspacePaneId = "main",
): TeacherWorkspacePaneId {
  const fallback = available.includes(initial) ? initial : "main";
  const values = search.getAll(TEACHER_WORKSPACE_PANE_PARAM);
  if (values.length !== 1) return fallback;
  return available.find((pane) => pane === values[0]) ?? fallback;
}

/** Change only the pane token, retaining the current route and authorized scope. */
export function teacherWorkspacePaneHref(
  current: URL,
  pane: TeacherWorkspacePaneId,
): string {
  const search = new URLSearchParams(current.search);
  search.set(TEACHER_WORKSPACE_PANE_PARAM, pane);
  return `${current.pathname}?${search.toString()}${current.hash}`;
}

/** Arrow keys move tab focus; Enter or Space activates the focused pane. */
export function teacherWorkspacePaneKeyboardTarget(
  panes: readonly TeacherWorkspacePaneId[],
  current: TeacherWorkspacePaneId,
  key: string,
): TeacherWorkspacePaneId | undefined {
  const index = panes.indexOf(current);
  if (index < 0 || panes.length === 0) return undefined;
  if (key === "Home") return panes[0];
  if (key === "End") return panes[panes.length - 1];
  if (key === "ArrowRight") return panes[(index + 1) % panes.length];
  if (key === "ArrowLeft")
    return panes[(index - 1 + panes.length) % panes.length];
  return undefined;
}
