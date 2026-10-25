"use client";

import Link from "next/link";
import { useId, useRef, useState, type ReactNode } from "react";
import "./authoring.css";

type Pane = "outline" | "editor" | "reading";
const panes: Pane[] = ["outline", "editor", "reading"];

/** All panes stay mounted: changing context must not discard unsaved inputs. */
export function AuthoringWorkspace({
  outline,
  reading,
  children,
  defaultPane = "editor",
  label = "Lesson authoring",
}: {
  outline: ReactNode;
  reading: ReactNode;
  children: ReactNode;
  defaultPane?: Pane;
  label?: string;
}) {
  const [pane, setPane] = useState<Pane>(defaultPane);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const readingOpener = useRef<HTMLElement | null>(null);
  function openPane(next: Pane, focus = true) {
    if (next === "reading" && pane !== "reading")
      readingOpener.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    setPane(next);
    if (focus)
      requestAnimationFrame(() =>
        root.current
          ?.querySelector<HTMLElement>(`[data-pane="${next}"]`)
          ?.focus({ preventScroll: true }),
      );
  }
  function closeReading() {
    setPane("editor");
    requestAnimationFrame(() => {
      const opener = readingOpener.current;
      if (opener?.isConnected && opener.getClientRects().length)
        opener.focus({ preventScroll: true });
      else
        root.current
          ?.querySelector<HTMLElement>('[data-pane="editor"]')
          ?.focus({ preventScroll: true });
    });
  }
  return (
    <div
      ref={root}
      className="la-workspace aw-workspace"
      data-active-pane={pane}
      aria-label={label}
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
        className="aw-outline-pane"
        tabIndex={-1}
        aria-label={`${label} outline`}
      >
        {outline}
      </aside>
      <section
        id={`${id}-editor`}
        data-pane="editor"
        className="aw-editor-pane"
        tabIndex={-1}
        aria-label="Focused editor"
      >
        <div className="aw-editor-toolbar">
          <span>{label}</span>
          <button
            type="button"
            onClick={() => openPane(pane === "reading" ? "editor" : "reading")}
            aria-expanded={pane === "reading"}
            aria-controls={`${id}-reading`}
          >
            Reading ↗
          </button>
        </div>
        <div className="aw-editor-content">{children}</div>
      </section>
      <aside
        id={`${id}-reading`}
        data-pane="reading"
        className="aw-reading-pane"
        tabIndex={-1}
        aria-label="Contextual source reading"
      >
        <div className="aw-reading-toolbar">
          <span>Reading & source support</span>
          <button
            type="button"
            onClick={closeReading}
            aria-label="Close reading and return to editor"
          >
            ×
          </button>
        </div>
        <div className="aw-reading-content">{reading}</div>
      </aside>
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
