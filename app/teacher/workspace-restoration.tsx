"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
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
const entryStateKey = "__learningPulseWorkspaceEntry";
let previousLocation = "";
let previousEntry: string | undefined;
let returningTo:
  { location: string; entry?: string; revision: number } | undefined;
let historyRevision = 0;
let observingHistory = false;
const historySubscribers = new Set<() => void>();

function locationKey() {
  return `${window.location.pathname}?${new URLSearchParams(window.location.search)}`;
}

function historyFields(): Record<string, unknown> | undefined {
  const state: unknown = window.history.state;
  if (state === null) return {};
  if (typeof state === "object" && !Array.isArray(state))
    return state as Record<string, unknown>;
}

function entryToken(): string | undefined {
  const value = historyFields()?.[entryStateKey];
  return typeof value === "string" && /^[0-9a-f]{32}$/.test(value)
    ? value
    : undefined;
}

function ensureEntryToken(): string | undefined {
  const existing = entryToken();
  if (existing) return existing;
  const state = historyFields();
  if (!state) return;
  const token = Array.from(
    window.crypto.getRandomValues(new Uint8Array(16)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  try {
    // Only an opaque identity enters history. Keep router and page-owned fields;
    // all positions remain in the bounded in-memory map and disappear on reload.
    window.history.replaceState({ ...state, [entryStateKey]: token }, "");
    return entryToken() === token ? token : undefined;
  } catch (error) {
    // A browser may rate-limit history writes. This entry then uses native
    // behavior rather than a potentially wrong URL-keyed position.
    if (!(error instanceof DOMException && error.name === "SecurityError"))
      throw error;
  }
}

function subscribeHistory(notify: () => void) {
  if (!observingHistory) {
    // Survive shell remounts and observe same-URL entries as well as route changes.
    window.addEventListener(
      "popstate",
      () => {
        historyRevision += 1;
        returningTo = {
          location: locationKey(),
          entry: entryToken(),
          revision: historyRevision,
        };
        for (const subscriber of historySubscribers) subscriber();
      },
      true,
    );
    observingHistory = true;
  }
  historySubscribers.add(notify);
  return () => {
    historySubscribers.delete(notify);
  };
}
const historySnapshot = () => historyRevision;
const serverHistorySnapshot = () => 0;

function contentControl(element: Element | null): element is HTMLElement {
  return (
    element instanceof HTMLElement &&
    Boolean(element.closest("#main-content")) &&
    !element.closest(".tw-panes-switcher, .tw-panes-context-trigger")
  );
}

// A page with its own history/anchor placement owns its subtree. The Evidence
// selectors support the existing page without taking over its private memory.
function pageManagedControl(element: Element | null): boolean {
  return (
    element instanceof HTMLElement &&
    Boolean(
      element.closest(
        '[data-workspace-restoration="page"], .wb-evidence-results, .wb-response-list',
      ),
    )
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
  return contentControl(element ?? null) &&
    !pageManagedControl(element ?? null) &&
    element?.getClientRects().length
    ? element
    : undefined;
}

function scrollPanes() {
  return [
    ...document.querySelectorAll<HTMLElement>(
      "#main-content :is([data-workspace-scroll], .tw-panes-body)",
    ),
  ].filter((pane) => !pageManagedControl(pane));
}

export function WorkspaceNavigationRestoration({
  label,
  pending = false,
}: {
  label: string;
  pending?: boolean;
}) {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const revision = useSyncExternalStore(
    subscribeHistory,
    historySnapshot,
    serverHistorySnapshot,
  );
  const [announcement, announce] = useState("");

  useEffect(() => {
    const key = `${pathname}?${query}`;
    // A pop observer can notify before Next updates its hook values.
    if (locationKey() !== key || pending) return;
    let entry = ensureEntryToken();
    let metadataWritable = Boolean(entry);
    const saved = entry ? positions.get(entry) : undefined;
    const changed = Boolean(
      previousLocation && (previousLocation !== key || previousEntry !== entry),
    );
    let placing = true;
    let cancelled = false;
    let renewalQueued = false;

    function canSave() {
      return (
        !cancelled &&
        !placing &&
        metadataWritable &&
        locationKey() === key &&
        historyRevision === revision &&
        !returningTo
      );
    }

    function savePosition() {
      if (!canSave() || !entry || entryToken() !== entry) return;
      const active = document.activeElement;
      const remembered = positions.get(entry)?.focus;
      positions.set(entry, {
        x: window.scrollX,
        y: window.scrollY,
        focus: contentControl(active)
          ? pageManagedControl(active)
            ? undefined
            : focusTarget(active)
          : remembered,
        panes: scrollPanes().map((pane) => ({
          x: pane.scrollLeft,
          y: pane.scrollTop,
        })),
      });
      const oldest = positions.keys().next().value;
      if (positions.size > 50 && oldest) positions.delete(oldest);
    }

    function save(event: Event) {
      // Never write the old document's position into an arriving history entry,
      // even when its URL is identical. The page may still be unmounting.
      if (!canSave()) return;
      const current = entryToken();
      if (current === entry) {
        savePosition();
      } else if (!current && event.type === "click") {
        // Capture runs before Link can leave this stable URL. Stamp now so a
        // same-URL metadata reset followed immediately by leaving is remembered.
        entry = ensureEntryToken();
        metadataWritable = Boolean(entry);
        savePosition();
      } else if (!current && !renewalQueued) {
        // A same-URL Next navigation can clear custom metadata without changing
        // pathname/search hooks. After event dispatch settles, mint a NEW token;
        // never reuse the old token or adopt an existing destination's token.
        renewalQueued = true;
        queueMicrotask(() => {
          renewalQueued = false;
          if (!canSave() || entryToken()) return;
          entry = ensureEntryToken();
          metadataWritable = Boolean(entry);
          savePosition();
        });
      }
    }

    document.addEventListener("click", save, true);
    document.addEventListener("focusin", save);
    document.addEventListener("scroll", save, true);

    let frame = 0;
    let readinessObserver: MutationObserver | undefined;
    function placeWhenReady() {
      // A router can commit during popstate before our observer is reached.
      // Recheck live identity and sample intent only after dispatch completes.
      if (
        cancelled ||
        locationKey() !== key ||
        entryToken() !== entry ||
        historyRevision !== revision
      )
        return;
      // A streamed fallback can mount this shell before the destination body.
      // Keep the history intent and saved position until that body is present;
      // otherwise a short fallback clamps the scroll and consumes the return.
      const main = document.getElementById("main-content");
      if (
        main?.matches('[data-workspace-pending="true"]') ||
        main?.querySelector('[data-workspace-pending="true"]')
      ) {
        if (!readinessObserver && main) {
          readinessObserver = new MutationObserver(() => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(placeWhenReady);
          });
          readinessObserver.observe(main, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["data-workspace-pending"],
          });
        }
        return;
      }
      readinessObserver?.disconnect();
      readinessObserver = undefined;
      const restoring =
        returningTo?.location === key &&
        returningTo.entry === entry &&
        returningTo.revision === revision;
      const active = document.activeElement;
      const pagePlacedFocus =
        active instanceof HTMLElement &&
        pageManagedControl(active) &&
        active.isConnected &&
        active.getClientRects().length > 0;
      // Exact anchors and already placed page-owned focus own all placement,
      // including ancestor scroll changed by the page's scrollIntoView call.
      if (!window.location.hash && !pagePlacedFocus) {
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
          const lost =
            !active ||
            active === document.body ||
            (active instanceof HTMLElement && !active.getClientRects().length);
          const heading =
            document.querySelector<HTMLElement>("#main-content h1");
          if (lost && heading && !pageManagedControl(heading)) {
            heading.tabIndex = -1;
            heading.focus({ preventScroll: true });
          }
        }
      }
      previousLocation = key;
      previousEntry = entry;
      if (returningTo?.revision === revision) returningTo = undefined;
      placing = false;
      announce(`${label} workspace`);
    }
    frame = requestAnimationFrame(placeWhenReady);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      readinessObserver?.disconnect();
      document.removeEventListener("click", save, true);
      document.removeEventListener("focusin", save);
      document.removeEventListener("scroll", save, true);
    };
  }, [pathname, query, label, revision, pending]);

  return (
    <span className="tw-sr-only" role="status" aria-live="polite">
      {announcement}
    </span>
  );
}
