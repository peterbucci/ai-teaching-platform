"use client";

import type { ReactNode } from "react";

/** Focus the chosen section after N1 closes its mobile page rail. Native anchor
 * navigation remains the fallback. This never invokes an activity action. */
export function ReviewSectionLink({
  target,
  children,
}: {
  target: "review-activity" | "fresh-check-response-title";
  children: ReactNode;
}) {
  return (
    <a
      href={`#${target}`}
      onClick={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (location.hash !== `#${target}`) return;
            const section = document.getElementById(target);
            if (!section?.isConnected) return;
            section.tabIndex = -1;
            section.focus({ preventScroll: true });
            section.scrollIntoView({ block: "start" });
          }),
        );
      }}
    >
      {children}
    </a>
  );
}
