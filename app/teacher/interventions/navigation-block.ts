/** Capture guards run before a drawer link's close handler. Dismiss its modal
 * before revealing page feedback, otherwise the feedback remains inert. */
export function blockInterventionNavigation(
  event: Pick<Event, "preventDefault" | "stopPropagation">,
  dialog: Pick<HTMLDialogElement, "open" | "close"> | null,
  revealFeedback: () => void,
) {
  event.preventDefault();
  event.stopPropagation();
  if (dialog?.open) dialog.close();
  revealFeedback();
}
