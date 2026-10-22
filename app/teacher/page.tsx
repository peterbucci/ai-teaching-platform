import Link from "next/link";
import { Icon } from "../components/icons.tsx";
import { loadApprovedContent } from "../../lib/evidence/content.ts";
import { loadTeacherEvidence, type TeacherParams } from "./data.ts";
import { NoTeachingAssignments, TeacherFilters } from "./filters.tsx";
import { TeacherFrame, ResultSummary } from "./presentation.tsx";

export const dynamic = "force-dynamic";
export default async function TeacherPage({
  searchParams,
}: {
  searchParams: Promise<TeacherParams>;
}) {
  const { assignments, origin, data } = await loadTeacherEvidence(
    await searchParams,
  );
  if (!data)
    return (
      <TeacherFrame>
        <NoTeachingAssignments />
      </TeacherFrame>
    );
  const content = loadApprovedContent();
  const { metrics } = data;
  const context = { assignment: data.assignment_id, origin };
  const href = (concept: string) =>
    `/teacher/evidence?${new URLSearchParams({ ...context, concept })}`;
  const assessedConcepts = metrics.concepts.filter(
    (c) => c.latest.accepted_students > 0,
  ).length;
  const conceptResults = [...metrics.concepts].sort(
    (a, b) =>
      Number(b.latest.no_response < metrics.enrolled_students) -
      Number(a.latest.no_response < metrics.enrolled_students),
  );
  return (
    <TeacherFrame context={context}>
      <header className="lp-page-heading">
        <h1 className="lp-title">Class overview</h1>
        <p className="lp-intro">
          See how students answered. Open their work for the full story.
        </p>
      </header>
      <TeacherFilters
        action="/teacher"
        assignments={assignments}
        assignment={data.assignment_id}
        origin={origin}
      />
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
      <section className="lp-panel lp-concept-overview">
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
              <details key={c.concept_id} className="lp-concept-detail">
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
                  <Link href={href(c.concept_id)} className="lp-text-link">
                    See student responses
                    <Icon name="arrow" />
                  </Link>
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
    </TeacherFrame>
  );
}
