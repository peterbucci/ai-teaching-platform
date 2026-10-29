import type { ReactNode } from "react";
import type { StudentIntervention } from "../../../../lib/interventions/approval-contracts.ts";
import {
  linkedReviewFollowup,
  reviewHref,
  reviewReadingLinks,
  reviewStatus,
  reviewTime,
  type ReviewFollowupState,
  type ReviewSummaryIntervention,
} from "./presentation.ts";

export type TeacherReviewProps = {
  intervention: StudentIntervention;
  followup?: ReviewFollowupState;
  conceptNames?: Readonly<Record<string, string>>;
};

export type TeacherReviewSummaryProps = {
  intervention: ReviewSummaryIntervention;
  followup?: ReviewFollowupState;
};

export function ReviewActivityStatus({
  intervention,
  followup = { status: "not_loaded" },
}: TeacherReviewSummaryProps) {
  const status = reviewStatus(intervention, followup);
  return (
    <div
      className="sn-reviews sn-review-status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy={status.key === "loading"}
    >
      <span className={`sn-review-badge sn-review-${status.tone}`}>
        {status.label}
      </span>
      <p className="sn-review-small">{status.description}</p>
    </div>
  );
}

/** Summaries deliberately omit explanation, quotes and question content: no hidden help delivery. */
export function TeacherReviewSummary({
  intervention,
  followup,
}: TeacherReviewSummaryProps) {
  const status = reviewStatus(intervention, followup);
  const label =
    status.key === "started"
      ? "Continue review"
      : status.key === "accepted"
        ? "Open review and feedback"
        : "Open review";
  return (
    <div className="sn-reviews sn-review-card">
      <article
        className={`sn-reviews sn-review-row${intervention.displayed_at === null ? " sn-review-new" : ""}`}
      >
        <div className="sn-review-stack">
          <div className="sn-review-inline">
            <span className="sn-review-kind">Teacher review</span>
            <span className="sn-review-small">
              Delivered ·{" "}
              <time dateTime={intervention.delivered_at}>
                {reviewTime(intervention.delivered_at)}
              </time>
            </span>
          </div>
          <h3 className="sn-review-title">{intervention.activity.title}</h3>
          <p className="sn-review-prose sn-review-summary-objective">
            {intervention.activity.learning_objective}
          </p>
          <details className="sn-review-card-details">
            <summary>Delivery and saved status</summary>
            <p className="sn-review-small">
              {intervention.displayed_at ? (
                <>
                  Viewing recorded ·{" "}
                  <time dateTime={intervention.displayed_at}>
                    {reviewTime(intervention.displayed_at)}
                  </time>
                </>
              ) : (
                "Viewing not yet recorded"
              )}
            </p>
            <ReviewActivityStatus
              intervention={intervention}
              followup={followup}
            />
          </details>
        </div>
        <div className="sn-review-actions">
          <a
            className="sn-review-button"
            href={reviewHref(intervention)}
            aria-label={`${label}: ${intervention.activity.title}`}
          >
            {label}
          </a>
        </div>
      </article>
    </div>
  );
}

