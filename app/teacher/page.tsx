import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { AuthError, requireActor } from "../../lib/auth.ts";
import { EvidenceError, evidenceAccess } from "../../lib/evidence/store.ts";
import {
  parseTeacherWorkspaceContext,
  type TeacherWorkspaceContext,
  type TeacherWorkspaceParams,
} from "../../lib/teacher/workspace-contracts.ts";
import { TeacherFrame, date, originLabel } from "./presentation.tsx";
import { evidenceDescription } from "./data.ts";
import { loadOverview } from "./overview/load.ts";
import {
  assignmentHref,
  progressHref,
  overviewPriorities,
  recentActivity,
  type Priority,
} from "./overview/model.ts";
import "./overview/overview.css";

export const dynamic = "force-dynamic";

export default async function TeacherPage({
  searchParams,
}: {
  searchParams: Promise<TeacherWorkspaceParams>;
}) {
  let context;
  try {
    context = parseTeacherWorkspaceContext(await searchParams);
  } catch (error) {
    if (error instanceof z.ZodError) notFound();
    throw error;
  }
  return (
    <TeacherFrame section="Overview" context={context}>
      <Suspense
        fallback={
          <div
            className="ov-loading"
            role="status"
            aria-busy="true"
            data-workspace-pending="true"
          >
            <h1>Overview</h1>
            <p>Loading authorized assignments and saved teaching work…</p>
          </div>
        }
      >
        <OverviewContent context={context} />
      </Suspense>
    </TeacherFrame>
  );
}

