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
    .enum(["desk", "evidence", "insights", "patterns", "students"])
    .default("evidence"),
  seedAttempt: z.array(z.uuid()).max(60).default([]),
});

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