export function TeacherReviewList({
  interventions,
  status = "ready",
}: {
  interventions: readonly ReviewSummaryIntervention[];
  status?: "ready" | "loading" | "unavailable";
}) {
  return (
    <section className="sn-reviews" aria-label="From your teacher">
      <div className="sn-review-section-heading">
        <h2>From your teacher</h2>
        <span className="sn-review-small">Teacher-assigned reviews</span>
      </div>
      {status !== "ready" ? (
        <ReviewEmptyState status={status} />
      ) : interventions.length === 0 ? (
        <ReviewEmptyState status="empty" />
      ) : (
        <ul className="sn-review-list">
          {interventions.map((intervention) => (
            <li key={intervention.approval_id}>
              <TeacherReviewSummary intervention={intervention} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Links only: the reader/shared activity retains ownership of excerpt display receipts. */
export function ReviewSourceReferences({
  intervention,
}: Pick<TeacherReviewProps, "intervention">) {
  const ref = intervention.content_ref;
  const links = reviewReadingLinks(intervention);
  return (
    <section
      className="sn-reviews sn-review-panel"
      aria-label="Review reading and source"
    >
      <h3>From your reading</h3>
      {"source_kind" in ref && (
        <p className="sn-review-prose">
          {ref.attribution.title} · {ref.attribution.section}
        </p>
      )}
      {links.length ? (
        <ul className="sn-review-source-links">
          {links.map((source) => (
            <li key={source.passageId}>
              <a href={source.href}>Open {source.passageId} in the reader</a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sn-review-small">
          No source references are available for this review.
        </p>
      )}
      <details className="sn-review-source-identity">
        <summary>Exact source and version</summary>
        <dl>
          <dt>Content version</dt>
          <dd>{ref.content_version}</dd>
          <dt>Source</dt>
          <dd>{ref.source_id}</dd>
          {"source_kind" in ref ? (
            <>
              <dt>Source version</dt>
              <dd>{ref.source_version}</dd>
              <dt>Document hash</dt>
              <dd>{ref.document_sha256}</dd>
            </>
          ) : (
            <>
              <dt>Source revision</dt>
              <dd>{ref.source_commit}</dd>
            </>
          )}
          <dt>Excerpt hash</dt>
          <dd>{ref.excerpt_sha256}</dd>
        </dl>
      </details>
    </section>
  );
}

const resultLabels = {
  correct: "Correct on this check",
  partially_correct: "Partly correct on this check",
  incorrect: "Incorrect on this check",
  uncertain: "Uncertain",
};
const assistanceLabels = {
  none_recorded: "No content assistance recorded",
  prompt_supplied_content: "Content supplied in the prompt",
  reading: "Reading assistance recorded",
  hint: "Hint recorded",
  worked_example: "Worked example recorded",
  corrective_feedback: "Corrective feedback recorded",
  multiple_types: "Multiple types of assistance recorded",
};

/** Render only the student-safe accepted projection, never a rejected evaluator payload. */
export function ReviewFeedback({
  intervention,
  followup = { status: "not_loaded" },
  conceptNames = {},
}: TeacherReviewProps) {
  const saved = linkedReviewFollowup(intervention, followup);
  if (!saved || reviewStatus(intervention, followup).key !== "accepted")
    return null;
  return (
    <section
      className="sn-reviews sn-review-panel sn-review-feedback"
      aria-label="Accepted fresh-check feedback"
    >
      <h3>Feedback on your fresh check</h3>
      {saved.uncertain && (
        <p className="sn-review-caution">
          This evaluation has uncertainty. Review the result with your teacher.
        </p>
      )}
      {saved.feedback !== null ? (
        <p className="sn-review-prose">{saved.feedback}</p>
      ) : (
        <p className="sn-review-small">No written feedback is available.</p>
      )}
      {saved.results.length ? (
        <ul className="sn-review-results">
          {saved.results.map((result) => (
            <li key={result.concept_id}>
              <span>
                {Object.hasOwn(conceptNames, result.concept_id)
                  ? conceptNames[result.concept_id]
                  : "Concept name unavailable"}
              </span>
              <strong
                className={`sn-review-result sn-review-result-${result.correctness}`}
              >
                {resultLabels[result.correctness]}
              </strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sn-review-small">No concept results are available.</p>
      )}
      <p className="sn-review-small">
        {saved.assistance
          ? assistanceLabels[saved.assistance.assistance_level]
          : "Assistance information unavailable"}
      </p>
      <p className="sn-review-small">
        One fresh-check result does not establish lasting mastery or retention.
      </p>
      {saved.evaluation_provenance === "injected_fixture" && (
        <p className="sn-review-small">Synthetic fixture evaluation</p>
      )}
    </section>
  );
}

/** Read-only record. Start, submit, retry and reconcile remain in DeliveredActivity. */
export function LinkedReviewFollowup({
  intervention,
  followup = { status: "not_loaded" },
  conceptNames,
}: TeacherReviewProps) {
  const saved = linkedReviewFollowup(intervention, followup);
  const submitted = saved?.attempt_id && saved.submitted_at;
  return (
    <section
      className="sn-reviews sn-review-panel"
      aria-label="Linked fresh-check response"
    >
      <h3>Your fresh-check response</h3>
      <ReviewActivityStatus intervention={intervention} followup={followup} />
      {submitted && (
        <>
          <p className="sn-review-small">
            Submitted ·{" "}
            <time dateTime={saved.submitted_at ?? undefined}>
              {reviewTime(submitted)}
            </time>
          </p>
          <h4>Your original answer</h4>
          {saved.response_text !== null ? (
            <blockquote className="sn-review-answer">
              {saved.response_text}
            </blockquote>
          ) : (
            <p className="sn-review-small">
              The original response is unavailable.
            </p>
          )}
        </>
      )}
      <ReviewFeedback
        intervention={intervention}
        followup={followup}
        conceptNames={conceptNames}
      />
      <a className="sn-review-link" href={reviewHref(intervention)}>
        Open the linked review
      </a>
    </section>
  );
}

/** Mount ONE existing activity controller in this visible slot; never a second composer. */
export function TeacherReviewFrame({
  intervention,
  children,
  embedded = false,
}: Pick<TeacherReviewProps, "intervention"> & {
  children: ReactNode;
  embedded?: boolean;
}) {
  return (
    <div className="sn-reviews sn-review-detail">
      <header className="sn-review-stack">
        <span className="sn-review-kind">Teacher-assigned review</span>
        {!embedded && <h1>{intervention.activity.title}</h1>}
        <p className="sn-review-small">
          Delivered ·{" "}
          <time dateTime={intervention.delivered_at}>
            {reviewTime(intervention.delivered_at)}
          </time>
        </p>
        <p className="sn-review-small">
          Your teacher chose and approved this activity. Opening it does not
          submit an answer.
        </p>
      </header>
      <div className="sn-review-controller" id="review-activity" tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}

export function ReviewEmptyState({
  status,
}: {
  status: "empty" | "loading" | "unavailable";
}) {
  const content = {
    empty: [
      "No teacher-assigned reviews",
      "When your teacher delivers a review to you, it will appear here.",
    ],
    loading: [
      "Loading teacher-assigned reviews…",
      "Your saved work is unchanged.",
    ],
    unavailable: [
      "Reviews are unavailable",
      "We couldn’t load your reviews. Refresh the page to try again; this does not submit an answer.",
    ],
  }[status];
  return (
    <div
      className="sn-reviews sn-review-panel"
      role="status"
      aria-busy={status === "loading"}
    >
      <h3>{content[0]}</h3>
      <p className="sn-review-small">{content[1]}</p>
    </div>
  );
}
