"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ProgressPane } from "./progress-model.ts";

/** Only pane navigation is client-side; authorized evidence stays server-rendered. */
export function ProgressPanes({
  pane,
  selectionKey,
  returnFocusId,
  closeHref,
  openHref,
  main,
  details,
}: {
  pane: ProgressPane;
  selectionKey: string;
  returnFocusId: string;
  closeHref: string;
  openHref: string;
  main: ReactNode;
  details: ReactNode;
}) {
  const router = useRouter();
  const detailsRef = useRef<HTMLElement>(null);
  const previousPane = useRef(pane);
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 1240px)").matches;
    if (pane === "details" && narrow)
      detailsRef.current?.focus({ preventScroll: true });
    if (pane === "grid" && previousPane.current === "details")
      (
        document.getElementById(returnFocusId) ??
        document.getElementById("ap-open-details")
      )?.focus({ preventScroll: true });
    previousPane.current = pane;
    function escape(event: KeyboardEvent) {
      if (
        event.key === "Escape" &&
        pane === "details" &&
        window.matchMedia("(max-width: 1240px)").matches
      ) {
        event.preventDefault();
        router.push(closeHref, { scroll: false });
      }
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [pane, selectionKey, returnFocusId, closeHref, router]);
  return (
    <div className="ap-workbench" data-pane={pane}>
      <section className="ap-main" aria-label="Class progress views">
        <div className="ap-mobile-bar">
          <span>Select a cell or column to inspect its evidence</span>
          <Link id="ap-open-details" href={openHref} scroll={false}>
            Details
          </Link>
        </div>
        {main}
      </section>
      <aside
        id="cell-evidence"
        ref={detailsRef}
        tabIndex={-1}
        className="ap-details"
        aria-label="Details"
      >
        <header className="ap-details-header">
          <h2>Details</h2>
          <Link className="ap-close-details" href={closeHref} scroll={false}>
            Close
          </Link>
        </header>
        {details}
      </aside>
    </div>
  );
}
