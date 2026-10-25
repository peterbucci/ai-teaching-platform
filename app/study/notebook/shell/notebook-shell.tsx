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
import { NotebookSurfaceContext } from "./surface.tsx";

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
  /** Active study opts into persistent recovery placement and pane visibility. */
  activeStudy?: boolean;
  destinations: readonly StudentDestination[];
  backDestination?: StudentDestination;
  /** Existing owner supplies truthful save status and the exact selected prompt. */
  headerStatus?: string;
  selectedPrompt?: string;
  hideContextHeading?: boolean;
  title: string;
  shortTitle?: string;
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
  activeStudy = false,
  destinations,
  backDestination,
  headerStatus,
  selectedPrompt,
  hideContextHeading = false,
  title,
  shortTitle,
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
  const back = backDestination ?? destinations[0];
  const [pane, setPane] = useState<Pane>("page");
  const [wide, setWide] = useState(false);
  const [width, setWidth] = useState(0);
  const [covered, setCovered] = useState(false);
  const [noticeHost, setNoticeHost] = useState<HTMLDivElement | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const pageRail = useRef<HTMLElement>(null);
  const facing = useRef<HTMLElement>(null);
  const navigation = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const focusFrame = useRef<number | null>(null);
  const savedPageScroll = useRef<{ x: number; y: number } | null>(null);
  const activePane =
    (pane === "context" && !context) || (pane === "pages" && !pages)
      ? "page"
      : pane;

  function focusAfterLayout(target: () => HTMLElement | null) {
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    focusFrame.current = requestAnimationFrame(() => {
      const element = target();
      if (element?.isConnected && element.getClientRects().length > 0)
        element.focus({ preventScroll: true });
    });
  }

  function closePane(restoreTrigger = true) {
    setPane("page");
    focusAfterLayout(() => {
      if (activeStudy && savedPageScroll.current) {
        window.scrollTo(savedPageScroll.current.x, savedPageScroll.current.y);
        savedPageScroll.current = null;
      }
      return restoreTrigger
        ? (returnFocus.current ?? page.current)
        : page.current;
    });
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
    if (activeStudy && activePane === "page")
      savedPageScroll.current = { x: window.scrollX, y: window.scrollY };
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
      if (width !== undefined) {
        setWide(width >= 1280);
        setWidth(width);
      }
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

  useEffect(() => {
    const container = root.current;
    if (!container || !activeStudy) return;
    const update = () =>
      setCovered(
        Boolean(
          container.querySelector(
            "details.lp-account-menu[open], details[data-notebook-prompt][open], dialog[open]",
          ),
        ),
      );
    const observer = new MutationObserver(update);
    observer.observe(container, {
      subtree: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    return () => observer.disconnect();
  }, [activeStudy]);

  return (
    <NotebookSurfaceContext.Provider
      value={{
        pageVisible:
          !covered &&
          (width >= 820 ||
            (activePane !== "context" && activePane !== "navigation")),
        contextVisible:
          !covered &&
          activePane !== "navigation" &&
          (wide || activePane === "context"),
        noticeHost,
        paperScroll: activeStudy,
        showPage: () => closePane(false),
        showContext: () => {
          if (activeStudy && activePane === "page")
            savedPageScroll.current = { x: window.scrollX, y: window.scrollY };
          const focused = document.activeElement;
          if (focused instanceof HTMLButtonElement)
            returnFocus.current = focused;
          setPane("context");
          focusAfterLayout(() => facing.current);
        },
      }}
    >
      <div
        ref={root}
        className={styles.shell}
        data-mode={mode}
        data-active-study={activeStudy || undefined}
        data-pane={activePane}
        data-has-pages={Boolean(pages)}
        data-has-context={Boolean(context)}
        onKeyDown={(event) => {
          const prompt = root.current?.querySelector<HTMLDetailsElement>(
            "details[data-notebook-prompt][open]",
          );
          if (event.key === "Escape" && !event.defaultPrevented && prompt) {
            event.preventDefault();
            prompt.open = false;
            prompt.querySelector("summary")?.focus({ preventScroll: true });
            return;
          }
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
              {mode === "focus" && back ? (
                <a
                  className={`${styles.headerButton} ${styles.backLink}`}
                  href={back.href}
                  onClick={back.onClick}
                  aria-label={`Back to ${back.label}`}
                >
                  <ControlIcon kind="back" />
                  <span className={styles.controlLabel}>{back.label}</span>
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
                {selectedPrompt ? (
                  <details
                    className={styles.focusPrompt}
                    data-notebook-prompt
                    onKeyDown={(event) => {
                      if (event.key === "Escape" && event.currentTarget.open) {
                        event.preventDefault();
                        event.stopPropagation();
                        event.currentTarget.open = false;
                        event.currentTarget
                          .querySelector("summary")
                          ?.focus({ preventScroll: true });
                      }
                    }}
                  >
                    <summary
                      aria-label="Show selected question"
                      aria-description={title}
                    >
                      <strong title={title}>
                        <span
                          className={shortTitle ? styles.fullTitle : undefined}
                        >
                          {title}
                        </span>
                        {shortTitle && (
                          <span
                            className={styles.shortTitle}
                            aria-hidden="true"
                          >
                            {shortTitle}
                          </span>
                        )}
                      </strong>
                      <span aria-hidden="true">⌄</span>
                    </summary>
                    <div className={styles.promptText}>
                      <p>{selectedPrompt}</p>
                      <button
                        type="button"
                        onClick={(event) => {
                          const details =
                            event.currentTarget.closest("details");
                          if (details) details.open = false;
                          closePane(false);
                        }}
                      >
                        Return to page
                      </button>
                    </div>
                  </details>
                ) : (
                  <strong>{title}</strong>
                )}
                {subtitle ? <small>{subtitle}</small> : null}
                {headerStatus ? (
                  <span className={styles.headerStatus} title={headerStatus}>
                    {headerStatus}
                  </span>
                ) : null}
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
            onClick={
              navigationContent == null ? undefined : closeAfterCustomLink
            }
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
        {notices || activeStudy ? (
          <div className={styles.notices}>
            {notices}
            <div ref={setNoticeHost} data-notebook-recovery />
          </div>
        ) : null}
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
              data-heading-hidden={hideContextHeading || undefined}
            >
              <div className={styles.paneHeading}>
                {!hideContextHeading && <h2>{context.title}</h2>}
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
    </NotebookSurfaceContext.Provider>
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
