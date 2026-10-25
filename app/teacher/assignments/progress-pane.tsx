"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  progressRestorationTarget,
  type ProgressPane,
  type ProgressView,
} from "./progress-model.ts";

/** Only pane navigation is client-side; authorized evidence stays server-rendered. */
export function ProgressPanes({
  pane,
  progressView,
  selectedStudent,
  selectedConcept,
  selectionKey,
  returnFocusId,
  closeHref,
  openHref,
  main,
  details,
}: {
  pane: ProgressPane;
  progressView: ProgressView;
  selectedStudent?: string;
  selectedConcept?: string;
  selectionKey: string;
  returnFocusId: string;
  closeHref: string;
  openHref: string;
  main: ReactNode;
  details: ReactNode;
}) {
  const router = useRouter();
  const detailsRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const previousPane = useRef(pane);
  useEffect(() => {
    let frame = 0;
    function restoreFocus() {
      const targetId = progressRestorationTarget(window.location.hash, {
        pane,
        progressView,
        student: selectedStudent,
        concept: selectedConcept,
      });
      if (targetId) {
        const target = document.getElementById(targetId) ?? mainRef.current;
        target?.focus({ preventScroll: true });
        const hashless =
          window.location.hash === "" || window.location.hash === "#";
        if (targetId !== "progress-main" || !hashless)
          target?.scrollIntoView({ block: "nearest", inline: "nearest" });
      } else if (
        pane === "details" &&
        window.matchMedia("(max-width: 1240px)").matches
      ) {
        detailsRef.current?.focus({ preventScroll: true });
      } else if (pane === "grid" && previousPane.current === "details") {
        (document.getElementById(returnFocusId) ?? mainRef.current)?.focus({
          preventScroll: true,
        });
      }
      previousPane.current = pane;
    }
    function scheduleRestoration() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(restoreFocus);
    }
    scheduleRestoration();
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
    window.addEventListener("hashchange", scheduleRestoration);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("hashchange", scheduleRestoration);
    };
  }, [
    pane,
    progressView,
    selectedStudent,
    selectedConcept,
    selectionKey,
    returnFocusId,
    closeHref,
    router,
  ]);
  return (
    <div
      className="ap-workbench"
      data-pane={pane}
      data-workspace-restoration="page"
    >
      <section
        id="progress-main"
        ref={mainRef}
        tabIndex={-1}
        className="ap-main"
        aria-label="Class progress views"
      >
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
