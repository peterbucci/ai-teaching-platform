"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type {
  TeacherWorkspaceContext,
  TeacherWorkspaceParams,
} from "../../lib/teacher/workspace-contracts.ts";
import { AccountMenu } from "../components/account-menu.tsx";
import { Icon } from "../components/icons.tsx";
import { useWorkspaceAssignments } from "./workspace-context.tsx";
import {
  resolveWorkspaceSelection,
  switchedAssignmentHref,
  workspaceAuthoringMode,
  workspaceDestination,
  workspaceNavigationHref,
} from "./workspace-model.ts";
import { WorkspaceNavigationRestoration } from "./workspace-restoration.tsx";
import { WorkspaceAssignmentStatus } from "./workspace-assignment.tsx";
import "./workspace-shell.css";

const courseLinks = [
  { path: "/teacher", text: "Overview", icon: "home" },
  { path: "/teacher/assignments", text: "Assignments", icon: "assignment" },
  { path: "/teacher/lessons", text: "Lessons", icon: "book" },
] as const;
const assignmentLinks = [
  {
    path: "/teacher/assignments",
    text: "Progress",
    icon: "chart",
    view: "progress",
  },
  { path: "/teacher/evidence", text: "Student work", icon: "journal" },
  { path: "/teacher/interventions", text: "Interventions", icon: "assignment" },
  { path: "/teacher/students", text: "Roster", icon: "users" },
] as const;

function subscribeHash(notify: () => void) {
  window.addEventListener("hashchange", notify);
  window.addEventListener("popstate", notify);
  return () => {
    window.removeEventListener("hashchange", notify);
    window.removeEventListener("popstate", notify);
  };
}
const currentHash = () => window.location.hash;
const serverHash = () => "";

