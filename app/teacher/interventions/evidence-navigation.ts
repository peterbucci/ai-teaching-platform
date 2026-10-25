/** Only anchors backed by this rendered evidence snapshot may select its pane. */
export function interventionAnchorTarget(hash: string, attemptIds: string[]) {
  let id: string;
  try {
    id = decodeURIComponent(hash.replace(/^#/, ""));
  } catch {
    return null;
  }
  if (id === "intervention-evidence-title" || id === "intervention-draft-title")
    return id;
  return attemptIds.some((attempt) => id === `evidence-${attempt}`) ? id : null;
}

/** Called after React reveals the pane, so focus never points into hidden work. */
export function focusInterventionAnchor(
  target: Pick<HTMLElement, "focus" | "scrollIntoView">,
  details?: Pick<HTMLDetailsElement, "open"> | null,
) {
  if (details) details.open = true;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "start" });
}
