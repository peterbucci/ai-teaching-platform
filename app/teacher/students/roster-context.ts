import { z } from "zod";
import {
  parseTeacherWorkspaceContext,
  teacherWorkspaceHref,
  type TeacherWorkspaceParams,
} from "../../../lib/teacher/workspace-contracts.ts";

export function parseRosterContext(raw: TeacherWorkspaceParams) {
  const shared = parseTeacherWorkspaceContext(raw);
  const local = z
    .object({
      student: z.uuid().optional(),
      rosterPane: z.enum(["navigation", "main", "context"]).default("main"),
      participation: z
        .enum(["all", "submitted", "opened", "missing"])
        .default("all"),
    })
    .parse(raw);
  return { ...shared, ...local, returnTo: "students" as const };
}
export type RosterContext = ReturnType<typeof parseRosterContext>;

export function rosterHref(
  context: RosterContext,
  patch: Partial<RosterContext> = {},
  anchor?: string,
) {
  const next = parseRosterContext({ ...context, ...patch });
  const query = new URLSearchParams({
    assignment: next.assignment ?? "",
    origin: next.origin,
    participation: next.participation,
    rosterPane: next.rosterPane,
  });
  for (const key of [
    "student",
    "concept",
    "q",
    "attempt",
    "session",
    "evaluation",
  ] as const)
    if (next[key]) query.set(key, next[key]);
  // The shared pane component owns workspacePane; the session receiver preserves
  // rosterPane so the outgoing return does not depend on arbitrary URLs.
  query.set("workspacePane", next.rosterPane);
  return `/teacher/students?${query}${anchor ? `#${encodeURIComponent(anchor)}` : ""}`;
}

export function rosterSessionHref(
  context: RosterContext,
  session: string,
  attempt?: string,
  evaluation?: string,
) {
  const href = teacherWorkspaceHref(`/teacher/sessions/${session}`, context, {
    session,
    attempt,
    evaluation,
    returnTo: "students",
  });
  const url = new URL(href, "http://roster.local");
  url.searchParams.set("rosterPane", context.rosterPane);
  url.searchParams.set("participation", context.participation);
  url.hash = attempt ? `attempt-${attempt}` : "";
  return `${url.pathname}${url.search}${url.hash}`;
}
