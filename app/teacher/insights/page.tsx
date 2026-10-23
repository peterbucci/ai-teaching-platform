import Link from "next/link";
import { Icon } from "../../components/icons.tsx";

import { calculatePatterns } from "../../../lib/teacher/patterns.ts";
import { Patterns } from "../patterns.tsx";
import { loadTeacherView } from "../data.ts";
import { TeacherFiltersForm } from "../filters.tsx";
import {
  TeacherFrame,
  ResultSummary,
  date,
  label,
  originLabel,
} from "../presentation.tsx";

export const dynamic = "force-dynamic";
export default async function TeacherInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{
    assignment?: string;
    origin?: string;
    concept?: string;
  }>;
}) {
  const params = await searchParams;
  const { assignments, origin, data } = await loadTeacherView(params);
  if (!data)
    return (
      <TeacherFrame section="Learning insights">
        <h1 className="text-3xl font-semibold">No teaching assignments yet</h1>
        <p className="mt-4">
          This account has no class assignments to inspect. Check that you’re
          signed in with your teacher account.
        </p>
      </TeacherFrame>
    );
  const { content } = data;
  const { metrics } = data;
  const href = (concept?: string) =>
    `/teacher/insights?${new URLSearchParams({ assignment: data.assignment_id, origin, ...(concept ? { concept } : {}) })}`;
  const students = data.students.map((student) => ({
    ...student,
    sessions: data.evidence
      .filter(
        (e) =>
          e.session.student_id === student.student_id &&
          (!params.concept ||
            e.attempts.some((a) =>
              a.question.concept_ids.includes(params.concept!),
            )),
      )
      .sort((a, b) => b.session.started_at.localeCompare(a.session.started_at)),
  }));
  const withSessions = students.filter(
    (student) => student.sessions.length > 0,
  );
  const withoutSessions = students.filter(
    (student) => student.sessions.length === 0,
  );
  const assessedConcepts = metrics.concepts.filter(
    (c) => c.latest.accepted_students > 0,
  ).length;
  const conceptResults = [...metrics.concepts].sort(
    (a, b) =>
      Number(b.latest.no_response < metrics.enrolled_students) -
      Number(a.latest.no_response < metrics.enrolled_students),
  );
  const sourceDescription =
    origin === "live_demo"
      ? "Showing live test sessions from fictional student accounts."
      : origin === "synthetic_fixture"
        ? "Showing prepared class examples and software-test histories."
        : "Showing live test sessions and prepared class examples together.";
  function sessionLink({
    session,
    attempts,
  }: (typeof withSessions)[number]["sessions"][number]) {
    return (
      <li key={session.id} className="lp-session-row">
        <div>
          <span
            className={`lp-badge${session.data_origin === "synthetic_fixture" ? " lp-badge-neutral" : ""}`}
          >
            {originLabel(session.data_origin)}
          </span>
          <small>
            {label(session.status)} ·{" "}
            {attempts.filter((a) => a.submitted_at).length} responses ·{" "}
            {date(session.started_at)}
          </small>
        </div>
        <Link href={`/teacher/sessions/${session.id}`} className="lp-text-link">
          Inspect session
          <Icon name="arrow" />
        </Link>
      </li>
    );
  }
  return (
    <TeacherFrame section="Learning insights">
      <header className="lp-page-heading">
        <p className="lp-eyebrow">Classroom evidence</p>
        <h1 className="lp-title">Learning insights</h1>
        <p className="lp-intro">
          Explore how students reason about the material, and the work behind
          each result.
        </p>
      </header>
      <TeacherFiltersForm
        action="/teacher/insights"
        assignments={assignments}
        assignment={data.assignment_id}
        origin={origin}
      />
      <p className="lp-view-context">{sourceDescription}</p>
      <nav
        className="lp-insight-sections"
        aria-label="Learning insights sections"
      >
        <a href="#concepts">Concept results</a>
        <a href="#patterns">Reasoning patterns</a>
        <a href="#responses">Student responses</a>
      </nav>
      <div className="lp-panel lp-overview-summary">
        <div>
          <span className="lp-summary-value">
            {metrics.participation.numerator}{" "}
            <span>of {metrics.enrolled_students}</span>
          </span>
          <h2>Students answered</h2>
          <p>{metrics.no_activity_students} without answers in this view</p>
        </div>
        <div>
          <span className="lp-summary-value">
            {assessedConcepts} <span>of {metrics.concepts.length}</span>
          </span>
          <h2>Concepts assessed</h2>
          <p>Based on the latest answers</p>
        </div>
      </div>
      <section id="concepts" className="lp-panel lp-concept-overview">
        <div className="lp-panel-heading">
          <h2>Results by concept</h2>
          <span className="lp-badge lp-badge-neutral">Latest answers</span>
        </div>
        <p className="lp-panel-description">
          Includes answers after help. Open a concept to compare.
        </p>
        <div className="lp-concept-list">
          {conceptResults.map((c) => {
            const result = c.latest;
            const assessed = result.correct_rate.denominator;
            const waiting =
              result.pending + result.evaluation_failed + result.rejected;
            return (
              <details
                key={c.concept_id}
                id={`concept-${c.concept_id}`}
                className="lp-concept-detail"
                open={params.concept === c.concept_id}
              >
                <summary>
                  <span className="lp-concept-name">
                    {content.concepts.get(c.concept_id)?.title ?? c.concept_id}
                  </span>
                  <span className="lp-concept-score">
                    {assessed > 0 ? (
                      <>
                        <strong>
                          {result.correct_rate.numerator} of {assessed} correct
                        </strong>
                        <progress
                          className="lp-progress"
                          aria-label={`${content.concepts.get(c.concept_id)?.title ?? c.concept_id}: correct among assessed students`}
                          value={result.correct_rate.numerator}
                          max={assessed}
                        />
                      </>
                    ) : (
                      <span className="lp-unassessed">
                        {waiting > 0
                          ? "Awaiting a valid result"
                          : "Not assessed"}
                      </span>
                    )}
                    {result.uncertain > 0 && (
                      <span className="lp-result-flag">
                        {result.uncertain} uncertain
                      </span>
                    )}
                    {result.pending > 0 && (
                      <span className="lp-result-flag">
                        {result.pending} awaiting evaluation
                      </span>
                    )}
                    {result.evaluation_failed > 0 && (
                      <span className="lp-result-flag">
                        {result.evaluation_failed} evaluation failed
                      </span>
                    )}
                    {result.rejected > 0 && (
                      <span className="lp-result-flag">
                        {result.rejected} evaluation rejected
                      </span>
                    )}
                  </span>
                  <span className="lp-expand-icon" aria-hidden="true">
                    +
                  </span>
                </summary>
                <div className="lp-concept-breakdown">
                  <h3>Latest answers</h3>
                  <ResultSummary results={result} />
                  {c.repeated_difficulty.denominator > 0 && (
                    <p className="lp-result-note">
                      {c.repeated_difficulty.numerator} of{" "}
                      {c.repeated_difficulty.denominator} assessed students had
                      repeated partial or incorrect answers.
                    </p>
                  )}
                  <div className="lp-comparison-grid">
                    {(
                      [
                        ["Without help", c.independent],
                        ["After help", c.content_assisted],
                        ["Immediate retest", c.immediate_retest],
                        ["Later review", c.delayed_review],
                      ] as const
                    ).map(([name, result]) => (
                      <section key={name}>
                        <h4>{name}</h4>
                        <ResultSummary results={result} />
                      </section>
                    ))}
                  </div>
                  <a
                    href={href(c.concept_id) + "#responses"}
                    className="lp-text-link"
                  >
                    See student responses
                    <Icon name="arrow" />
                  </a>
                </div>
              </details>
            );
          })}
        </div>
        <details className="lp-results-help">
          <summary>How to read these results</summary>
          <p>
            Each concept uses the latest submitted answer per student. “Correct”
            is out of students with an assessed answer, including uncertain
            results. Pending, failed, and rejected evaluations are listed
            separately. Missing answers are not incorrect answers.
          </p>
          <p>
            Answers after help and immediate retests do not establish lasting
            understanding. Later reviews in prepared examples are illustrative.
          </p>
          <p>
            This view includes {metrics.origins.live_demo} students with live
            test responses and {metrics.origins.synthetic_fixture} with prepared
            histories. These groups can overlap. Prepared histories are invented
            or replayed examples, not measured learning outcomes.
          </p>
        </details>
      </section>
      <Patterns
        groups={calculatePatterns(
          data.students.map((s) => s.student_id),
          new Set(data.approved_misconception_ids),
          data.evidence,
        )}
        students={data.students}
        content={content}
      />
      <section id="responses" className="lp-panel lp-responses">
        <h2>Student responses</h2>
        <p className="lp-panel-description mb-5">
          {params.concept
            ? `Showing ${content.concepts.get(params.concept)?.title ?? params.concept}. `
            : "Open a session to see the student's answers and feedback. "}
          {params.concept && (
            <a href={href() + "#responses"} className="underline">
              Show all concepts
            </a>
          )}
        </p>
        {withSessions.length === 0 && (
          <p className="lp-empty-results">No sessions in this view yet.</p>
        )}
        <ul>
          {withSessions.map((student) => (
            <li key={student.student_id} className="lp-student-row">
              <h3 className="lp-student-name">
                <span className="lp-avatar" aria-hidden="true">
                  {student.display_name
                    .split(/\s+/)
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <span>{student.display_name}</span>
              </h3>
              <div>
                <ul>{sessionLink(student.sessions[0])}</ul>
                {student.sessions.length > 1 && (
                  <details className="lp-previous-sessions">
                    <summary>
                      {student.sessions.length - 1} earlier sessions
                    </summary>
                    <ul>{student.sessions.slice(1).map(sessionLink)}</ul>
                  </details>
                )}
              </div>
            </li>
          ))}
        </ul>
        {withoutSessions.length > 0 && (
          <details className="lp-results-help">
            <summary>
              {withoutSessions.length} students without sessions in this view
            </summary>
            <ul className="lp-no-sessions">
              {withoutSessions.map((student) => (
                <li key={student.student_id}>{student.display_name}</li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </TeacherFrame>
  );
}
