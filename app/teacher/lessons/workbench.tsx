"use client";

import Link from "next/link";
import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import "./authoring.css";

type Pane = "outline" | "editor" | "reading";
const panes: Pane[] = ["outline", "editor", "reading"];
type Viewport = "wide" | "tablet" | "phone";
function viewportSnapshot(): Viewport {
  if (window.matchMedia("(max-width: 800px)").matches) return "phone";
  return window.matchMedia("(max-width: 1240px)").matches ? "tablet" : "wide";
}
function subscribeViewport(notify: () => void) {
  const queries = [
    window.matchMedia("(max-width: 800px)"),
    window.matchMedia("(max-width: 1240px)"),
  ];
  queries.forEach((query) => query.addEventListener("change", notify));
  return () =>
    queries.forEach((query) => query.removeEventListener("change", notify));
}
const serverViewport = (): Viewport => "wide";

/** All panes stay mounted: changing context must not discard unsaved inputs. */
export function AuthoringWorkspace({
  outline,
  reading,
  children,
  defaultPane = "editor",
  label = "Lesson authoring",
  readingTitle = "Reading",
  readingMeta,
}: {
  outline: ReactNode;
  reading: ReactNode;
  children: ReactNode;
  defaultPane?: Pane;
  label?: string;
  readingTitle?: string;
  readingMeta?: string;
}) {
  const [pane, setPane] = useState<Pane>(defaultPane);
  const subscribe = useCallback(
    (notify: () => void) =>
      subscribeViewport(() => {
        // Resizing must not open a modal over a visible editor/outside control.
        if (viewportSnapshot() === "tablet" && pane === "reading") {
          const focusedPane =
            document.activeElement instanceof HTMLElement
              ? document.activeElement.closest<HTMLElement>("[data-pane]")
              : null;
          if (focusedPane?.dataset.pane !== "reading")
            setPane(
              focusedPane?.dataset.pane === "outline" ? "outline" : "editor",
            );
        }
        notify();
      }),
    [pane],
  );
  const viewport = useSyncExternalStore(
    subscribe,
    viewportSnapshot,
    serverViewport,
  );
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const readingDialog = useRef<HTMLDialogElement>(null);
  const readingModal = useRef(false);
  const lastViewport = useRef(viewport);
  const lastFocusedControl = useRef<HTMLElement | null>(null);
  const readingOpener = useRef<HTMLElement | null>(null);
  const readingReturnPane = useRef<Pane>("editor");

  useLayoutEffect(() => {
    const dialog = readingDialog.current;
    if (!dialog) return;
    const changedViewport = lastViewport.current !== viewport;
    const active =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focused =
      active === document.body ? lastFocusedControl.current : active;
    const focusInWorkspace = Boolean(
      focused && root.current?.contains(focused),
    );
    const shouldModal = viewport === "tablet" && pane === "reading";
    const shouldInline =
      viewport === "wide" || (viewport === "phone" && pane === "reading");
    let changedDialogMode = false;
    if (readingModal.current && !shouldModal) {
      readingModal.current = false;
      dialog.close();
      changedDialogMode = true;
    }
    if (shouldModal && !readingModal.current) {
      const canvasTop = Math.max(
        0,
        root.current?.getBoundingClientRect().top ?? 0,
      );
      dialog.style.setProperty("--aw-reading-top", `${canvasTop}px`);
      if (dialog.open) dialog.removeAttribute("open");
      readingModal.current = true;
      dialog.showModal();
      changedDialogMode = true;
    } else if (!shouldModal) {
      // Unlike show(), an inline open attribute does not move editor focus.
      if (shouldInline) dialog.setAttribute("open", "");
      else dialog.removeAttribute("open");
    }
    if (changedViewport && focusInWorkspace && focused) {
      if (!focused.getClientRects().length) {
        root.current
          ?.querySelector<HTMLElement>(`[data-pane="${pane}"]`)
          ?.focus({ preventScroll: true });
      } else if (changedDialogMode && document.activeElement !== focused) {
        // Native modal close restores its opener; preserve a still-visible
        // reading control when the same mounted pane becomes inline instead.
        focused.focus({ preventScroll: true });
      }
    }
    lastViewport.current = viewport;
  }, [pane, viewport]);
  function openPane(next: Pane, focus = true) {
    if (next === "reading" && pane !== "reading") {
      readingReturnPane.current = pane;
      readingOpener.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    }
    setPane(next);
    if (focus)
      requestAnimationFrame(() =>
        root.current
          ?.querySelector<HTMLElement>(`[data-pane="${next}"]`)
          ?.focus({ preventScroll: true }),
      );
  }
  function closeReading() {
    setPane(readingReturnPane.current);
    requestAnimationFrame(() => {
      const opener = readingOpener.current;
      if (opener?.isConnected && opener.getClientRects().length)
        opener.focus({ preventScroll: true });
      else
        root.current
          ?.querySelector<HTMLElement>(
            `[data-pane="${readingReturnPane.current}"]`,
          )
          ?.focus({ preventScroll: true });
    });
  }
  return (
    <div
      ref={root}
      className="la-workspace aw-workspace"
      data-active-pane={pane}
      aria-label={label}
      onFocusCapture={(event) => {
        if (event.target instanceof HTMLElement)
          lastFocusedControl.current = event.target;
      }}
      onBlurCapture={(event) => {
        if (
          event.relatedTarget instanceof HTMLElement &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          lastFocusedControl.current = null;
      }}
      onClickCapture={(event) => {
        const target =
          event.target instanceof Element
            ? event.target.closest<HTMLElement>("[data-authoring-open]")
            : null;
        const next = target?.dataset.authoringOpen;
        if (next === "outline" || next === "editor" || next === "reading")
          openPane(next);
        const href = target?.getAttribute("href");
        if (href?.includes("#"))
          requestAnimationFrame(() => {
            const destination = document.getElementById(href.split("#")[1]);
            const disclosure =
              destination instanceof HTMLDetailsElement
                ? destination
                : destination?.closest("details");
            if (disclosure) disclosure.open = true;
            destination?.scrollIntoView({ block: "nearest" });
          });
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && pane === "reading") {
          event.preventDefault();
          closeReading();
        }
      }}
    >
      <nav className="aw-pane-switch" aria-label="Authoring panes">
        {panes.map((item, index) => (
          <button
            key={item}
            type="button"
            aria-controls={`${id}-${item}`}
            aria-pressed={pane === item}
            onClick={() => openPane(item)}
            onKeyDown={(event) => {
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % 3
                  : event.key === "ArrowLeft"
                    ? (index + 2) % 3
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? 2
                        : null;
              if (next !== null) {
                event.preventDefault();
                openPane(panes[next], false);
                event.currentTarget.parentElement
                  ?.querySelectorAll<HTMLButtonElement>("button")
                  [next]?.focus();
              }
            }}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </nav>
      <aside
        id={`${id}-outline`}
        data-pane="outline"
        data-workspace-scroll="lesson-outline"
        className="aw-outline-pane"
        tabIndex={-1}
        aria-label={`${label} outline`}
      >
        {outline}
      </aside>
      <section
        id={`${id}-editor`}
        data-pane="editor"
        data-workspace-scroll="lesson-editor"
        className="aw-editor-pane"
        tabIndex={-1}
        aria-label="Focused editor"
      >
        <div className="aw-editor-toolbar">
          <button
            type="button"
            onClick={() =>
              pane === "reading" ? closeReading() : openPane("reading")
            }
            aria-expanded={pane === "reading"}
            aria-controls={`${id}-reading`}
          >
            Open reading ↗
          </button>
        </div>
        <div className="aw-editor-content">{children}</div>
      </section>
      <dialog
        ref={readingDialog}
        id={`${id}-reading`}
        data-pane="reading"
        data-workspace-scroll="lesson-reading"
        className="aw-reading-pane"
        tabIndex={-1}
        aria-modal={
          viewport === "tablet" && pane === "reading" ? true : undefined
        }
        aria-label="Contextual source reading"
        onCancel={(event) => {
          event.preventDefault();
          closeReading();
        }}
        onClick={(event) => {
          if (viewport !== "tablet" || event.target !== event.currentTarget)
            return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            closeReading();
        }}
      >
        <div className="aw-reading-toolbar">
          <div className="aw-reading-heading">
            <h2>{readingTitle}</h2>
            {readingMeta && <p>{readingMeta}</p>}
          </div>
          <button
            type="button"
            onClick={closeReading}
            aria-label="Close reading and return"
          >
            ×
          </button>
        </div>
        <div className="aw-reading-content">{reading}</div>
      </dialog>
    </div>
  );
}

/** Local content outline only. The shared shell continues to own global navigation. */
export function AuthoringOutline({
  active,
  lessonId,
  title,
  version,
  versions,
  sourceLabel,
  sourceHref,
  objectiveCount,
  questionCount,
  objectiveItems,
  questionItems,
  readiness,
  objectivesHref,
  questionsHref,
  reviewHref,
  sequenceHref,
}: {
  active: "source" | "objectives" | "questions" | "sequence" | "review";
  lessonId?: string;
  title: string;
  version?: string;
  versions?: ReactNode;
  sourceLabel?: string;
  sourceHref?: string;
  objectiveCount?: number;
  questionCount?: number;
  objectiveItems?: ReactNode;
  questionItems?: ReactNode;
  readiness?: ReactNode;
  objectivesHref?: string;
  questionsHref?: string;
  reviewHref?: string;
  sequenceHref?: string;
}) {
  const lesson = lessonId
    ? `/teacher/lessons/${encodeURIComponent(lessonId)}`
    : "/teacher/lessons";
  const item = (key: typeof active, href: string, text: string) => (
    <Link
      className="aw-outline-link"
      href={href}
      aria-current={active === key ? "page" : undefined}
      data-authoring-open="editor"
    >
      {text}
    </Link>
  );
  return (
    <>
      <div className="aw-lesson-identity">
        <Link className="aw-library-link" href="/teacher/lessons">
          ← Lesson library
        </Link>
        <h1>{title}</h1>
        {version && <p className="aw-version">{version}</p>}
        {versions && (
          <details className="aw-version-menu">
            <summary>Lesson versions</summary>
            {versions}
          </details>
        )}
      </div>
      {readiness && (
        <section className="aw-readiness">
          <h2>Ready to publish?</h2>
          {readiness}
        </section>
      )}
      <nav className="aw-outline" aria-label="Lesson sections">
        <section>
          <h2>Reading</h2>
          {item(
            "source",
            sourceHref ?? `${lesson}?step=source`,
            "Source and passages",
          )}
          {sourceLabel && <p className="aw-source-label">{sourceLabel}</p>}
        </section>
        <section>
          <h2>
            Learning objectives
            {objectiveCount !== undefined && <span>{objectiveCount}</span>}
          </h2>
          {item(
            "objectives",
            objectivesHref ??
              `/teacher/objectives/${encodeURIComponent(lessonId ?? "")}`,
            "All objectives & suggestions",
          )}
          {objectiveItems}
        </section>
        <section>
          <h2>
            Question bank
            {questionCount !== undefined && <span>{questionCount}</span>}
          </h2>
          {item(
            "questions",
            questionsHref ?? `${lesson}/questions`,
            "All questions",
          )}
          {questionItems}
        </section>
        <section>
          <h2>Delivery</h2>
          {item(
            "sequence",
            sequenceHref ?? `${lesson}?step=sequence`,
            "Tutoring sequence",
          )}
          {item(
            "review",
            reviewHref ?? `${lesson}?step=approval`,
            "Approve, publish and assign",
          )}
        </section>
      </nav>
    </>
  );
}
