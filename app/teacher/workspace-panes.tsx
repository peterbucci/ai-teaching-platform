"use client";

import { useSearchParams } from "next/navigation";
import {
  useId,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  availableTeacherWorkspacePanes,
  resolveTeacherWorkspacePane,
  teacherWorkspacePaneHref,
  teacherWorkspacePaneKeyboardTarget,
  type TeacherWorkspacePaneId,
  type TeacherWorkspacePaneViewport,
} from "./workspace-panes-model.ts";

export type { TeacherWorkspacePaneId } from "./workspace-panes-model.ts";

export type TeacherWorkspacePane = {
  label: string;
  children: ReactNode;
};

export type TeacherWorkspacePanesProps = {
  main: TeacherWorkspacePane;
  navigation?: TeacherWorkspacePane;
  context?: TeacherWorkspacePane;
  initialPane?: TeacherWorkspacePaneId;
};

function viewportSnapshot(): TeacherWorkspacePaneViewport {
  if (window.matchMedia("(max-width: 800px)").matches) return "compact";
  return window.matchMedia("(max-width: 1240px)").matches ? "medium" : "wide";
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

const serverViewport = (): TeacherWorkspacePaneViewport => "wide";

/**
 * Optional page-owned slots: this component does not fetch, select records, or
 * perform domain actions. Use once per page. Children remain mounted when panes
 * hide or the context pane changes between inline content and a modal drawer.
 */
export function TeacherWorkspacePanes({
  main,
  navigation,
  context,
  initialPane = "main",
}: TeacherWorkspacePanesProps) {
  const id = useId();
  const search = useSearchParams();
  const viewport = useSyncExternalStore(
    subscribeViewport,
    viewportSnapshot,
    serverViewport,
  );
  const panes = availableTeacherWorkspacePanes(
    Boolean(navigation),
    Boolean(context),
  );
  const active = resolveTeacherWorkspacePane(search, panes, initialPane);
  const slots = { navigation, main, context };
  const root = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const modal = useRef(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const previousPane = useRef<TeacherWorkspacePaneId>("main");
  const lastActive = useRef(active);
  const lastViewport = useRef(viewport);
  const pendingFocus = useRef<"heading" | "opener" | null>(null);
  const headings = useRef<
    Partial<Record<TeacherWorkspacePaneId, HTMLHeadingElement | null>>
  >({});
  const bodies = useRef<
    Partial<Record<TeacherWorkspacePaneId, HTMLDivElement | null>>
  >({});
  const tabs = useRef<
    Partial<Record<TeacherWorkspacePaneId, HTMLButtonElement | null>>
  >({});
  const positions = useRef<Partial<Record<TeacherWorkspacePaneId, number>>>({});
  const focusTargets = useRef<
    Partial<Record<TeacherWorkspacePaneId, HTMLElement>>
  >({});

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) modal.current = false;
    const shouldModal =
      Boolean(context) && viewport === "medium" && active === "context";
    const shouldInline =
      viewport === "wide" || (viewport === "compact" && active === "context");
    if (element) {
      if (modal.current && !shouldModal) {
        element.close();
        modal.current = false;
      }
      if (shouldModal && !modal.current) {
        if (element.open) element.close();
        element.showModal();
        modal.current = true;
      } else if (!shouldModal) {
        if (shouldInline) element.setAttribute("open", "");
        else element.removeAttribute("open");
      }
    }

    const changed = lastActive.current !== active;
    const layoutChanged = lastViewport.current !== viewport;
    const becameModal = shouldModal && layoutChanged;
    const restoreForLayout =
      layoutChanged &&
      root.current?.contains(document.activeElement) &&
      (viewport === "compact" || active === "context");
    if (changed || becameModal || restoreForLayout) {
      const body = bodies.current[active];
      if (body) body.scrollTop = positions.current[active] ?? 0;
      const remembered = focusTargets.current[active];
      // Explicit controls request heading/opener focus; passive URL changes
      // (including Back/Forward) restore the mounted pane without racing router events.
      const target =
        pendingFocus.current === "opener"
          ? opener.current
          : (pendingFocus.current === null || restoreForLayout) &&
              remembered?.isConnected
            ? remembered
            : headings.current[active];
      // A hidden pane must never receive focus after a breakpoint transition.
      if (
        viewport === "compact" ||
        shouldModal ||
        restoreForLayout ||
        pendingFocus.current === "opener"
      ) {
        target?.focus({ preventScroll: true });
      }
    }
    if (active !== "context") previousPane.current = active;
    lastActive.current = active;
    lastViewport.current = viewport;
    pendingFocus.current = null;
  }, [active, viewport, context]);

  function rememberScroll() {
    for (const pane of panes) {
      const body = bodies.current[pane];
      if (body && body.getClientRects().length)
        positions.current[pane] = body.scrollTop;
    }
  }

  function selectPane(pane: TeacherWorkspacePaneId) {
    if (pane === active) return;
    rememberScroll();
    pendingFocus.current = "heading";
    window.history.pushState(
      null,
      "",
      teacherWorkspacePaneHref(new URL(window.location.href), pane),
    );
  }

  function closeContext() {
    rememberScroll();
    pendingFocus.current = "opener";
    const next =
      panes.includes(previousPane.current) && previousPane.current !== "context"
        ? previousPane.current
        : "main";
    // Closing a drawer replaces its presentation state instead of adding a
    // second history step. Direct links and refreshes therefore close safely.
    window.history.replaceState(
      null,
      "",
      teacherWorkspacePaneHref(new URL(window.location.href), next),
    );
  }

  function panelContent(
    pane: TeacherWorkspacePaneId,
    slot: TeacherWorkspacePane,
  ) {
    return (
      <>
        <div className="tw-panes-heading-row">
          <h2
            id={`${id}-${pane}-heading`}
            className="tw-panes-heading"
            tabIndex={-1}
            ref={(element) => {
              headings.current[pane] = element;
            }}
          >
            {slot.label}
          </h2>
          {pane === "context" && (
            <button
              type="button"
              className="tw-panes-context-close"
              hidden={viewport !== "medium"}
              aria-label={`Close ${slot.label}`}
              onClick={closeContext}
            >
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
        <div
          className="tw-panes-body"
          id={pane === "context" ? `${id}-context-content` : undefined}
          role={
            pane === "context" && viewport === "compact"
              ? "tabpanel"
              : undefined
          }
          aria-labelledby={
            pane === "context" && viewport === "compact"
              ? `${id}-context-heading`
              : undefined
          }
          ref={(element) => {
            bodies.current[pane] = element;
          }}
          onScroll={(event) => {
            if (event.currentTarget.getClientRects().length)
              positions.current[pane] = event.currentTarget.scrollTop;
          }}
          onFocusCapture={(event) => {
            focusTargets.current[pane] = event.target;
          }}
        >
          {slot.children}
        </div>
      </>
    );
  }

  return (
    <div
      ref={root}
      className="tw-panes"
      data-has-navigation={Boolean(navigation)}
      data-has-context={Boolean(context)}
      data-active-pane={active}
      data-layout={viewport}
    >
      {panes.length > 1 && (
        <div
          className="tw-panes-switcher"
          role="tablist"
          aria-label="Workspace panes"
          hidden={viewport !== "compact"}
        >
          {panes.map((pane) => (
            <button
              key={pane}
              ref={(element) => {
                tabs.current[pane] = element;
              }}
              id={`${id}-${pane}-tab`}
              type="button"
              role="tab"
              className="tw-panes-tab"
              aria-selected={active === pane}
              aria-controls={
                pane === "context"
                  ? `${id}-context-content`
                  : `${id}-${pane}-panel`
              }
              tabIndex={active === pane ? 0 : -1}
              onClick={() => selectPane(pane)}
              onKeyDown={(event) => {
                const next = teacherWorkspacePaneKeyboardTarget(
                  panes,
                  pane,
                  event.key,
                );
                if (next) {
                  event.preventDefault();
                  tabs.current[next]?.focus();
                }
              }}
            >
              {slots[pane]?.label}
            </button>
          ))}
        </div>
      )}
      {context && (
        <button
          ref={opener}
          type="button"
          className="tw-panes-context-trigger"
          hidden={viewport !== "medium"}
          aria-haspopup="dialog"
          aria-expanded={active === "context"}
          aria-controls={`${id}-context-panel`}
          onClick={() => selectPane("context")}
        >
          Open {context.label}
        </button>
      )}
      <div className="tw-panes-grid">
        {(["navigation", "main"] as const).map((pane) => {
          const slot = slots[pane];
          return slot ? (
            <section
              key={pane}
              id={`${id}-${pane}-panel`}
              className={`tw-panes-panel tw-panes-panel--${pane}`}
              role={viewport === "compact" ? "tabpanel" : "region"}
              aria-labelledby={`${id}-${pane}-heading`}
              hidden={viewport === "compact" && active !== pane}
            >
              {panelContent(pane, slot)}
            </section>
          ) : null;
        })}
        {context && (
          <dialog
            ref={dialog}
            id={`${id}-context-panel`}
            className="tw-panes-context tw-panes-panel"
            aria-modal={viewport === "medium" ? true : undefined}
            aria-labelledby={`${id}-context-heading`}
            onCancel={(event) => {
              event.preventDefault();
              closeContext();
            }}
            onClick={(event) => {
              if (viewport === "medium" && event.target === event.currentTarget)
                closeContext();
            }}
          >
            {panelContent("context", context)}
          </dialog>
        )}
      </div>
    </div>
  );
}
