import Link from "next/link";
import { Icon } from "../components/icons.tsx";
import { loadApprovedContent } from "../../lib/evidence/content.ts";
import { calculatePatterns } from "../../lib/teacher/patterns.ts";
import {
  loadTeacherView,
  evidenceDescription,
  teacherViewHref,
  type TeacherFilters,
} from "./data.ts";
import { TeacherFiltersForm } from "./filters.tsx";
import { TeacherFrame, date, originLabel } from "./presentation.tsx";

export const dynamic = "force-dynamic";

export default async function TeacherPage({
  searchParams,
}: {
  searchParams: Promise<TeacherFilters>;
}) {
  const { assignments, origin, data } = await loadTeacherView(
    await searchParams,
  );
  if (!data)
    return (
      <TeacherFrame>
        <header className="lp-page-heading">
          <p className="lp-eyebrow">Your classroom</p>
          <h1 className="lp-title">Class overview</h1>
        </header>
        <section className="lp-panel">
          <h2>No teaching assignments yet</h2>
          <p>This teacher account has no class assignments to inspect.</p>
        </section>
      </TeacherFrame>
    );
  const content = loadApprovedContent();
  const { metrics } = data;
  const insights = teacherViewHref(
    "/teacher/insights",
    data.assignment_id,
    origin,
  );
  const directory = teacherViewHref(
    "/teacher/students",
    data.assignment_id,
    origin,
  );
  const assignment = `/teacher/assignments?assignment=${data.assignment_id}`;
  const patterns = calculatePatterns(
    data.students.map((s) => s.student_id),
    new Set(data.approved_misconception_ids),
    data.evidence,
  );
  const studentsWithPatterns = new Set(
    patterns.flatMap((group) =>
      group.students.map((student) => student.student_id),
    ),
  ).size;
  const recentWork = data.evidence
    .map((item) => ({
      ...item,
      submitted: item.attempts.filter((a) => a.submitted_at !== null),
    }))
    .filter((item) => item.submitted.length > 0)
    .sort((a, b) =>
      b.submitted
        .at(-1)!
        .submitted_at!.localeCompare(a.submitted.at(-1)!.submitted_at!),
    )
    .slice(0, 5);
  const assessedConcepts = metrics.concepts.filter(
    (c) => c.latest.accepted_students > 0,
  ).length;

  return (
    <TeacherFrame>
      <header className="lp-page-heading lp-teacher-title-row">
        <div>
          <p className="lp-eyebrow">Your classroom</p>
          <h1 className="lp-title">Class overview</h1>
          <p className="lp-intro">
            Pick the next teaching action, then inspect the evidence behind it.
          </p>
        </div>
        <Link className="lp-button" href={assignment}>
          <Icon name="book" /> Review assignment
        </Link>
      </header>
      <TeacherFiltersForm
        action="/teacher"
        assignments={assignments}
        assignment={data.assignment_id}
        origin={origin}
      />
      <div className="lp-teacher-context">
        <strong>{data.class_name}</strong>
        <span>{data.title}</span>
        <span className="lp-badge lp-badge-neutral">
          {origin === "all"
            ? "Mixed demo evidence"
            : origin === "live_demo"
              ? "Live demo evidence"
              : "Synthetic histories"}
        </span>
      </div>
      <section
        className="lp-teacher-focus"
        aria-labelledby="teacher-focus-title"
      >
        <div className="lp-teacher-section-heading">
          <div>
            <p className="lp-eyebrow">Start here</p>
            <h2 id="teacher-focus-title">What needs your attention</h2>
          </div>
        </div>
        <div className="lp-teacher-task-grid">
          <article className="lp-teacher-task lp-teacher-task-highlight">
            <p className="lp-eyebrow">Review student reasoning</p>
            <h3>
              {patterns.length
                ? "What do students’ explanations tell us?"
                : "Start with the student evidence"}
            </h3>
            <p>
              {patterns.length
                ? `${studentsWithPatterns} distinct students have recorded evidence across ${patterns.length} possible reasoning patterns. Read their explanations before deciding what to revisit.`
                : "No possible patterns are recorded in this view yet. Look at individual responses and feedback as students work through the assignment."}
            </p>
            <div className="lp-teacher-task-footer">
              <span>Observations to inspect, not fixed student labels</span>
              <Link
                href={`${insights}#${patterns.length ? "patterns" : "responses"}`}
                className="lp-text-link"
              >
                Review explanations <Icon name="arrow" />
              </Link>
            </div>
          </article>
          <article className="lp-teacher-task">
            <p className="lp-eyebrow">Prepare learning</p>
            <h3>{data.title}</h3>
            <p>
              Review the assigned reading, learning goals, and prepared
              practice. Your classroom approval controls when students can
              begin.
            </p>
            <div className="lp-teacher-task-footer">
              <Link className="lp-text-link" href={assignment}>
                Review assignment <Icon name="arrow" />
              </Link>
            </div>
          </article>
        </div>
      </section>
      <section
        className="lp-panel lp-teacher-snapshot"
        aria-labelledby="snapshot-title"
      >
        <div className="lp-teacher-section-heading">
          <div>
            <p className="lp-eyebrow">At a glance</p>
            <h2 id="snapshot-title">Your class, in context</h2>
            <p>Use the learning evidence to decide where to look next.</p>
          </div>
          <Link className="lp-text-link" href={insights}>
            Explore learning insights <Icon name="arrow" />
          </Link>
        </div>
        <div className="lp-teacher-stat-strip">
          <div>
            <span className="lp-teacher-stat-icon">
              <Icon name="users" />
            </span>
            <div>
              <strong>
                {metrics.participation.numerator}{" "}
                <small>of {metrics.enrolled_students}</small>
              </strong>
              <span>Students with submitted answers</span>
            </div>
          </div>
          <div>
            <span className="lp-teacher-stat-icon">
              <Icon name="book" />
            </span>
            <div>
              <strong>
                {assessedConcepts} <small>of {metrics.concepts.length}</small>
              </strong>
              <span>Concepts with assessed answers</span>
            </div>
          </div>
        </div>
        <div className="lp-teacher-snapshot-columns">
          <section>
            <h3>Latest concept results</h3>
            <p className="lp-panel-description">
              Correct among assessed students; includes answers after help.
            </p>
            <div className="lp-teacher-concept-list">
              {metrics.concepts.map((concept) => (
                <Link
                  key={concept.concept_id}
                  className="lp-teacher-concept-link"
                  href={`${insights}&concept=${encodeURIComponent(concept.concept_id)}#concept-${concept.concept_id}`}
                >
                  <div>
                    <strong>
                      {content.concepts.get(concept.concept_id)?.title ??
                        concept.concept_id}
                    </strong>
                    <small>
                      {concept.latest.correct_rate.denominator
                        ? `${concept.latest.correct_rate.numerator} of ${concept.latest.correct_rate.denominator} correct · ${concept.latest.uncertain} uncertain`
                        : "No assessed answers yet"}
                    </small>
                    {concept.latest.correct_rate.denominator > 0 && (
                      <progress
                        className="lp-progress"
                        aria-label={`${content.concepts.get(concept.concept_id)?.title ?? concept.concept_id}: correct among assessed students`}
                        max={concept.latest.correct_rate.denominator}
                        value={concept.latest.correct_rate.numerator}
                      />
                    )}
                  </div>
                  <Icon name="arrow" />
                </Link>
              ))}
            </div>
          </section>
          <section>
            <h3>Recent student work</h3>
            <p className="lp-panel-description">
              Open a session to read the original responses and feedback.
            </p>
            {recentWork.length ? (
              <ul className="lp-teacher-recent-list">
                {recentWork.map(({ session, submitted }) => {
                  const student = data.students.find(
                    (s) => s.student_id === session.student_id,
                  );
                  const name = student?.display_name ?? "Enrolled student";
                  return (
                    <li key={session.id}>
                      <Link
                        className="lp-teacher-work-link"
                        href={`/teacher/sessions/${session.id}`}
                      >
                        <span className="lp-avatar" aria-hidden="true">
                          {name
                            .split(/\s+/)
                            .map((part) => part[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <span>
                          <strong>{name}</strong>
                          <small>
                            {submitted.length} responses ·{" "}
                            {originLabel(session.data_origin)}
                          </small>
                          <small>{date(submitted.at(-1)!.submitted_at!)}</small>
                        </span>
                        <Icon name="arrow" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="lp-empty-results">
                No submitted responses in this view yet.
              </p>
            )}
            <Link
              className="lp-text-link lp-teacher-directory-link"
              href={directory}
            >
              View students <Icon name="arrow" />
            </Link>
          </section>
        </div>
        <p className="lp-teacher-snapshot-note">
          {evidenceDescription(origin)} {metrics.no_activity_students} students
          have no submitted answers in this view. Missing answers are not
          incorrect answers.
        </p>
      </section>
      <p className="lp-teacher-footnote">
        Immediate success after feedback does not establish lasting
        understanding. Prepared histories are illustrative, not measured
        classroom outcomes.
      </p>
    </TeacherFrame>
  );
}
