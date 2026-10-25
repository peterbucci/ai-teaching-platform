"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { flushSync } from "react-dom";
import type { StudentReaderView } from "../../../../lib/reading/model.ts";
import { Workspace } from "../../../components/workspace.tsx";
import { StudentReader } from "../../reading/reader.tsx";
import { readingHref } from "../../reading/presentation.ts";
import { notebookReadingContext } from "../adapters.ts";
import { NotebookReading } from "../reading/index.ts";

/** Standalone route only. Facing-pane composition remains disabled. */
export function StandaloneNotebookReading({
  view,
  citation,
  returnToSession,
}: {
  view: StudentReaderView;
  citation?: { id: string; passageId: string };
  returnToSession: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const refresh = useRef<() => void>(() => {});
  const resumeFrame = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  const [visibleHeight, setVisibleHeight] = useState<number | undefined>();

  useEffect(() => {
    const container = host.current;
    const reader = surface.current;
    if (!container || !reader) return;
    const update = () => {
      const rect = reader.getBoundingClientRect();
      // StudentReader hides its DOM while inactive. Measure the independently
      // rendered N4 pane and retain its exposed height to prevent scroll loss
      // or a hidden-child/zero-height activation deadlock.
      const body = reader.querySelector<HTMLElement>(".lp-s-reader-refined");
      if (body && !body.hidden && rect.height > 0)
        setVisibleHeight(rect.height);
      const covered = container.querySelector(
        "dialog[open], details.lp-account-menu[open]",
      );
      setActive(
        !covered &&
          reader.isConnected &&
          reader.checkVisibility({
            checkOpacity: true,
            checkVisibilityCSS: true,
          }) &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.right > 0 &&
          rect.top < window.innerHeight &&
          rect.left < window.innerWidth,
      );
    };
    refresh.current = update;
    const changes = new MutationObserver(update);
    changes.observe(container, {
      subtree: true,
      attributes: true,
      attributeFilter: ["open", "hidden", "style", "class", "inert"],
    });
    const intersection = new IntersectionObserver(update);
    intersection.observe(reader);
    const resize = new ResizeObserver(update);
    resize.observe(reader);
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    document.addEventListener("visibilitychange", update);
    const initialFrame = requestAnimationFrame(update);
    return () => {
      refresh.current = () => {};
      cancelAnimationFrame(initialFrame);
      if (resumeFrame.current !== null)
        cancelAnimationFrame(resumeFrame.current);
      changes.disconnect();
      intersection.disconnect();
      resize.disconnect();
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  function beforeOverlay(event: SyntheticEvent) {
    if (!(event.target instanceof Element)) return;
    const drawer = event.target.closest(
      'button[aria-controls="workspace-navigation"]',
    );
    const account = event.target.closest("details.lp-account-menu > summary");
    if (!drawer && !account) return;
    // Commit the reader's active=false before Workspace.showModal or the
    // native details toggle. Mouse and keyboard activation use this same seam.
    const height = surface.current?.getBoundingClientRect().height;
    flushSync(() => {
      if (height && height > 0) setVisibleHeight(height);
      setActive(false);
    });
    if (resumeFrame.current !== null) cancelAnimationFrame(resumeFrame.current);
    resumeFrame.current = requestAnimationFrame(() => {
      resumeFrame.current = null;
      refresh.current();
    });
  }

  return (
    <div
      ref={host}
      data-n7-standalone-reader
      data-reader-active={active}
      onClickCapture={beforeOverlay}
      onKeyDownCapture={(event) => {
        if (event.key === "Enter" || event.key === " ") beforeOverlay(event);
      }}
    >
      <Workspace
        area="student"
        section="Reading"
        readingHref={readingHref({
          assignmentId: view.assignment.id,
          contentVersion: view.reading.content_ref.content_version,
          passageId: view.selectedPassageId,
          sessionId: view.session?.id,
        })}
      >
        <div
          ref={surface}
          data-n7-reader-surface
          style={{ minHeight: active ? undefined : visibleHeight }}
        >
          <NotebookReading
            state={{ status: "ready", data: view }}
            context={{
              status: "ready",
              data: notebookReadingContext(view, returnToSession),
            }}
            reader={
              <StudentReader
                active={active}
                view={view}
                returnToSession={returnToSession}
                citation={citation}
              />
            }
          />
        </div>
      </Workspace>
    </div>
  );
}
