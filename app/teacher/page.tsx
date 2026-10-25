import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Icon } from "../components/icons.tsx";
import {
  parseTeacherWorkspaceContext,
  teacherWorkspaceHref,
  type TeacherWorkspaceParams,
} from "../../lib/teacher/workspace-contracts.ts";
import { loadTeacherView, evidenceDescription } from "./data.ts";
import { TeacherFiltersForm } from "./filters.tsx";
import { TeacherFrame, originLabel } from "./presentation.tsx";
import {
  teachingPriorities,
  teacherEvidenceRows,
  type TeachingPriority,
} from "./evidence/model.ts";
import "./evidence/workbench.css";

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
  const { assignments, origin, data } = await loadTeacherView(context);
  const resolved = { ...context, assignment: data?.assignment_id };
  const href = (path: string) => teacherWorkspaceHref(path, resolved);
  if (!data)
    return (
      <TeacherFrame section="Teaching Desk" context={resolved}>
        <header className="lp-page-heading">
          <p className="lp-eyebrow">Your classroom</p>
          <h1 className="lp-title">Teaching Desk</h1>
          <p className="lp-intro">
            A place to review learning and decide what comes next.
          </p>
        </header>
        <section className="lp-panel">
          <h2>No teaching assignments yet</h2>
          <p>Create and publish a lesson, then review its class assignment.</p>
          <Link className="lp-button" href="/teacher/lessons">
            Open lessons
          </Link>
        </section>
      </TeacherFrame>
    );
  const priorities = teachingPriorities(data);
  const decisions = priorities.filter((item) => item.kind !== "evaluation");
  const evaluations = priorities.filter((item) => item.kind === "evaluation");
  const recent = teacherEvidenceRows(data).slice(0, 3);
  function priority(item: TeachingPriority) {
    const index =
      item.kind === "evaluation"
        ? decisions.length + evaluations.indexOf(item) + 1
        : decisions.indexOf(item) + 1;
    const concept =
      data!.content.concepts.get(item.concept_id)?.title ?? item.concept_id;
    const detail = teacherWorkspaceHref("/teacher/evidence", resolved, {
      concept: item.concept_id,
      misconception: undefined,
      attempt: item.row?.attempt.id,
      evaluation: item.row?.evaluation?.id,
      session: item.row?.session_id,
      student: undefined,
      q: undefined,
      seedAttempt: [],
      returnTo: "desk",
    });
    return (
      <li className="wb-priority" key={item.concept_id}>
        <span className="wb-priority-number" aria-hidden="true">
          {index.toString().padStart(2, "0")}
        </span>
        <div className="wb-priority-body">
          <p className="wb-meta">
            {concept} <span aria-hidden="true">·</span> {data!.title}
          </p>
          <h3>
            {item.kind === "review"
              ? "Take a closer look at students’ reasoning"
              : item.kind === "uncertain"
                ? "Clarify what these responses tell you"
                : item.kind === "evaluation"
                  ? "Check responses awaiting a valid result"
                  : "Compare earlier difficulty with later work"}
          </h3>
          <p>
            {item.count} of {item.denominator}{" "}
            {item.kind === "review"
              ? "students have a partial or incorrect latest answer."
              : item.kind === "uncertain"
                ? "students have an uncertain latest evaluation."
                : item.kind === "evaluation"
                  ? "students have a pending, failed or rejected latest evaluation."
                  : "assessed students have at least two earlier partial or incorrect responses."}
          </p>
          <p className="wb-meta">
            {item.kind === "followup"
              ? "Historical difficulty may be followed by a correct response. Review the full sequence."
              : "Recorded evidence, including answers after help. Review before deciding what to teach."}
          </p>
          <Link
            className="lp-text-link"
            href={`${detail}#response-detail-title`}
          >
            Review evidence <Icon name="arrow" />
          </Link>
        </div>
      </li>
    );
  }
  return (
    <TeacherFrame section="Teaching Desk" context={resolved}>
      <div className="wb-desk">
        <header className="lp-page-heading wb-title-row">
          <div>
            <p className="lp-eyebrow">Your classroom</p>
            <h1 className="lp-title">Teaching Desk</h1>
            <p className="lp-intro">
              Review the reasoning. Choose the next teaching step.
            </p>
          </div>
          <Link className="lp-button" href={href("/teacher/lessons")}>
            Open lessons <Icon name="arrow" />
          </Link>
        </header>
        <TeacherFiltersForm
          action="/teacher"
          assignments={assignments}
          assignment={data.assignment_id}
          origin={origin}
        />
        <div className="wb-context-line">
          <strong>{data.class_name}</strong>
          <span>{data.title}</span>
          <span className="lp-badge lp-badge-neutral">
            {origin === "all"
              ? "Mixed demo evidence"
              : origin === "live_demo"
                ? "Live demo evidence"
                : "Prepared histories"}
          </span>
        </div>
        <div className="wb-desk-columns">
          <div className="wb-desk-main">
            <section aria-labelledby="priorities-title">
              <div className="wb-section-heading">
                <div>
                  <p className="lp-eyebrow">Your priorities</p>
                  <h2 id="priorities-title">Needs a decision</h2>
                </div>
                <Link className="lp-text-link" href={href("/teacher/evidence")}>
                  All evidence <Icon name="arrow" />
                </Link>
              </div>
              <p className="wb-meta">
                Ordered by the kind of recorded concern, then distinct student
                count. These are prompts for your review.
              </p>
              {decisions.length ? (
                <ol className="wb-priority-list">{decisions.map(priority)}</ol>
              ) : (
                <div className="wb-empty">
                  <h3>No review priorities in this view</h3>
                  <p>
                    That does not establish mastery. You can still inspect the
                    saved responses and assistance.
                  </p>
                  <Link
                    className="lp-text-link"
                    href={href("/teacher/evidence")}
                  >
                    Review recorded evidence
                  </Link>
                </div>
              )}
            </section>
            <section
              aria-labelledby="evaluation-title"
              className="wb-desk-section"
            >
              <div className="wb-section-heading">
                <h2 id="evaluation-title">Evaluations to check</h2>
                <span className="wb-count">{evaluations.length}</span>
              </div>
              {evaluations.length ? (
                <ol className="wb-priority-list">
                  {evaluations.map(priority)}
                </ol>
              ) : (
                <p className="wb-meta">
                  No concepts have unresolved latest evaluations in this view.
                </p>
              )}
            </section>
            <section
              aria-labelledby="participation-title"
              className="wb-desk-section"
            >
              <div className="wb-section-heading">
                <h2 id="participation-title">Participation to review</h2>
                <Link className="lp-text-link" href={href("/teacher/students")}>
                  View students
                </Link>
              </div>
              <p>
                <strong>
                  {data.metrics.no_activity_students} of{" "}
                  {data.metrics.enrolled_students}
                </strong>{" "}
                students have no submitted answers in this view.
              </p>
              <p className="wb-meta">
                Missing work is not an incorrect answer. Check the assignment
                and class context before following up.
              </p>
            </section>
          </div>
          <aside
            className="wb-desk-rail"
            aria-label="Assignment context and recent work"
          >
            <section>
              <p className="lp-eyebrow">In context</p>
              <h2>{data.title}</h2>
              <dl className="wb-context-counts">
                <div>
                  <dt>Students with responses</dt>
                  <dd>
                    {data.metrics.participation.numerator} /{" "}
                    {data.metrics.enrolled_students}
                  </dd>
                </div>
                <div>
                  <dt>Concepts with assessed answers</dt>
                  <dd>
                    {
                      data.metrics.concepts.filter(
                        (concept) => concept.latest.accepted_students > 0,
                      ).length
                    }{" "}
                    / {data.metrics.concepts.length}
                  </dd>
                </div>
              </dl>
              <Link
                className="lp-text-link"
                href={href("/teacher/assignments")}
              >
                Review assignment <Icon name="arrow" />
              </Link>
            </section>
            <section>
              <p className="lp-eyebrow">Continue reviewing</p>
              <h2>Recent student work</h2>
              {recent.length ? (
                <ul className="wb-resume-list">
                  {recent.map((row) => (
                    <li key={row.attempt.id}>
                      <Link
                        href={`${teacherWorkspaceHref(
                          "/teacher/evidence",
                          resolved,
                          {
                            attempt: row.attempt.id,
                            evaluation: row.evaluation?.id,
                            session: row.session_id,
                            concept: row.attempt.question.concept_ids[0],
                            misconception: undefined,
                            student: undefined,
                            q: undefined,
                            seedAttempt: [],
                            returnTo: "desk",
                          },
                        )}#response-detail-title`}
                      >
                        <strong>{row.student_name}</strong>
                        <span>
                          {data.content.concepts.get(
                            row.attempt.question.concept_ids[0],
                          )?.title ?? row.attempt.question.concept_ids[0]}
                        </span>
                        <small>{originLabel(row.data_origin)}</small>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No submitted work yet.</p>
              )}
            </section>
            <section>
              <h2>Explore the full picture</h2>
              <p className="wb-meta">
                Concept comparisons, reasoning patterns and complete session
                histories remain available.
              </p>
              <Link className="lp-text-link" href={href("/teacher/insights")}>
                Open learning insights <Icon name="arrow" />
              </Link>
            </section>
          </aside>
        </div>
        <p className="wb-footnote">
          {evidenceDescription(origin)} Immediate success after feedback does
          not establish lasting understanding.
        </p>
      </div>
    </TeacherFrame>
  );
}
