"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent,
} from "react";
import {
  NotebookPageNavigation,
  StudentNavigation,
  type NotebookPageGroup,
  type StudentDestination,
} from "./navigation.tsx";
import styles from "./notebook-shell.module.css";

type Pane = "page" | "pages" | "context" | "navigation";

function ControlIcon({
  kind,
}: {
  kind: "menu" | "pages" | "reading" | "back";
}) {
  const paths = {
    menu: "M4 6h16M4 12h16M4 18h16",
    pages: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
    reading:
      "M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3zM21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z",
    back: "M15 18l-6-6 6-6",
  };
  return (
    <svg className={styles.controlIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[kind]} />
    </svg>
  );
}

export type NotebookShellProps = {
  /** Use focus for active practice and delivered teacher reviews. */
  mode?: "browse" | "focus";
  destinations: readonly StudentDestination[];
  title: string;
  eyebrow?: string;
  subtitle?: string;
  /** Existing owner renders account controls; the shell invents no identity. */
  account?: ReactNode;
  headerContent?: ReactNode;
  navigationContent?: ReactNode;
  pages?: {
    title: string;
    description?: string;
    groups: readonly NotebookPageGroup[];
    content?: ReactNode;
  };
  /** Metadata or the existing visibility-aware reader, never a second session. */
  context?: { title: string; content: ReactNode };
  /** Errors, feedback and recovery actions remain outside switchable panes. */
  notices?: ReactNode;
  /** Active question summary from the existing student-safe projection. */
  questionContext?: ReactNode;
  /** One stable slot. Pass the existing StudySession here exactly once. */
  children: ReactNode;
};

