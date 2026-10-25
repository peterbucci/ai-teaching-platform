import { z } from "zod";
import { AssignedLessonSchema } from "../../../lib/tutoring/contracts.ts";
import { StudentSessionViewSchema } from "../../../lib/evidence/contracts.ts";
import { ReaderLocationSchema } from "../../../lib/reading/model.ts";
import { assignmentStudyHref } from "../../../lib/tutoring/navigation.ts";

const assignmentId = AssignedLessonSchema.shape.id;
const sessionId = StudentSessionViewSchema.shape.session.shape.id;
const anchor = z
  .string()
  .max(240)
  .regex(
    /^(?:conversation|P\d+|(?:question|feedback|dialogue|topic)-[\p{L}\p{N}_:.-]+)$/u,
  )
  .optional();
const reading = z.literal(true).optional();
const routes = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("learning") }),
  z.strictObject({ kind: z.literal("history") }),
  z.strictObject({
    kind: z.literal("assignment"),
    assignmentId,
    tab: z.enum(["overview", "study", "work", "materials"]),
    sessionId: sessionId.optional(),
    reading,
    anchor,
  }),
  z.strictObject({
    kind: z.literal("reading"),
    location: ReaderLocationSchema,
    citationId: z.uuid().optional(),
    fromStudy: z.literal(true).optional(),
    anchor,
  }),
  z.strictObject({ kind: z.literal("review"), approvalId: z.uuid() }),
  z.strictObject({
    kind: z.literal("legacy-study"),
    assignmentId: assignmentId.optional(),
    sessionId: sessionId.optional(),
    reading,
    anchor,
  }),
]);

/** Syntax only; callers MUST resolve IDs/versions against authorized server data.
 * Invalid identity returns null, never another student's/default/latest record.
 */
export const NotebookRouteStateSchema = routes.superRefine((route, ctx) => {
  if (
    route.kind === "reading" &&
    ((route.citationId &&
      (!route.location.sessionId || !route.location.passageId)) ||
      (route.fromStudy && !route.location.sessionId))
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Session reading context is incomplete",
    });
  }
});
export type NotebookRouteState = z.infer<typeof NotebookRouteStateSchema>;

/** Existing destinations only. No arbitrary return URL or browser storage. */
export function notebookHref(input: NotebookRouteState): string {
  const route = NotebookRouteStateSchema.parse(input);
  const query = new URLSearchParams();
  let path: string;
  let fragment: string | undefined;
  switch (route.kind) {
    case "learning":
      return "/study/assignments";
    case "history":
      return "/study/history";
    case "review":
      return `/study/interventions/${route.approvalId}`;
    case "assignment":
      if (route.tab === "study") {
        const existing = new URL(
          assignmentStudyHref(route.assignmentId, route.sessionId),
          "https://notebook.invalid",
        );
        existing.searchParams.forEach((value, key) => query.set(key, value));
      } else {
        query.set("tab", route.tab);
        if (route.sessionId) query.set("session", route.sessionId);
      }
      path = `/study/assignments/${route.assignmentId}`;
      if (route.reading) query.set("reading", "1");
      fragment = route.anchor;
      break;
    case "reading": {
      path = "/study/reading";
      const location = route.location;
      if (location.assignmentId) query.set("assignment", location.assignmentId);
      if (location.contentVersion)
        query.set("version", location.contentVersion);
      if (location.passageId) query.set("passage", location.passageId);
      if (location.sessionId) query.set("session", location.sessionId);
      if (route.citationId) query.set("citation", route.citationId);
      if (route.fromStudy) query.set("from", "study");
      fragment = route.anchor;
      break;
    }
    case "legacy-study":
      path = "/study";
      if (route.assignmentId) query.set("assignment", route.assignmentId);
      if (route.sessionId) query.set("session", route.sessionId);
      if (route.reading) query.set("reading", "1");
      fragment = route.anchor;
  }
  return (
    path +
    (query.size ? `?${query}` : "") +
    (fragment ? `#${encodeURIComponent(fragment)}` : "")
  );
}

/** Unknown query keys are discarded, not reflected. Repeated keys are rejected.
 * Only app-relative paths are accepted; URL normalization cannot hide traversal.
 */
export function parseNotebookHref(href: string): NotebookRouteState | null {
  if (
    href.length > 4096 ||
    !href.startsWith("/study") ||
    /[\\\s\u0000-\u001f\u007f]/u.test(href)
  )
    return null;
  const rawPath = href.split(/[?#]/, 1)[0];
  if (/%|\/\.|\/\//.test(rawPath)) return null;
  let url: URL;
  let fragment: string | undefined;
  try {
    url = new URL(href, "https://notebook.invalid");
    fragment = url.hash ? decodeURIComponent(url.hash.slice(1)) : undefined;
  } catch {
    return null;
  }
  if (url.origin !== "https://notebook.invalid") return null;
  const q = url.searchParams;
  if ([...q.keys()].some((key) => q.getAll(key).length !== 1)) return null;
  const value = (key: string) => q.get(key) ?? undefined;
  // Invalid known flags must not silently select a different mode.
  if (
    (q.has("reading") && value("reading") !== "1") ||
    (q.has("from") && value("from") !== "study")
  )
    return null;
  let candidate: unknown;
  const assignment = /^\/study\/assignments\/([^/]+)$/.exec(rawPath);
  const review = /^\/study\/interventions\/([^/]+)$/.exec(rawPath);
  if (assignment)
    candidate = {
      kind: "assignment",
      assignmentId: assignment[1],
      tab: value("tab") ?? "overview",
      sessionId: value("session"),
      reading: q.has("reading") ? true : undefined,
      anchor: fragment,
    };
  else if (review && !fragment)
    candidate = { kind: "review", approvalId: review[1] };
  else if (rawPath === "/study/assignments" && !fragment)
    candidate = { kind: "learning" };
  else if (rawPath === "/study/history" && !fragment)
    candidate = { kind: "history" };
  else if (rawPath === "/study/reading")
    candidate = {
      kind: "reading",
      location: {
        assignmentId: value("assignment"),
        contentVersion: value("version"),
        passageId: value("passage"),
        sessionId: value("session"),
      },
      citationId: value("citation"),
      fromStudy: q.has("from") ? true : undefined,
      anchor: fragment,
    };
  else if (rawPath === "/study")
    candidate = {
      kind: "legacy-study",
      assignmentId: value("assignment"),
      sessionId: value("session"),
      reading: q.has("reading") ? true : undefined,
      anchor: fragment,
    };
  const parsed = NotebookRouteStateSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
