import type {
  NotebookPage,
  NotebookEvent,
  StudentNotebook,
} from "../../../../lib/evidence/student-notebook-contracts.ts";
import { recordedHistoryHref } from "../recorded-history.ts";
import { assistanceLabels } from "./presentation.ts";
import styles from "./recorded.module.css";
import { ExactText } from "./exact-text.tsx";

const wording = (value: string) => value.replaceAll("_", " ");
export function currentAssessment(page: NotebookPage) {
  const state = page.assessment;
  return state.status === "accepted"
    ? page.events.find(
        (e) =>
          e.kind === "assessment_recorded" &&
          e.assessment.is_current &&
          e.assessment.evaluation_id === state.current_evaluation_id,
      )
    : undefined;
}
export function Assessment({ page }: { page: NotebookPage }) {
  const event = currentAssessment(page);
  if (event?.kind === "assessment_recorded")
    return (
      <div className={styles.results}>
        {event.assessment.results.map((result) => (
          <span key={result.concept_id} data-correctness={result.correctness}>
            {wording(result.concept_id)}:{" "}
            <strong>{wording(result.correctness)}</strong>
          </span>
        ))}
        {event.assessment.uncertainty_recorded && (
          <p>
            Uncertainty was recorded with this accepted assessment. This is not
            a definitive measure of understanding.
          </p>
        )}
      </div>
    );
  const labels = {
    not_submitted: "No submitted answer recorded",
    not_recorded: "Assessment not recorded",
    pending:
      page.assessment.status === "pending" &&
      page.assessment.outcome === "unknown"
        ? "Assessment outcome unknown"
        : "Assessment pending",
    failed: "Assessment failed · original answer remains saved",
    rejected: "Assessment could not be accepted",
    unavailable: "Accepted assessment unavailable",
    accepted: "Accepted assessment unavailable",
  };
  return <p className={styles.muted}>{labels[page.assessment.status]}</p>;
}
function Time({ value }: { value: string }) {
  // Keep precision and offset in visible text; never resort events via Date.
  return <time dateTime={value}>{value.replace("T", " ")}</time>;
}
const gaps: Record<NotebookPage["gaps"][number], string> = {
  question_view_time_not_recorded:
    "The time you actually viewed the question was not recorded.",
  clarification_wording_not_recorded:
    "The original clarification wording was not recorded.",
  message_transition_time_not_recorded:
    "Some message status changes have no recorded time.",
  display_receipt_unconfirmed:
    "A help display receipt could not be confirmed; its text is unavailable here.",
  accepted_result_unavailable: "The accepted assessment could not be verified.",
  related_record_unavailable: "A related saved record is unavailable.",
};
function EventBody({
  event,
  page,
}: {
  event: NotebookEvent;
  page: NotebookPage;
}) {
  switch (event.kind) {
    case "question_presented":
      return (
        <p>Question made available. This is not a recorded viewing time.</p>
      );
    case "student_message":
      return event.content.kind === "text" ? (
        <>
          <h3>Your message</h3>
          <p className={styles.original}>
            <ExactText value={event.content.text} />
          </p>
        </>
      ) : (
        <p>
          Message linked to{" "}
          <a href={`#answer-${page.attempt_id}`}>your submitted answer</a>.
        </p>
      );
    case "answer_submitted":
      return (
        <p>
          <a href={`#answer-${page.attempt_id}`}>Original answer</a> saved.
        </p>
      );
    case "help_displayed":
      return (
        <>
          <h3>Help recorded as displayed · {wording(event.aid.type)}</h3>
          <p className={styles.original} data-recorded-help>
            <ExactText value={event.aid.text} />
          </p>
          <p className={styles.muted}>
            {event.aid.counted_at_submission === true
              ? "Included in the saved submission-time assistance."
              : event.aid.counted_at_submission === false
                ? "Not included in the saved submission-time assistance."
                : "No submission-time assistance snapshot is available."}{" "}
            {event.aid.source_passage_ids.length
              ? `Source passages: ${event.aid.source_passage_ids.join(", ")}.`
              : ""}
          </p>
        </>
      );
    case "assessment_recorded":
      return (
        <>
          <h3>
            {event.assessment.is_current
              ? "Accepted assessment"
              : "Earlier accepted assessment · superseded"}
          </h3>
          <p>
            {event.assessment.results
              .map((r) => `${wording(r.concept_id)}: ${wording(r.correctness)}`)
              .join(" · ")}
          </p>
          {event.assessment.uncertainty_recorded && (
            <p>Uncertainty recorded.</p>
          )}
        </>
      );
    case "evaluation_status_recorded":
      return (
        <p>
          Evaluation status: {wording(event.status)}. This status does not
          replace an accepted assessment.
        </p>
      );
    case "intent_clarification_requested":
      return <p>Clarification requested. Exact wording is not available.</p>;
    case "intent_resolved":
      return (
        <p>
          You confirmed this message as{" "}
          {event.choice === "answer" ? "an answer" : "a help request"}.
        </p>
      );
    case "message_cancelled":
      return <p>Message cancelled.</p>;
    case "message_unavailable":
      return <p>Message unavailable · {wording(event.reason)}.</p>;
  }
}
export function RecordedQuestionPage({
  dto,
  page,
}: {
  dto: StudentNotebook;
  page: NotebookPage;
}) {
  return (
    <article
      className={styles.paper}
      id={`question-${page.attempt_id}`}
      tabIndex={-1}
      data-recorded-question={page.attempt_id}
    >
      <header className={styles.paperHeader}>
        <span className={styles.kind}>{wording(page.intent)}</span>
        <span className={styles.muted}>
          Recorded question {page.sequence_index + 1}
        </span>
      </header>
      <h2 className={styles.prompt} data-original-prompt>
        <ExactText value={page.question.prompt_text} />
      </h2>
      <p className={styles.muted}>
        Question made available <Time value={page.question.presented_at} />
      </p>
      <section
        className={styles.answer}
        id={`answer-${page.attempt_id}`}
        tabIndex={-1}
      >
        <h3>Your original answer</h3>
        {page.submission ? (
          <>
            <p className={styles.original} data-original-response>
              <ExactText value={page.submission.response_text} />
            </p>
            {page.submission.response_text === "" && (
              <p className={styles.muted}>An empty answer was saved.</p>
            )}
            <p className={styles.muted}>
              Submitted <Time value={page.submission.submitted_at} />
            </p>
            <p className={styles.assistance}>
              {
                assistanceLabels[
                  page.submission.assistance_at_submission.assistance_level
                ]
              }{" "}
              at submission
            </p>
          </>
        ) : (
          <p>
            No submitted answer is recorded. Unsent text is not part of saved
            history.
          </p>
        )}
      </section>
      <section className={styles.block}>
        <h3>Recorded assessment</h3>
        <Assessment page={page} />
      </section>
      <section className={styles.block}>
        <h3>Recorded events</h3>
        <p className={styles.muted}>
          Stored time order. Equal times use a stable tie order, not a claim
          about which caused which.
        </p>
        <ol className={styles.timeline}>
          {page.events.map((event) => (
            <li key={event.event_id} data-recorded-event={event.event_id}>
              <div className={styles.eventTime}>
                <Time value={event.recorded_at} />
                {event.order_basis === "stable_tie" && (
                  <span> · equal-time record</span>
                )}
              </div>
              <EventBody event={event} page={page} />
            </li>
          ))}
        </ol>
      </section>
      {!!page.pending_deliveries.length && (
        <section className={styles.notice}>
          <h3>Help without a confirmed display</h3>
          <p>
            Generated or prepared help is not evidence that you saw it. Its body
            is not replayed here.
          </p>
          <ul>
            {page.pending_deliveries.map((item) => (
              <li key={item.intervention_id}>{wording(item.state)}</li>
            ))}
          </ul>
        </section>
      )}
      {!!page.messages.length && (
        <details className={styles.block}>
          <summary>Saved message statuses</summary>
          <p className={styles.muted}>
            Current saved statuses; these do not add events or inferred times.
          </p>
          <ul>
            {page.messages.map((m, index) => (
              <li key={m.request_id}>
                Message {index + 1}: {wording(m.state)} · execution{" "}
                {wording(m.execution)}
              </li>
            ))}
          </ul>
        </details>
      )}
      <section className={styles.block}>
        <h3>Related recorded work</h3>
        <ul className={styles.links}>
          {page.parent_attempt_id && (
            <li>
              <a
                href={recordedHistoryHref(
                  dto.session.id,
                  page.parent_attempt_id,
                )}
              >
                Original parent question
              </a>
            </li>
          )}
          {page.review_of && (
            <li>
              <a
                href={recordedHistoryHref(
                  page.review_of.session_id,
                  page.review_of.attempt_id,
                )}
              >
                Earlier question linked to this check
              </a>
            </li>
          )}
          {page.subsequent.map((item) => (
            <li key={`${item.relation}/${item.target.attempt_id}`}>
              <a
                href={recordedHistoryHref(
                  item.target.session_id,
                  item.target.attempt_id,
                )}
              >
                {item.relation === "child_attempt"
                  ? "Linked follow-up question"
                  : "Linked later check"}
              </a>
            </li>
          ))}
          {page.teacher_reviews.map((review) => (
            <li key={review.approval_id}>
              <a href={review.href}>Teacher review linked to this work</a>
              {review.followup && (
                <>
                  {" "}
                  ·{" "}
                  <a href={review.followup.href}>
                    Review and saved fresh check
                  </a>
                </>
              )}
              <p className={styles.muted}>
                Delivered <Time value={review.delivered_at} />. Delivery alone
                does not establish completion.
              </p>
            </li>
          ))}
        </ul>
        {!page.parent_attempt_id &&
          !page.review_of &&
          !page.subsequent.length &&
          !page.teacher_reviews.length && (
            <p className={styles.muted}>
              No authoritative related-work link is available.
            </p>
          )}
      </section>
      <details className={styles.block}>
        <summary>Source and saved identities</summary>
        <dl className={styles.context}>
          <dt>Assignment label (current)</dt>
          <dd>{page.source.title}</dd>
          <dt>Lesson version</dt>
          <dd>
            {page.source.lesson_id} · {page.source.lesson_version}
          </dd>
          <dt>Content version</dt>
          <dd>{page.source.content_ref.content_version}</dd>
          {"source_version" in page.source.content_ref && (
            <>
              <dt>Source version</dt>
              <dd>
                {page.source.content_ref.source_id} ·{" "}
                {page.source.content_ref.source_version}
              </dd>
            </>
          )}
          <dt>Question</dt>
          <dd>{page.question.question_id ?? "Generated question"}</dd>
          <dt>Passages</dt>
          <dd>
            {page.question.source_passage_ids.join(", ") || "None recorded"}
          </dd>
          <dt>Attempt</dt>
          <dd>{page.attempt_id}</dd>
          <dt>Session</dt>
          <dd>{dto.session.id}</dd>
        </dl>
      </details>
      {!!page.gaps.length && (
        <details className={styles.block}>
          <summary>What this history cannot show</summary>
          <ul>
            {page.gaps.map((gap) => (
              <li key={gap}>{gaps[gap]}</li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
