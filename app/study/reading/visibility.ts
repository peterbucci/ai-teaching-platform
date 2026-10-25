/** The owner decides whether its pane is active; the browser can only narrow it. */
export function readingIsActive(
  active: boolean,
  visibilityState: string,
  focused: boolean,
) {
  return active && visibilityState === "visible" && focused;
}

/**
 * Two animation frames leave a rendering opportunity between the checks. A DOM
 * commit or a single pre-paint callback is not evidence of presentation. This
 * confirms a visible presentation opportunity, not that the student read it.
 */
export function scheduleReadingPresentation({
  isVisible,
  requestFrame,
  cancelFrame,
  onPresented,
}: {
  isVisible: () => boolean;
  requestFrame: (callback: () => void) => number;
  cancelFrame: (id: number) => void;
  onPresented: () => void;
}) {
  let stopped = false;
  let frame: number | undefined;
  if (isVisible()) {
    frame = requestFrame(() => {
      if (stopped || !isVisible()) return;
      frame = requestFrame(() => {
        if (!stopped && isVisible()) onPresented();
      });
    });
  }
  return () => {
    stopped = true;
    if (frame !== undefined) cancelFrame(frame);
  };
}
