"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import {
  TeacherWorkspacePanes,
  type TeacherWorkspacePanesProps,
} from "../workspace-panes.tsx";
import {
  evidenceHashPane,
  evidencePaneHref,
  isNewEvidenceHashNavigation,
} from "./results-navigation.ts";

type EvidenceLocation = {
  href: string;
  previousHref: string;
  kind: "initial" | "link" | "hash" | "history";
  revision: number;
};
const initialLocation: EvidenceLocation = {
  href: "",
  previousHref: "",
  kind: "initial",
  revision: 0,
};
let observedLocation = initialLocation;
let lastPop: { href: string; hadState: boolean } | undefined;
const subscribers = new Set<() => void>();
let observing = false;

function snapshot(): EvidenceLocation {
  if (observedLocation.href !== window.location.href)
    observedLocation = {
      href: window.location.href,
      previousHref: observedLocation.href,
      kind: observedLocation.href ? "link" : "initial",
      revision: observedLocation.revision,
    };
  return observedLocation;
}

function subscribe(notify: () => void) {
  if (!observing) {
    // Observe traversal before Next commits the arriving document. The existing
    // results manager can then distinguish Back from a fresh link to a hash.
    window.addEventListener(
      "popstate",
      (event) => {
        lastPop = {
          href: window.location.href,
          hadState: event.state !== null,
        };
        // A native anchor/location.hash write emits popstate as well as
        // hashchange. Its new null-state entry is not a Back/Forward traversal.
        // A preceding subscriber may already have sampled the arriving URL.
        const previousHref =
          observedLocation.href === window.location.href
            ? observedLocation.previousHref
            : observedLocation.href;
        observedLocation = {
          href: window.location.href,
          previousHref,
          kind: isNewEvidenceHashNavigation(
            previousHref,
            window.location.href,
            event.state,
          )
            ? "hash"
            : "history",
          revision: observedLocation.revision + 1,
        };
        subscribers.forEach((subscriber) => subscriber());
      },
      true,
    );
    window.addEventListener("hashchange", (event) => {
      // Pane normalization may already have replaced the URL. Do not apply an
      // older fragment event to that newer presentation state.
      if (event.newURL !== window.location.href) return;
      const traversed = lastPop?.href === event.newURL && lastPop.hadState;
      const freshHash = isNewEvidenceHashNavigation(
        event.oldURL,
        event.newURL,
        traversed ? true : null,
      );
      // Read the immutable event URLs: another pop subscriber may have sampled
      // the arriving URL and stamped router/shell state before hashchange.
      if (freshHash || traversed || observedLocation.href !== event.newURL) {
        observedLocation = {
          href: event.newURL,
          previousHref: event.oldURL,
          kind: traversed ? "history" : "hash",
          revision: observedLocation.revision + 1,
        };
        subscribers.forEach((subscriber) => subscriber());
      }
      lastPop = undefined;
    });
    observing = true;
  }
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
  };
}

const serverSnapshot = () => initialLocation;

export function useEvidenceLocation() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

export function isEvidenceHistoryTraversal() {
  return (
    observedLocation.kind === "history" &&
    observedLocation.href === window.location.href
  );
}

export function evidenceLocationRevision() {
  return observedLocation.revision;
}

/** The shell owns responsive panes and drawers; Evidence supplies hash intent. */
export function EvidenceWorkspace(props: TeacherWorkspacePanesProps) {
  const location = useEvidenceLocation();
  const url = location.href ? new URL(location.href) : null;
  const hashPane = url ? evidenceHashPane(url.hash) : null;
  useLayoutEffect(() => {
    if (location.kind !== "hash" || !hashPane) return;
    const current = new URL(window.location.href);
    if (current.searchParams.get("workspacePane") !== hashPane)
      window.history.replaceState(
        null,
        "",
        evidencePaneHref(current.href, hashPane, current.hash),
      );
  }, [hashPane, location]);
  return (
    <TeacherWorkspacePanes
      {...props}
      initialPane={hashPane ?? props.initialPane}
    />
  );
}