async function OverviewContent({
  context,
}: {
  context: TeacherWorkspaceContext;
}) {
  const actor = await requireActor().catch((error: unknown) => {
    if (error instanceof AuthError && error.status === 401) redirect("/login");
    if (error instanceof AuthError && error.status === 403) notFound();
    throw error;
  });
  let overview;
  try {
    overview = await loadOverview(evidenceAccess(actor), context);
  } catch (error) {
    if (error instanceof EvidenceError && [403, 404].includes(error.status))
      notFound();
    return (
      <section className="ov-loading" role="alert">
        <h1>Overview unavailable</h1>
        <p>Your saved work has not changed. Reload to try again.</p>
        <a className="lp-button" href="/teacher">
          Reload Overview
        </a>
      </section>
    );
  }
  const { assignments, work, notices } = overview;
  const priorities = overviewPriorities(assignments, work, context.origin);
  const recent = recentActivity(assignments, context.origin);
  const unfinished = work.filter(
    (item) => item.kind === "private" || item.kind === "lesson",
  );
  const groups = [
    {
      id: "decision",
      title: "Needs a decision",
      empty:
        "No recorded teaching decisions in this view. This does not establish mastery.",
    },
    {
      id: "evaluation",
      title: "Evaluations to check",
      empty: "No unresolved latest evaluations in the available evidence.",
    },
    {
      id: "missing",
      title: "Missing work",
      empty: "No missing-answer counts in the available active assignments.",
    },
  ] as const;
  const decisions = priorities.filter(
    (item) => item.group === "decision",
  ).length;
  return (
    <div className="ov-workspace">
      <div className="ov-main" aria-labelledby="overview-title">
        <header className="ov-heading">
          <p className="ov-eyebrow">Your teaching workspace</p>
          <h1 id="overview-title">Overview</h1>
          <p>
            Across {assignments.length} authorized{" "}
            {assignments.length === 1 ? "assignment" : "assignments"}:{" "}
            {decisions} {decisions === 1 ? "decision" : "decisions"} to review ·{" "}
            {unfinished.length} saved{" "}
            {unfinished.length === 1 ? "draft" : "drafts"}.
          </p>
        </header>
        <div className="ov-tools">
          <nav aria-label="Overview sections">
            <a href="#ov-assignments">Assignments</a>
            <a href="#ov-resume">Resume work</a>
            <a href="#ov-activity">Recent activity</a>
          </nav>
          <details className="ov-filter">
            <summary>
              Evidence:{" "}
              {context.origin === "all"
                ? "all demo records"
                : context.origin === "live_demo"
                  ? "live test sessions"
                  : "prepared histories"}
            </summary>
            <form action="/teacher">
              <label htmlFor="ov-origin">Evidence source</label>
              <select
                id="ov-origin"
                name="origin"
                defaultValue={context.origin}
              >
                <option value="all">All demo records</option>
                <option value="live_demo">Live test sessions</option>
                <option value="synthetic_fixture">Prepared histories</option>
              </select>
              <button className="lp-button" type="submit">
                Apply
              </button>
            </form>
          </details>
        </div>
        {notices.length > 0 && (
          <details className="ov-notice">
            <summary role="status">
              Some workspace data is unavailable or limited ({notices.length})
            </summary>
            <ul>
              {notices.map((notice, index) => (
                <li key={index}>{notice}</li>
              ))}
            </ul>
            <a href={`/teacher?origin=${context.origin}`}>Reload Overview</a>
          </details>
        )}
        {!assignments.length && (
          <section className="ov-empty">
            <h2>No teaching assignments yet</h2>
            <p>
              Continue a private lesson below, or open Lessons to prepare one
              for an authorized class.
            </p>
            <Link
              className="lp-button lp-button-primary"
              href="/teacher/lessons"
            >
              Open lessons
            </Link>
          </section>
        )}
        {assignments.length > 0 &&
          groups.map((group) => {
            const items = priorities.filter((item) => item.group === group.id);
            return (
              <section
                className="ov-queue"
                key={group.id}
                aria-labelledby={`ov-${group.id}`}
              >
                <header>
                  <h2 id={`ov-${group.id}`}>{group.title}</h2>
                  <span>
                    {items.length} {items.length === 1 ? "item" : "items"}
                  </span>
                </header>
                {items.length ? (
                  <ol>
                    {items.map((item) => (
                      <PriorityRow
                        key={item.id}
                        item={item}
                        number={priorities.indexOf(item) + 1}
                        primary={priorities.indexOf(item) === 0}
                      />
                    ))}
                  </ol>
                ) : (
                  <p className="ov-empty-note">{group.empty}</p>
                )}
                {items.length > 0 && group.id === "decision" && (
                  <p className="ov-queue-note">
                    Reasoning counts include answers after help. Review the
                    evidence before deciding; these prompts do not establish a
                    misconception.
                  </p>
                )}
                {items.length > 0 && group.id === "evaluation" && (
                  <p className="ov-queue-note">
                    Saved answers are not graded as wrong. Opening them does not
                    retry evaluation.
                  </p>
                )}
              </section>
            );
          })}
        <p className="ov-footnote">
          Ordered by recorded concern type, then affected students within each
          assignment; delivery and follow-up reviews come next. No AI ranking.
          Counts are not added across classes or concepts.
        </p>
        <section
          id="ov-activity"
          className="ov-activity"
          aria-labelledby="ov-activity-title"
        >
          <h2 id="ov-activity-title">Recent activity</h2>
          <p className="ov-muted">
            Latest saved student answers across the available assignments.
          </p>
          {recent.length ? (
            <ul>
              {recent.map((item) => (
                <li key={item.id}>
                  <Link href={item.href}>
                    <strong>{item.title}</strong>
                    <span
                      className={
                        item.where.length > 90 ? "ov-compact-title" : undefined
                      }
                    >
                      {item.where}
                    </span>
                    <small>
                      {originLabel(item.origin)} ·{" "}
                      <time dateTime={item.at}>{date(item.at)}</time>
                    </small>
                  </Link>
                  {item.where.length > 90 && (
                    <details className="ov-title-details">
                      <summary>Full assignment title</summary>
                      <p>{item.where}</p>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>No submitted answers in this view.</p>
          )}
        </section>
        <p className="ov-footnote">
          {evidenceDescription(context.origin)} Immediate success after feedback
          does not establish lasting understanding.
        </p>
      </div>
      <aside
        className="ov-rail"
        aria-label="Your assignments and unfinished work"
      >
        <section id="ov-assignments" aria-labelledby="ov-assignments-title">
          <h2 id="ov-assignments-title">Your assignments</h2>
          <p className="ov-muted">
            Open progress, evidence or interventions in the right class.
          </p>
          {assignments.length ? (
            <ul className="ov-assignment-list">
              {assignments.map((assignment) => (
                <li key={assignment.id}>
                  <div className="ov-rail-title">
                    <strong>{assignment.class_name}</strong>
                    <span className={`ov-badge ov-${assignment.availability}`}>
                      {assignment.availability === "active"
                        ? "Active"
                        : assignment.availability === "inactive"
                          ? "Not active yet"
                          : "Unavailable"}
                    </span>
                  </div>
                  <Link
                    className="ov-assignment-title"
                    href={assignmentHref(
                      "/teacher/assignments",
                      assignment.id,
                      context.origin,
                    )}
                  >
                    {assignment.title}
                  </Link>
                  {assignment.availability === "inactive" ? (
                    <p className="ov-muted">
                      Students cannot open this assignment yet.
                    </p>
                  ) : assignment.snapshot ? (
                    <p className="ov-muted">
                      {assignment.snapshot.metrics.participation.numerator} of{" "}
                      {assignment.snapshot.metrics.enrolled_students} students
                      have answered.
                    </p>
                  ) : (
                    <p className="ov-muted">
                      Evidence unavailable; counts are not shown.
                    </p>
                  )}
                  <nav
                    aria-label={`${assignment.class_name} · ${assignment.title}`}
                  >
                    <Link href={progressHref(assignment.id, context.origin)}>
                      Progress
                    </Link>
                    <details className="ov-assignment-details">
                      <summary>Details and links</summary>
                      <p>
                        <strong>{assignment.class_name}</strong>
                        <br />
                        {assignment.title}
                      </p>
                      {assignment.version && (
                        <p>
                          Fixed lesson version <code>{assignment.version}</code>
                        </p>
                      )}
                      <div className="ov-assignment-detail-links">
                        <Link
                          href={assignmentHref(
                            "/teacher/evidence",
                            assignment.id,
                            context.origin,
                          )}
                        >
                          Evidence
                        </Link>
                        <Link
                          href={assignmentHref(
                            "/teacher/interventions",
                            assignment.id,
                            context.origin,
                          )}
                        >
                          Interventions
                        </Link>
                      </div>
                    </details>
                  </nav>
                </li>
              ))}
            </ul>
          ) : (
            <p>No assignments available.</p>
          )}
          <Link className="ov-link" href="/teacher/assignments">
            Browse assignments →
          </Link>
        </section>
        <section id="ov-resume" aria-labelledby="ov-resume-title">
          <h2 id="ov-resume-title">Pick up where you left off</h2>
          {unfinished.length ? (
            <ul className="ov-resume-list">
              {unfinished.map((item) => (
                <li key={item.id}>
                  <strong
                    className={
                      item.title.length > 90 ? "ov-compact-title" : undefined
                    }
                  >
                    {item.title}
                  </strong>
                  {item.title.length > 90 && (
                    <details className="ov-title-details">
                      <summary>Full title</summary>
                      <p>{item.title}</p>
                    </details>
                  )}
                  <p className="ov-muted">{item.detail}</p>
                  <Link className="lp-button" href={item.href}>
                    {item.action} →
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ov-muted">
              No saved unfinished work is available. Changes kept only in an
              editor’s browser recovery are not listed here.
            </p>
          )}
        </section>
        <section aria-labelledby="ov-work-title">
          <h2 id="ov-work-title">Available teaching work</h2>
          <ul className="ov-work-links">
            <li>
              <Link href="/teacher/lessons?new=true">Prepare a lesson →</Link>
              <span>Start with your teaching material.</span>
            </li>
            <li>
              <Link href="/teacher/lessons">Open lesson library →</Link>
              <span>Review drafts and published versions.</span>
            </li>
            <li>
              <Link href="/teacher/assignments">Review assignments →</Link>
              <span>Choose a class and fixed lesson version.</span>
            </li>
          </ul>
        </section>
      </aside>
    </div>
  );
}

function PriorityRow({
  item,
  number,
  primary,
}: {
  item: Priority;
  number: number;
  primary: boolean;
}) {
  return (
    <li className="ov-priority">
      <span className="ov-number" aria-hidden="true">
        {number}
      </span>
      <div>
        <p
          className={
            "ov-meta" + (item.where.length > 90 ? " ov-compact-title" : "")
          }
        >
          <b>{item.kind}</b> · {item.where}
        </p>
        <h3 className={item.title.length > 90 ? "ov-compact-title" : undefined}>
          {item.title}
        </h3>
        {(item.where.length > 90 || item.title.length > 90) && (
          <details className="ov-title-details">
            <summary>Full titles</summary>
            <p>{item.where}</p>
            <p>{item.title}</p>
          </details>
        )}
        <p>{item.detail}</p>
        {item.note && <p className="ov-muted">{item.note}</p>}
      </div>
      <Link
        className={`lp-button${primary ? " lp-button-primary" : ""}`}
        href={item.href}
      >
        {item.action}
      </Link>
    </li>
  );
}
