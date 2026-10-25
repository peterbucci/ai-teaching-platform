"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type FocusTarget = { id?: string; key?: string; href?: string };
type Position = {
  x: number;
  y: number;
  focus?: FocusTarget;
  panes: { x: number; y: number }[];
};
// Survives page-owned shell remounts, but contains no answers or draft text.
const positions = new Map<string, Position>();
let previousLocation = "";
let returningTo = "";
let observingHistory = false;

function locationKey() {
  return `${window.location.pathname}?${new URLSearchParams(window.location.search)}`;
}

function observeHistory() {
  if (observingHistory) return;
  // Keep one observer across page-shell remounts. A page-local listener can be
  // removed by the router before its popstate callback is reached.
  window.addEventListener(
    "popstate",
    () => {
      const destination = locationKey();
      if (destination !== previousLocation) returningTo = destination;
    },
    true,
  );
  observingHistory = true;
}

function contentControl(element: Element | null): element is HTMLElement {
  return (
    element instanceof HTMLElement &&
    Boolean(element.closest("#main-content")) &&
    !element.closest(".tw-panes-switcher, .tw-panes-context-trigger")
  );
}

function focusTarget(element: HTMLElement): FocusTarget | undefined {
  if (element.id) return { id: element.id };
  if (element.dataset.workspaceFocus)
    return { key: element.dataset.workspaceFocus };
  if (element instanceof HTMLAnchorElement) {
    const href = element.getAttribute("href");
    if (href) return { href };
  }
}

function findFocus(target: FocusTarget | undefined) {
  if (!target) return;
  const element = target.id
    ? document.getElementById(target.id)
    : target.key
      ? document.querySelector<HTMLElement>(
          `#main-content [data-workspace-focus="${CSS.escape(target.key)}"]`,
        )
      : [
          ...document.querySelectorAll<HTMLAnchorElement>(
            "#main-content a[href]",
          ),
        ].find((link) => link.getAttribute("href") === target.href);
  return contentControl(element ?? null) && element?.getClientRects().length
    ? element
    : undefined;
}

function scrollPanes() {
  return [
    ...document.querySelectorAll<HTMLElement>(
      "#main-content :is([data-workspace-scroll], .tw-panes-body, .wb-response-list)",
    ),
  ];
}

export function WorkspaceNavigationRestoration({ label }: { label: string }) {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const [announcement, announce] = useState("");

  useEffect(() => {
    observeHistory();
    const key = `${pathname}?${query}`;
    const saved = positions.get(key);
    const changed = Boolean(previousLocation && previousLocation !== key);
    let placing = true;

    function save() {
      // Next may update the URL before this page unmounts. Do not overwrite its
      // remembered position with the destination's automatic scroll/focus.
      if (placing || locationKey() !== key) return;
      const active = document.activeElement;
      const remembered = positions.get(key)?.focus;
      positions.set(key, {
        x: window.scrollX,
        y: window.scrollY,
        focus: contentControl(active)
          ? (focusTarget(active) ?? remembered)
          : remembered,
        panes: scrollPanes().map((pane) => ({
          x: pane.scrollLeft,
          y: pane.scrollTop,
        })),
      });
      const oldest = positions.keys().next().value;
      if (positions.size > 50 && oldest) positions.delete(oldest);
    }

    document.addEventListener("click", save, true);
    document.addEventListener("focusin", save);
    document.addEventListener("scroll", save, true);

    const frame = requestAnimationFrame(() => {
      // Next may commit the destination inside its own popstate listener,
      // before our observer runs. Read the history intent after the event ends.
      const restoring = returningTo === key;
      // Exact evidence anchors activate and focus their page-owned target. Do
      // not race that behavior with a remembered heading or scroll position.
      if (!window.location.hash) {
        if (restoring && saved) {
          findFocus(saved.focus)?.focus({ preventScroll: true });
          scrollPanes().forEach((pane, index) => {
            const position = saved.panes[index];
            if (position) {
              pane.scrollLeft = position.x;
              pane.scrollTop = position.y;
            }
          });
          window.scrollTo(saved.x, saved.y);
        } else if (changed) {
          const active = document.activeElement;
          const lost =
            !active ||
            active === document.body ||
            (active instanceof HTMLElement && !active.getClientRects().length);
          const heading =
            document.querySelector<HTMLElement>("#main-content h1");
          if (lost && heading) {
            heading.tabIndex = -1;
            heading.focus({ preventScroll: true });
          }
        }
      }
      // Consume navigation only after placement ran. A cancelled effect (for
      // example React Strict Mode's mount check) must not swallow restoration.
      previousLocation = key;
      returningTo = "";
      placing = false;
      announce(`${label} workspace`);
    });

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("click", save, true);
      document.removeEventListener("focusin", save);
      document.removeEventListener("scroll", save, true);
    };
  }, [pathname, query, label]);

  return (
    <span className="tw-sr-only" role="status" aria-live="polite">
      {announcement}
    </span>
  );
}