export function TeacherWorkspace({
  children,
  section,
  context,
  contextIsAuthoritative = false,
}: {
  children: ReactNode;
  section: string;
  context?: TeacherWorkspaceContext;
  contextIsAuthoritative?: boolean;
}) {
  const search = useSearchParams();
  const pathname = usePathname();
  const hash = useSyncExternalStore(subscribeHash, currentHash, serverHash);
  const assignments = useWorkspaceAssignments();
  const switcher = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const restoreSwitcherFocus = useRef(true);

  useLayoutEffect(() => {
    const dismissForNavigation = (event: MouseEvent) => {
      const dialog = switcher.current;
      if (
        !dialog?.open ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (
        !link ||
        !dialog.contains(link) ||
        link.target === "_blank" ||
        link.hasAttribute("download")
      )
        return;
      // A page-owned capture guard may stop this click before Link's handler.
      // Release modal inertness now; the page alone decides whether to leave
      // and where to focus its recovery feedback. Never cancel or route here.
      restoreSwitcherFocus.current = false;
      dialog.close();
    };
    // Install before child pages' passive navigation guards. Those guards can
    // synchronously focus feedback when they block a click, so the dialog
    // must already be closed before their handlers run.
    window.addEventListener("click", dismissForNavigation, true);
    return () =>
      window.removeEventListener("click", dismissForNavigation, true);
  }, []);
  const params: TeacherWorkspaceParams = {};
  for (const key of new Set(search.keys())) {
    const values = search.getAll(key);
    params[key] = values.length > 1 ? values : values[0];
  }
  let selection: ReturnType<typeof resolveWorkspaceSelection> | undefined;
  try {
    selection = resolveWorkspaceSelection(
      params,
      context,
      assignments,
      contextIsAuthoritative,
    );
  } catch {
    // Destination loaders reject invalid input; do not choose another class.
  }
  const selected = selection?.context ?? {};
  const assignment = selection?.assignment;
  const active = workspaceDestination(pathname, search.get("view"));
  const authoringMode = workspaceAuthoringMode(pathname);
  const assignmentArea = assignmentLinks.some((item) => item.text === active);
  const evidenceView =
    pathname.startsWith("/teacher/evidence") || hash === "#responses"
      ? "answers"
      : hash === "#patterns" || pathname.startsWith("/teacher/patterns")
        ? "concerns"
        : pathname.startsWith("/teacher/insights")
          ? "ideas"
          : undefined;
  const navigation = assignmentArea ? assignmentLinks : courseLinks;
  const href = (path: string, view?: "progress" | "review" | "preview") =>
    workspaceNavigationHref(path, selected, view);
  function openSwitcher(event: ReactMouseEvent<HTMLButtonElement>) {
    opener.current = event.currentTarget;
    restoreSwitcherFocus.current = true;
    switcher.current?.showModal();
  }
  function closeSwitcher() {
    switcher.current?.close();
  }
  function navLinks(mobile = false) {
    return navigation.map((item) => (
      <Link
        key={item.text}
        href={href(item.path, "view" in item ? item.view : undefined)}
        aria-current={active === item.text ? "page" : undefined}
        data-workspace-focus={`${mobile ? "bottom" : "assignment"}-${item.text}`}
      >
        <span className="tw-nav-icon">
          <Icon name={item.icon} />
        </span>
        <span>{item.text}</span>
      </Link>
    ));
  }
  return (
    <div
      className="tw-shell"
      data-scope={assignmentArea ? "assignment" : "course"}
      data-authoring={authoringMode === "focused" ? "focused" : undefined}
    >
      <a className="lp-skip" href="#main-content">
        Skip to content
      </a>
      <WorkspaceNavigationRestoration label={active} />
      <header className="tw-header">
        {assignmentArea && (
          <Link
            className="tw-mobile-back"
            href={href("/teacher/assignments")}
            aria-label="Back to course assignments"
          >
            <Icon name="back" />
          </Link>
        )}
        <Link
          href={href("/teacher")}
          className="tw-brand"
          aria-label="Learning Pulse overview"
        >
          <span className="tw-brand-mark">
            <Icon name="pulse" />
          </span>
          <span>
            Learning Pulse
            <small>{assignment?.class_name ?? "Your teaching"}</small>
          </span>
        </Link>
        <button
          type="button"
          className="tw-scope-switch"
          onClick={openSwitcher}
          aria-haspopup="dialog"
          aria-controls="teacher-workspace-switcher"
        >
          <span className="tw-desktop-scope">
            {assignment?.class_name ?? "Your teaching"}
          </span>
          <span className="tw-mobile-scope">
            <small>
              {assignmentArea && assignment ? (
                <>
                  <span
                    className="tw-mobile-class"
                    title={assignment.class_name}
                  >
                    {assignment.class_name}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span
                    className="tw-mobile-assignment"
                    title={assignment.title}
                  >
                    {assignment.title}
                  </span>
                </>
              ) : assignmentArea ? (
                "Select assignment"
              ) : (
                (assignment?.class_name ?? "Your teaching")
              )}
            </small>
            <strong>{active}</strong>
          </span>
          <Icon name="chevron" />
        </button>
        <nav className="tw-course-nav" aria-label="Course workspace">
          {courseLinks.map((item) => (
            <Link
              key={item.text}
              href={href(item.path)}
              aria-current={active === item.text ? "page" : undefined}
              data-parent-active={
                assignmentArea && item.text === "Assignments"
                  ? "true"
                  : undefined
              }
              data-workspace-focus={`course-${item.text}`}
            >
              {item.text}
            </Link>
          ))}
        </nav>
        <div className="tw-account">
          <span>Teacher workspace</span>
          <AccountMenu area="teacher" />
        </div>
      </header>
      {assignmentArea && (
        <section
          className="tw-assignment-band"
          aria-label="Selected assignment"
        >
          <div className="tw-assignment-identity">
            <span className="tw-scope-label">Assignment</span>
            <button
              type="button"
              className="tw-assignment-switch"
              onClick={openSwitcher}
              aria-haspopup="dialog"
              aria-controls="teacher-workspace-switcher"
            >
              <span>
                <strong>
                  {assignment && (
                    <span className="tw-band-class">
                      {assignment.class_name} ·{" "}
                    </span>
                  )}
                  {assignment?.title ?? "Select an assignment"}
                </strong>
              </span>
              <Icon name="chevron" />
            </button>
            {assignment && (
              <WorkspaceAssignmentStatus assignment={assignment} />
            )}
            {assignment && (
              <Link
                href={href("/teacher/assignments", "review")}
                className="tw-pinned-link"
              >
                Review assigned lesson <Icon name="arrow" />
              </Link>
            )}
          </div>
          <nav className="tw-assignment-nav" aria-label="Assignment workspace">
            {navLinks()}
          </nav>
        </section>
      )}
      {authoringMode === "library" && (
        <nav className="tw-section-nav" aria-label="Lesson tools">
          {[
            ["Lessons", "/teacher/lessons"],
            ["Materials", "/teacher/materials"],
            ["Objectives", "/teacher/objectives"],
          ].map(([text, path]) => (
            <Link
              key={path}
              href={href(path)}
              aria-current={pathname === path ? "page" : undefined}
            >
              {text}
            </Link>
          ))}
        </nav>
      )}
      {authoringMode === "focused" && (
        <nav
          className="tw-path tw-authoring-path"
          aria-label="Lesson workspace path"
        >
          <Link href={href("/teacher/lessons")} aria-label="Back to Lessons">
            <Icon name="back" />
            Back to Lessons
          </Link>
          <span>{section}</span>
        </nav>
      )}
      {active === "Student work" && (
        <nav className="tw-section-nav" aria-label="Student work views">
          <Link
            href={href("/teacher/evidence")}
            aria-current={evidenceView === "answers" ? "page" : undefined}
          >
            All answers
          </Link>
          <Link
            href={`${href("/teacher/insights")}#concepts`}
            aria-current={evidenceView === "ideas" ? "page" : undefined}
          >
            By idea
          </Link>
          <Link
            href={`${href("/teacher/insights")}#patterns`}
            aria-current={evidenceView === "concerns" ? "page" : undefined}
          >
            Concerns
          </Link>
        </nav>
      )}
      {active !== "Lessons" && active !== "Student work" && (
        <nav className="tw-path" aria-label="Workspace path">
          <Link
            href={href(assignmentArea ? "/teacher/assignments" : "/teacher")}
          >
            <Icon name="back" />
            {assignmentArea ? "Back to Assignments" : "Teaching workspace"}
          </Link>
          <span>{active}</span>
          {!assignmentArea && assignment && (
            <Link
              href={href("/teacher/assignments", "progress")}
              className="tw-resume-assignment"
            >
              Open current assignment <Icon name="arrow" />
            </Link>
          )}
        </nav>
      )}
      <main
        id="main-content"
        tabIndex={-1}
        className="tw-main"
        aria-label={section}
      >
        {children}
      </main>
      <nav
        className="tw-bottom-nav"
        aria-label={
          assignmentArea
            ? "Assignment workspace mobile"
            : "Course workspace mobile"
        }
      >
        {navLinks(true)}
      </nav>
      <dialog
        ref={switcher}
        id="teacher-workspace-switcher"
        className="tw-switcher"
        aria-labelledby="tw-switcher-title"
        onClose={() => {
          if (restoreSwitcherFocus.current) opener.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeSwitcher();
        }}
      >
        <div className="tw-switcher-heading">
          <h2 id="tw-switcher-title">Switch workspace</h2>
          <button
            type="button"
            className="lp-icon-button"
            aria-label="Close workspace switcher"
            onClick={closeSwitcher}
          >
            <Icon name="close" />
          </button>
        </div>
        <nav aria-label="Course destinations" className="tw-switcher-course">
          {courseLinks.map((item) => (
            <Link key={item.text} href={href(item.path)}>
              <Icon name={item.icon} />
              {item.text}
            </Link>
          ))}
        </nav>
        <h3>Assignments</h3>
        <p className="tw-switcher-note">
          Switching clears response and concept selections. Each assignment
          keeps its own approved lesson version.
        </p>
        <ul className="tw-switcher-assignments">
          {assignments.map((item) => (
            <li key={item.id}>
              <Link
                href={switchedAssignmentHref(
                  item.id,
                  selection?.context.origin ?? "all",
                )}
                aria-current={
                  assignmentArea && item.id === assignment?.id
                    ? "true"
                    : undefined
                }
              >
                <Icon name="assignment" />
                <span>
                  <strong>{item.title}</strong>
                  <small>
                    {item.class_name}
                    {item.version
                      ? ` · Version ${item.version}`
                      : " · Version unavailable"}
                    {item.availability === "active"
                      ? " · Active"
                      : item.availability === "inactive"
                        ? " · Inactive"
                        : ""}
                  </small>
                </span>
                {item.id === assignment?.id && <Icon name="tick" />}
              </Link>
            </li>
          ))}
        </ul>
        {!assignments.length && (
          <p className="tw-switcher-note">
            No classroom assignments are available. Open Lessons to prepare one.
          </p>
        )}
      </dialog>
    </div>
  );
}
