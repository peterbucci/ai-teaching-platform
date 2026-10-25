import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthError, requireActor } from "../../../../lib/auth.ts";
import {
  EvidenceError,
  evidenceAccess,
} from "../../../../lib/evidence/store.ts";
import {
  studentAssignmentWork,
  studentDashboard,
  studentSessionAssignment,
} from "../../../../lib/tutoring/dashboard.ts";
import { tutorView } from "../../../../lib/tutoring/store.ts";
import { assignmentStudyHref } from "../../../../lib/tutoring/navigation.ts";
import { StudySession } from "../../session.tsx";
import { Icon } from "../../../components/icons.tsx";
import { LocalTime } from "../../../components/local-time.tsx";
import { Workspace } from "../../../components/workspace.tsx";
import { AssignmentAction } from "../action.tsx";
import { AssignmentOverview as NotebookAssignmentOverview } from "../../notebook/learning/index.ts";
import { NotebookSavedWorkView } from "../../notebook/records/index.ts";
import { notebookSavedWork } from "../../notebook/adapters.ts";
import { NotebookRouteShell } from "../../notebook/integration/route-shell.tsx";
import "../assignments.css";
import "./detail.css";
import "../../study.css";

export const dynamic = "force-dynamic";
const sections = [
  ["overview", "Overview"],
  ["study", "Study session"],
  ["work", "Your work"],
] as const;

async function loadAssignment(
  assignmentId: string,
  tab: string,
  requestedSession?: string,
) {
  try {
    const access = evidenceAccess(await requireActor());
    const dashboard = await studentDashboard(access);
    const lesson = dashboard.lessons.find((item) => item.id === assignmentId);
    if (!lesson) return { missing: true } as const;
    const sessionId = requestedSession ?? lesson.session?.id;
    if (
      sessionId !== undefined &&
      (await studentSessionAssignment(access, sessionId)) !== lesson.id
    )
      return { missing: true } as const;
    return {
      lesson,
      dashboard,
      sessionId,
      initial:
        tab === "study" && sessionId
          ? await tutorView(access, sessionId)
          : null,
      work:
        tab === "work"
          ? await studentAssignmentWork(access, assignmentId)
          : null,
      missing: false,
    } as const;
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect("/login");
    if (error instanceof EvidenceError && error.status === 404)
      return { missing: true } as const;
    return null;
  }
}

export default async function StudentAssignmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<{ tab?: string; session?: string; reading?: string }>;
}) {
  const { assignmentId } = await params;
  const query = await searchParams;
  const tab = query.tab ?? "overview";
  if (tab !== "materials" && !sections.some(([key]) => key === tab)) notFound();
  const data = await loadAssignment(assignmentId, tab, query.session);
  if (data?.missing) notFound();
  if (!data)
    return (
      <Workspace area="student" section="Assignments">
        <div className="lp-s-assignments lp-s-assignment-detail">
          <section className="lp-panel assignment-single-panel" role="alert">
            <h1 className="lp-title">We couldn’t load this assignment</h1>
            <p className="assignment-detail-long-copy">
              Your saved work has not changed. Please try again in a moment.
            </p>
            <Link href="/study/assignments" className="assignment-ghost">
              <Icon name="back" /> Back to your assignments
            </Link>
          </section>
        </div>
      </Workspace>
    );

  const { lesson, work, initial, dashboard, sessionId } = data;
  // Preserve saved links to the retired resources tab after checking access.
  if (tab === "materials") redirect(`/study/reading?assignment=${lesson.id}`);
  if (tab === "overview" || tab === "work")
    return (
      <NotebookRouteShell
        route={{ kind: "assignment", assignmentId: lesson.id, tab, sessionId }}
        section={tab === "work" ? "records" : "learning"}
        title={tab === "work" ? `Saved work · ${lesson.title}` : lesson.title}
        leafHeading={tab === "overview"}
      >
        {tab === "overview" ? (
          <NotebookAssignmentOverview lesson={lesson} />
        ) : (
          <NotebookSavedWorkView
            work={
              work
                ? { status: "ready", data: notebookSavedWork(lesson.id, work) }
                : {
                    status: "unavailable",
                    message: "Your saved work is temporarily unavailable.",
                  }
            }
          />
        )}
      </NotebookRouteShell>
    );
  const studying = tab === "study";
  const completed = lesson.session?.status === "completed";
  const status = !lesson.session
    ? "Ready to start"
    : completed
      ? "Completed"
      : lesson.session.status === "pending_evaluation"
        ? "Evaluation pending"
        : lesson.session.status === "unevaluated"
          ? "Teacher support needed"
          : "In progress";

  return (
    <Workspace
      area="student"
      section="Assignments"
      readingHref={
        studying && sessionId
          ? `/study/reading?session=${sessionId}`
          : undefined
      }
    >
      <div
        className={`lp-s-assignments assignments-refined lp-s-assignment-detail${studying && initial ? " assignment-study-layout" : ""}`}
      >
        <div className="assignment-breadcrumb">
          <Link href="/study/assignments" className="assignment-ghost">
            <Icon name="back" /> All assignments
          </Link>
        </div>
        <header className="assignment-detail-top">
          <div className="assignment-detail-heading">
            <p className="eyebrow">{lesson.className}</p>
            <h1>{lesson.title}</h1>
            <div className="assignment-detail-meta">
              <span
                className={`assignment-detail-state ${completed ? "done" : lesson.session ? "progress" : ""}`}
              >
                {status}
              </span>
              <span className="assignment-detail-date">
                <Icon name="check" />
                <LocalTime
                  value={lesson.teacherApprovedAt}
                  prefix="Approved "
                />
              </span>
            </div>
          </div>
        </header>
        <nav
          className="assignment-detail-tabs"
          aria-label="Assignment sections"
        >
          {sections.map(([key, label]) => (
            <Link
              key={key}
              className={`assignment-detail-tab${tab === key ? " active" : ""}`}
              href={
                key === "study"
                  ? assignmentStudyHref(lesson.id)
                  : `/study/assignments/${lesson.id}?tab=${key}`
              }
              aria-current={tab === key ? "page" : undefined}
              scroll={false}
              prefetch={false}
            >
              {label}
            </Link>
          ))}
        </nav>
        {studying ? (
          initial ? (
            <StudySession
              key={initial.session.id}
              lessons={[lesson]}
              initial={initial}
              initialTitle={lesson.title}
              dashboard={dashboard}
              assignmentId={lesson.id}
            />
          ) : (
            <section className="lp-panel assignment-study-empty">
              <h2>Ready when you are</h2>
              <p>
                Start this assignment to work through a question with your
                tutor. Your answers and feedback will be saved here.
              </p>
              <AssignmentAction lesson={lesson} className="lp-button-primary" />
            </section>
          )
        ) : null}
      </div>
    </Workspace>
  );
}
