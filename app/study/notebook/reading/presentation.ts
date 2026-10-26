import {
  notebookHref,
  notebookReadingContext,
  NotebookRouteStateSchema,
} from "../index.ts";
import type { NotebookReadingContext, NotebookReadingProps } from "../index.ts";
import type { StudentReaderView } from "../../../../lib/reading/model.ts";

function sameRecord(left: object | null, right: object | null): boolean {
  if (left === null || right === null) return left === right;
  const entries = Object.entries(left);
  return (
    entries.length === Object.keys(right).length &&
    entries.every(
      ([key, value]) =>
        JSON.stringify(value) === JSON.stringify(Reflect.get(right, key)),
    )
  );
}

/** Presentation consistency only; the existing loader remains the authority. */
export function matchesReadingContext(
  view: StudentReaderView,
  context: NotebookReadingContext,
) {
  if (!NotebookRouteStateSchema.safeParse(context.returnTo).success)
    return false;
  const expectedReturn = notebookReadingContext(
    view,
    context.returnTo.kind === "assignment" && context.returnTo.tab === "study",
  ).returnTo;
  return (
    sameRecord(view.assignment, context.assignment) &&
    sameRecord(view.reading.content_ref, context.contentRef) &&
    sameRecord(view.session, context.session) &&
    view.selectedPassageId === context.passageId &&
    view.reading.sections.some((section) => section.id === context.passageId) &&
    notebookHref(expectedReturn) === notebookHref(context.returnTo)
  );
}

export function readingPresentation({
  state,
  context,
}: Pick<NotebookReadingProps, "state" | "context">) {
  const view =
    state.status === "ready" || state.status === "pending" ? state.data : null;
  const resolved =
    context.status === "ready" || context.status === "pending"
      ? context.data
      : null;
  if (state.status === "unavailable" || state.status === "empty")
    return { status: state.status, message: state.message } as const;
  if (context.status === "unavailable" || context.status === "empty")
    return { status: context.status, message: context.message } as const;
  if (!view || !resolved)
    return {
      status:
        state.status === "pending" || context.status === "pending"
          ? "pending"
          : "loading",
      message:
        state.status === "pending"
          ? state.message
          : context.status === "pending"
            ? context.message
            : "Loading the approved reading…",
    } as const;
  if (!matchesReadingContext(view, resolved))
    return {
      status: "unavailable",
      message:
        "This reading does not match the selected assignment, session or source version. Open the original reading link again.",
    } as const;
  return {
    status: "resolved",
    view,
    context: resolved,
    pending: state.status === "pending" || context.status === "pending",
    message:
      state.status === "pending"
        ? state.message
        : context.status === "pending"
          ? context.message
          : null,
  } as const;
}

/** No fallback to another passage/version. These are existing visible-route links. */
export function notebookPassageHref(
  view: StudentReaderView,
  context: NotebookReadingContext,
  passageId: string,
  citationId?: string,
) {
  if (
    !matchesReadingContext(view, context) ||
    !view.reading.sections.some((section) => section.id === passageId)
  )
    return null;
  const route = NotebookRouteStateSchema.safeParse({
    kind: "reading",
    location: {
      assignmentId: context.assignment.id,
      contentVersion: context.contentRef.content_version,
      passageId,
      ...(context.session ? { sessionId: context.session.id } : {}),
    },
    ...(context.returnTo.kind === "assignment" &&
    context.returnTo.tab === "study"
      ? { fromStudy: true }
      : {}),
    ...(citationId ? { citationId } : {}),
  });
  return route.success ? notebookHref(route.data) : null;
}
