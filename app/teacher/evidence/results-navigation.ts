import type { TeacherWorkspaceContext } from "../../../lib/teacher/workspace-contracts.ts";

const memoryKey = "learningPulseEvidenceList";

export function evidenceResponseAnchor(attemptId?: string) {
  return attemptId ? `evidence-response-${attemptId}` : "evidence-results";
}

/** Selection identities do not change the list; filters do. */
export function evidenceResultsScope(
  context: Partial<TeacherWorkspaceContext>,
) {
  return JSON.stringify([
    context.assignment ?? "",
    context.origin ?? "all",
    context.concept ?? "",
    context.q ?? "",
    context.student ?? "",
  ]);
}

/** Checkbox changes stay in the same navigation entry and must not move focus. */
export function evidenceResultsNavigationKey(query: string) {
  const params = new URLSearchParams(query);
  params.delete("seedAttempt");
  params.sort();
  return params.toString();
}

/** Do not turn a checkbox update into navigation by adding resolved defaults. */
export function evidenceSeedSelectionHref(
  currentHref: string,
  attemptIds: readonly string[],
) {
  const url = new URL(currentHref);
  url.searchParams.delete("seedAttempt");
  for (const id of attemptIds) url.searchParams.append("seedAttempt", id);
  return `${url.pathname}${url.search}${url.hash}`;
}

export type EvidenceResultsMemory = {
  scope: string;
  attemptId?: string;
  scrollTop: number;
  focusRow: boolean;
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Local UI memory never supplies evidence identities to an application service. */
export function readEvidenceResultsMemory(
  state: unknown,
  scope: string,
  attemptIds: readonly string[],
): EvidenceResultsMemory | null {
  const saved = record(record(state)[memoryKey]);
  if (
    saved.scope !== scope ||
    typeof saved.scrollTop !== "number" ||
    !Number.isFinite(saved.scrollTop) ||
    saved.scrollTop < 0
  )
    return null;
  // A removed/filtered response must not redirect focus to another list.
  if (
    saved.attemptId !== undefined &&
    (typeof saved.attemptId !== "string" ||
      !attemptIds.includes(saved.attemptId))
  )
    return null;
  return {
    scope,
    scrollTop: saved.scrollTop,
    focusRow: saved.focusRow === true,
    ...(typeof saved.attemptId === "string"
      ? { attemptId: saved.attemptId }
      : {}),
  };
}

export function withEvidenceResultsMemory(
  state: unknown,
  memory: EvidenceResultsMemory,
): Record<string, unknown> {
  // Preserve Next's own history fields; this write does not change the URL.
  return { ...record(state), [memoryKey]: memory };
}

export function evidenceResultsTarget(
  hash: string,
  attemptIds: readonly string[],
  selectedAttempt?: string,
  memory?: EvidenceResultsMemory | null,
): string | null {
  let anchor: string;
  try {
    anchor = decodeURIComponent(hash.replace(/^#/, ""));
  } catch {
    return null;
  }
  if (anchor === "response-detail-title") return anchor;
  if (anchor === "evidence-results") {
    const attempt = memory?.attemptId ?? selectedAttempt;
    return evidenceResponseAnchor(
      attempt && attemptIds.includes(attempt) ? attempt : undefined,
    );
  }
  if (anchor)
    return attemptIds.some((id) => evidenceResponseAnchor(id) === anchor)
      ? anchor
      : null;
  return memory?.focusRow && memory.attemptId
    ? evidenceResponseAnchor(memory.attemptId)
    : null;
}

/** Keep a long response visible without resetting an already useful position. */
export function responseVisibleScrollTop({
  scrollTop,
  viewportHeight,
  scrollHeight,
  rowTop,
  rowHeight,
}: {
  scrollTop: number;
  viewportHeight: number;
  scrollHeight: number;
  rowTop: number;
  rowHeight: number;
}) {
  const bottom = rowTop + Math.min(rowHeight, viewportHeight);
  const next =
    rowTop < scrollTop
      ? rowTop
      : bottom > scrollTop + viewportHeight
        ? bottom - viewportHeight
        : scrollTop;
  return Math.max(
    0,
    Math.min(next, Math.max(0, scrollHeight - viewportHeight)),
  );
}

export function focusEvidenceResultsTarget(
  target: Pick<HTMLElement, "focus" | "scrollIntoView">,
) {
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "nearest" });
}