/** Presentation only. No route parsing, transport, assessment or display receipts. */
export function NotebookShell({
  mode = "browse",
  destinations,
  title,
  eyebrow,
  subtitle,
  account,
  headerContent,
  navigationContent,
  pages,
  context,
  notices,
  questionContext,
  children,
}: NotebookShellProps) {
  const id = useId();
  const [pane, setPane] = useState<Pane>("page");
  const [wide, setWide] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const pageRail = useRef<HTMLElement>(null);
  const facing = useRef<HTMLElement>(null);
  const navigation = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const focusFrame = useRef<number | null>(null);
  const activePane =
    (pane === "context" && !context) || (pane === "pages" && !pages)
      ? "page"
      : pane;

  function focusAfterLayout(target: () => HTMLElement | null) {
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    focusFrame.current = requestAnimationFrame(() => {
      const element = target();
      if (element?.isConnected && element.getClientRects().length > 0)
        element.focus();
    });
  }

  function closePane(restoreTrigger = true) {
    setPane("page");
    focusAfterLayout(() =>
      restoreTrigger ? (returnFocus.current ?? page.current) : page.current,
    );
  }

  function closeAfterCustomLink(event: MouseEvent<HTMLElement>) {
    if (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey &&
      event.target instanceof Element &&
      event.target.closest("a[href]")
    )
      closePane(false);
  }

  function openPane(next: Exclude<Pane, "page">, trigger: HTMLButtonElement) {
    if (activePane === next) {
      closePane();
      return;
    }
    returnFocus.current = trigger;
    setPane(next);
    focusAfterLayout(() =>
      next === "pages"
        ? pageRail.current
        : next === "context"
          ? facing.current
          : navigation.current,
    );
  }

  useEffect(() => {
    // If resizing/zoom hides the focused rail or nav, return focus to the page.
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) setWide(width >= 1280);
      const focused = document.activeElement;
      if (
        focused instanceof HTMLElement &&
        root.current?.contains(focused) &&
        focused.getClientRects().length === 0
      ) {
        page.current?.focus({ preventScroll: true });
      }
    });
    if (root.current) observer.observe(root.current);
    return () => {
      observer.disconnect();
      if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    };
  }, []);

  return (
    <div
      ref={root}
      className={styles.shell}
      data-mode={mode}
      data-pane={activePane}
      data-has-pages={Boolean(pages)}
      data-has-context={Boolean(context)}
      onKeyDown={(event) => {
        if (
          event.key === "Escape" &&
          !event.defaultPrevented &&
          activePane !== "page"
        ) {
          event.preventDefault();
          closePane();
        }
      }}
    >
      <a
        className={styles.skip}
        href={`#${id}-page`}
        onClick={() => closePane(false)}
      >
        Skip to learning content
      </a>
      <header className={styles.header}>
        {headerContent ?? (
          <>
            {mode === "focus" && destinations[0] ? (
              <a
                className={`${styles.headerButton} ${styles.backLink}`}
                href={destinations[0].href}
                onClick={destinations[0].onClick}
                aria-label={`Back to ${destinations[0].label}`}
              >
                <ControlIcon kind="back" />
                <span className={styles.controlLabel}>
                  {destinations[0].label}
                </span>
              </a>
            ) : null}
            <div className={styles.brand}>
              <svg
                className={styles.brandMark}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M3 12h4l2.5-6 5 12 2.5-6h4" />
              </svg>
              <span className={styles.brandText}>
                Learning Pulse<small>Student</small>
              </span>
            </div>
            <div className={styles.focusTitle}>
              <strong>{title}</strong>
              {subtitle ? <small>{subtitle}</small> : null}
            </div>
          </>
        )}
        <button
          type="button"
          className={`${styles.headerButton} ${styles.navigationToggle}`}
          aria-expanded={activePane === "navigation"}
          aria-label="Menu"
          aria-controls={`${id}-navigation`}
          onClick={(event) => openPane("navigation", event.currentTarget)}
        >
          <ControlIcon kind="menu" />
          <span className={styles.controlLabel}>Menu</span>
        </button>
        <div
          id={`${id}-navigation`}
          ref={navigation}
          tabIndex={-1}
          role="region"
          aria-label="Student navigation menu"
          className={styles.navigationPanel}
          onClick={navigationContent == null ? undefined : closeAfterCustomLink}
        >
          {navigationContent ?? (
            <StudentNavigation
              destinations={destinations}
              onNavigate={() => closePane(false)}
            />
          )}
          <button
            type="button"
            className={styles.navigationClose}
            onClick={() => closePane()}
          >
            Back to page
          </button>
        </div>
        <div className={styles.toolbar}>
          {pages ? (
            <button
              type="button"
              className={`${styles.headerButton} ${styles.pagesToggle}`}
              aria-expanded={wide || activePane === "pages"}
              aria-label="Pages"
              aria-controls={`${id}-pages`}
              onClick={(event) => openPane("pages", event.currentTarget)}
            >
              <ControlIcon kind="pages" />
              <span className={styles.controlLabel}>Pages</span>
            </button>
          ) : null}
          {context ? (
            <button
              type="button"
              className={styles.headerButton}
              aria-expanded={wide || activePane === "context"}
              aria-label={context.title}
              aria-controls={`${id}-context`}
              onClick={(event) => openPane("context", event.currentTarget)}
            >
              <ControlIcon kind="reading" />
              <span className={styles.controlLabel}>{context.title}</span>
            </button>
          ) : null}
          {account ? <div className={styles.account}>{account}</div> : null}
        </div>
      </header>
      {notices ? <div className={styles.notices}>{notices}</div> : null}
      <div className={styles.layout}>
        {pages ? (
          <aside
            id={`${id}-pages`}
            ref={pageRail}
            tabIndex={-1}
            aria-label={pages.title}
            className={styles.rail}
            onClick={pages.content == null ? undefined : closeAfterCustomLink}
          >
            <div className={styles.paneHeading}>
              <h2>{pages.title}</h2>
              <button
                type="button"
                onClick={() => closePane()}
                className={styles.railClose}
              >
                Back to page
              </button>
            </div>
            {pages.description ? (
              <p className={styles.muted}>{pages.description}</p>
            ) : null}
            {pages.content ?? (
              <NotebookPageNavigation
                groups={pages.groups}
                onNavigate={() => closePane(false)}
              />
            )}
          </aside>
        ) : null}
        <div
          id={`${id}-page`}
          ref={page}
          tabIndex={-1}
          role="region"
          aria-label={title}
          className={styles.learning}
        >
          <div className={styles.pageHeading}>
            {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
            <h1>{title}</h1>
            {subtitle ? <p className={styles.muted}>{subtitle}</p> : null}
          </div>
          {questionContext ? (
            <div className={styles.questionContext}>{questionContext}</div>
          ) : null}
          <div className={styles.content}>{children}</div>
        </div>
        {context ? (
          <aside
            id={`${id}-context`}
            ref={facing}
            tabIndex={-1}
            aria-label={context.title}
            className={styles.facing}
          >
            <div className={styles.paneHeading}>
              <h2>{context.title}</h2>
              <button
                type="button"
                onClick={() => closePane()}
                className={styles.contextClose}
              >
                Back to page
              </button>
            </div>
            {context.content}
          </aside>
        ) : null}
      </div>
    </div>
  );
}

export function NotebookState({
  kind,
  title,
  children,
  action,
}: {
  kind: "empty" | "unavailable" | "loading" | "pending";
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      className={styles.state}
      data-kind={kind}
      aria-busy={kind === "loading" || undefined}
    >
      <h2>{title}</h2>
      <div>{children}</div>
      {action ? <div className={styles.stateAction}>{action}</div> : null}
    </section>
  );
}

/** Optional page paper/gutter for read-only leaves. Never wraps a second session. */
export function NotebookPage({
  id,
  label,
  marker,
  current = false,
  children,
}: {
  id?: string;
  label: string;
  marker?: string;
  current?: boolean;
  children: ReactNode;
}) {
  return (
    <article
      id={id}
      aria-label={label}
      className={styles.paper}
      data-current={current}
    >
      {marker ? (
        <div className={styles.gutter} aria-hidden="true">
          {marker}
        </div>
      ) : null}
      <div className={styles.paperBody}>{children}</div>
    </article>
  );
}
