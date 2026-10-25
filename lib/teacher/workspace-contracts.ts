import { z } from "zod";

const identifier = z.string().trim().min(1).max(160);
const contextSchema = z.object({
  assignment: z.uuid().optional(),
  origin: z.enum(["all", "live_demo", "synthetic_fixture"]).default("all"),
  concept: identifier.optional(),
  misconception: identifier.optional(),
  student: identifier.optional(),
  session: z.uuid().optional(),
  attempt: z.uuid().optional(),
  evaluation: z.uuid().optional(),
  q: z.string().trim().max(120).optional(),
  returnTo: z
    .enum(["desk", "evidence", "insights", "patterns", "students", "progress"])
    .default("evidence"),
  seedAttempt: z.array(z.uuid()).max(60).default([]),
  // These presentation fields belong only to a Class Progress return. Other
  // pages retain their own independent pane/class/status parameter contracts.
  progressView: z
    .enum(["grid", "concepts", "questions", "sessions"])
    .optional(),
  progressStudent: z.uuid().optional(),
  progressConcept: identifier.optional(),
  pane: z.enum(["grid", "details"]).optional(),
  class: z.uuid().optional(),
  status: z.enum(["all", "active", "inactive", "unavailable"]).optional(),
});

const progressReturnFields = [
  "progressView",
  "progressStudent",
  "progressConcept",
  "pane",
  "class",
  "status",
] as const;

export type TeacherWorkspaceContext = z.infer<typeof contextSchema>;
export type TeacherWorkspaceParams = Record<
  string,
  string | string[] | undefined
>;
export const TEACHER_CONTEXT_URL_LIMIT = 6000;

/** URLs carry selection identities only. Authorization always belongs to loaders. */
export function parseTeacherWorkspaceContext(
  params: TeacherWorkspaceParams,
): TeacherWorkspaceContext {
  const raw: Record<string, unknown> = {};
  for (const key of Object.keys(contextSchema.shape)) {
    if (
      params.returnTo !== "progress" &&
      progressReturnFields.some((field) => field === key)
    )
      continue;
    const value = params[key];
    raw[key] =
      key === "seedAttempt"
        ? value === undefined
          ? []
          : Array.isArray(value)
            ? value
            : [value]
        : value;
  }
  const context = contextSchema.parse(raw);
  if (context.returnTo === "progress") {
    if (!context.assignment)
      throw new z.ZodError([
        {
          code: "custom",
          path: ["assignment"],
          message: "Class Progress return requires an assignment.",
        },
      ]);
    if (context.student) z.uuid().parse(context.student);
  }
  context.seedAttempt = [...new Set(context.seedAttempt)];
  // Check encoded size as well as field lengths; Unicode expands in URLs.
  if (serialize(context).length > TEACHER_CONTEXT_URL_LIMIT)
    throw new z.ZodError([
      {
        code: "custom",
        path: [],
        message: "Narrow the evidence selection before continuing.",
      },
    ]);
  return context;
}

function serialize(context: TeacherWorkspaceContext) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(context)) {
    if (Array.isArray(value)) value.forEach((id) => query.append(key, id));
    else if (value !== undefined && value !== "") query.set(key, value);
  }
  return query.toString();
}

export function teacherWorkspaceHref(
  path: string,
  context: Partial<TeacherWorkspaceContext>,
  patch: Partial<TeacherWorkspaceContext> = {},
) {
  if (!/^\/teacher(?:\/[a-zA-Z0-9_-]+)*$/.test(path))
    throw new Error("Unsupported teacher workspace route.");
  const merged = { ...context, ...patch };
  const valid = parseTeacherWorkspaceContext(merged);
  return `${path}?${serialize(valid)}`;
}

export function teacherReturnHref(context: TeacherWorkspaceContext) {
  if (context.returnTo === "progress")
    return teacherProgressReturnHref(context);
  const paths = {
    desk: "/teacher",
    evidence: "/teacher/evidence",
    insights: "/teacher/insights",
    patterns: "/teacher/insights",
    students: "/teacher/students",
  } as const;
  const href = teacherWorkspaceHref(paths[context.returnTo], context);
  return context.returnTo === "patterns" ? `${href}#patterns` : href;
}

/** Fixed route and computed anchors only; callers must first authorize context. */
export function teacherProgressReturnHref(context: TeacherWorkspaceContext) {
  const valid = parseTeacherWorkspaceContext(context);
  if (valid.returnTo !== "progress" || !valid.assignment)
    throw new Error("Class Progress return requires an assignment context.");
  const progressView = valid.progressView ?? "grid";
  const pane = valid.pane ?? "grid";
  const query = new URLSearchParams({
    assignment: valid.assignment,
    view: "progress",
    origin: valid.origin,
    ...(valid.progressStudent ? { student: valid.progressStudent } : {}),
    ...(valid.progressConcept ? { concept: valid.progressConcept } : {}),
    progressView,
    pane,
    ...(valid.class ? { class: valid.class } : {}),
    ...(valid.status ? { status: valid.status } : {}),
  });
  const selectionExists =
    progressView === "grid"
      ? Boolean(valid.progressStudent || valid.progressConcept)
      : progressView === "concepts" && Boolean(valid.progressConcept);
  const anchor =
    pane === "details"
      ? "cell-evidence"
      : selectionExists
        ? `ap-selection-${progressView === "concepts" ? "all" : (valid.progressStudent ?? "all")}-${valid.progressConcept ?? "all"}`
        : "progress-main";
  return `/teacher/assignments?${query}#${encodeURIComponent(anchor)}`;
}
