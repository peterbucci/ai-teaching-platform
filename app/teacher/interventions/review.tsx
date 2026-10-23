import Link from "next/link";
import type { QuestionSnapshot } from "../../../lib/evidence/contracts.ts";
import type {
  InterventionActivity,
  InterventionEvidence,
} from "../../../lib/interventions/contracts.ts";

const roleLabels = {
  supporting: "Reason to review",
  contradictory: "Counterevidence",
  context: "Context / uncertainty",
};

export function EvidenceReview({
  evidence,
  selectedIds,
  onToggle,
  locked = false,
}: {
  evidence: InterventionEvidence;
  selectedIds: string[];
  onToggle?: (id: string) => void;
  locked?: boolean;
}) {
  return (
    <section
      className="lp-panel lp-intervention-panel"
      aria-labelledby="intervention-evidence-title"
    >
      <h2 id="intervention-evidence-title">Recorded learning evidence</h2>
      <p>
        {evidence.counts.selected_students} distinct students ·{" "}
        {evidence.counts.selected_responses} responses ·{" "}
        {evidence.counts.enrolled_students} enrolled
      </p>
      <p className="lp-intervention-meta">{evidence.scope_note}</p>
      {onToggle && (
        <p className="lp-intervention-note">
          Use all evidence for this concept, or choose responses below. Related
          answers by the same students remain included so that later success and
          contradictory evidence are preserved.
          {selectedIds.length > 0 && (
            <>
              {" "}
              You selected {selectedIds.length} starting responses; the saved
              draft shows its final evidence scope.
            </>
          )}
        </p>
      )}
      {evidence.pattern && (
        <div className="lp-intervention-note">
          <h3>Recorded pattern observations</h3>
          <p>
            Suspected: {evidence.pattern.counts.suspected} · Supported:{" "}
            {evidence.pattern.counts.supported} · Not supported:{" "}
            {evidence.pattern.counts.not_supported} · Uncertain:{" "}
            {evidence.pattern.counts.uncertain}
          </p>
          <p className="lp-intervention-meta">
            Counts are distinct students out of {evidence.pattern.denominator}.
            These are interpretations of recorded answers, not lasting labels.
          </p>
        </div>
      )}
      {evidence.observations.map((observation) => {
        const { attempt, evaluation } = observation;
        const judgment = evaluation.result?.per_concept_results.find(
          (result) => result.concept_id === evidence.concept.id,
        );
        const independent =
          attempt.assistance?.independent_retrieval_eligible_by_concept[
            evidence.concept.id
          ];
        return (
          <div
            className="lp-intervention-evidence"
            key={attempt.id}
            id={`evidence-${attempt.id}`}
          >
            {onToggle && (
              <label className="lp-intervention-choice">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(attempt.id)}
                  disabled={locked}
                  onChange={() => onToggle(attempt.id)}
                />
                <span>Use this response from {observation.student_name}</span>
              </label>
            )}
            <details>
              <summary>
                {observation.student_name}
                <span className="lp-badge lp-badge-neutral">
                  {roleLabels[observation.role]}
                </span>
              </summary>
              <p className="lp-intervention-meta">
                {observation.data_origin === "synthetic_fixture"
                  ? "Prepared fictional history"
                  : "Live fictional-student session"}{" "}
                ·{" "}
                {independent
                  ? "Independent response"
                  : "Assistance recorded / not independent"}{" "}
                · {attempt.intent.replaceAll("_", " ")}
              </p>
              <h3>Original question</h3>
              <p className="whitespace-pre-wrap">
                {attempt.question.prompt_text}
              </p>
              <h3>Original response</h3>
              <blockquote>{attempt.response_text}</blockquote>
              <h3>Accepted evaluation</h3>
              <p>{judgment?.correctness.replaceAll("_", " ")}</p>
              <p>{evaluation.result?.reasoning_observed}</p>
              {evaluation.result?.uncertainty_reason && (
                <p>
                  <strong>Uncertainty:</strong>{" "}
                  {evaluation.result.uncertainty_reason}
                </p>
              )}
              {evaluation.result?.misconception_candidates?.map(
                (candidate, index) => (
                  <p key={index}>
                    <strong>Tentative interpretation:</strong>{" "}
                    {candidate.uncertainty_reason}
                  </p>
                ),
              )}
              {evidence.pattern?.observations
                .filter((item) => item.evaluation_id === evaluation.id)
                .map((item, index) => (
                  <p key={index}>
                    <strong>{item.status.replaceAll("_", " ")}:</strong>{" "}
                    {item.reason}
                  </p>
                ))}
              <p className="lp-intervention-meta">
                Assistance:{" "}
                {attempt.assistance?.assistance_level.replaceAll("_", " ") ??
                  "Unknown"}
                . Immediate retests after help do not establish durable
                understanding.
              </p>
              <Link
                className="lp-text-link"
                href={`/teacher/sessions/${observation.session_id}#evaluation-${evaluation.id}`}
              >
                Inspect full session and assistance
              </Link>
            </details>
          </div>
        );
      })}
      <details className="lp-intervention-section">
        <summary>Approved source and lesson identity</summary>
        <p className="lp-intervention-meta">
          Package: {evidence.content_ref.package_id}
          <br />
          Lesson version: {evidence.content_ref.content_version}
          <br />
          Source: {evidence.content_ref.source_id}
          <br />
          Source revision: {evidence.content_ref.source_commit}
        </p>
        {evidence.sources.map((source) => (
          <div className="lp-intervention-source" key={source.passage_id}>
            <a
              className="lp-text-link"
              href={source.url}
              target="_blank"
              rel="noreferrer"
            >
              {source.passage_id}
            </a>
            <blockquote>{source.text}</blockquote>
          </div>
        ))}
      </details>
    </section>
  );
}

function QuestionReview({
  question,
  teacherOnly = false,
}: {
  question: QuestionSnapshot;
  teacherOnly?: boolean;
}) {
  return (
    <>
      <p className="whitespace-pre-wrap">
        {teacherOnly && <strong>Student question for context: </strong>}
        {question.prompt_text}
      </p>
      <p className="lp-intervention-meta">
        Approved passages: {question.source_passage_ids.join(", ")}
      </p>
      <details className="lp-intervention-guidance">
        <summary>Private answer guidance — teacher only</summary>
        <p className="whitespace-pre-wrap">{question.rubric.answer_guidance}</p>
        <ul>
          {question.rubric.criteria.map((criterion, index) => (
            <li key={index}>{criterion}</li>
          ))}
        </ul>
        {question.rubric.acceptable_variations.map((variation, index) => (
          <p key={index}>{variation}</p>
        ))}
        {question.rubric.partial_credit_guidance && (
          <p>{question.rubric.partial_credit_guidance}</p>
        )}
      </details>
    </>
  );
}

export function ActivityReview({
  activity,
  evidence,
  teacherOnly = false,
}: {
  activity: InterventionActivity;
  evidence: InterventionEvidence;
  teacherOnly?: boolean;
}) {
  return (
    <div>
      <h2>
        {teacherOnly
          ? "Recommendation and private answer guidance"
          : activity.title}
      </h2>
      <section className="lp-intervention-section">
        {!teacherOnly && (
          <>
            <h3>Learning objective</h3>
            <p>{activity.learning_objective}</p>
          </>
        )}
        <h3>Why this activity</h3>
        <p>{activity.rationale}</p>
        <p className="lp-intervention-note">{activity.uncertainty}</p>
      </section>
      {!teacherOnly && (
        <section className="lp-intervention-section">
          <h3>Source-grounded explanation</h3>
          <p className="whitespace-pre-wrap">{activity.explanation}</p>
          <h3>Review activity</h3>
          <p className="whitespace-pre-wrap">{activity.exercise_text}</p>
        </section>
      )}
      <section className="lp-intervention-section">
        <h3>Targeted practice</h3>
        <ol className="lp-intervention-questions">
          {activity.practice_questions.map((question, index) => (
            <li key={index}>
              <QuestionReview question={question} teacherOnly={teacherOnly} />
            </li>
          ))}
        </ol>
      </section>
      <section className="lp-intervention-section">
        <h3>Fresh check of understanding</h3>
        <QuestionReview
          question={activity.fresh_check}
          teacherOnly={teacherOnly}
        />
      </section>
      <section className="lp-intervention-section">
        <h3>Evidence used in this recommendation</h3>
        {activity.evidence_references.map((reference, index) => (
          <div className="lp-intervention-source" key={index}>
            <a
              className="lp-text-link"
              href={`#evidence-${reference.attempt_id}`}
            >
              {roleLabels[reference.role]} ·{" "}
              {
                evidence.observations.find(
                  (item) => item.attempt.id === reference.attempt_id,
                )?.student_name
              }
            </a>
            <blockquote>{reference.response_quote}</blockquote>
          </div>
        ))}
        {!teacherOnly && (
          <>
            <h3>Approved source support</h3>
            {activity.source_references.map((reference, index) => {
              const source = evidence.sources.find(
                (item) => item.passage_id === reference.passage_id,
              );
              return (
                <div className="lp-intervention-source" key={index}>
                  {source && (
                    <a
                      className="lp-text-link"
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {reference.passage_id}
                    </a>
                  )}
                  <blockquote>{reference.quote}</blockquote>
                </div>
              );
            })}
          </>
        )}
      </section>
      <section className="lp-intervention-section">
        <h3>Possible recipients for your consideration</h3>
        <p>
          These suggestions do not select or assign anyone. Review their
          evidence before choosing recipients in the separate selection below.
        </p>
        {activity.suggested_recipients.length === 0 && (
          <p>No specific students suggested.</p>
        )}
        <ul>
          {activity.suggested_recipients.map((recipient) => (
            <li key={recipient.student_id} className="mt-3">
              <strong>
                {evidence.observations.find(
                  (item) => item.student_id === recipient.student_id,
                )?.student_name ?? "Enrolled student"}
              </strong>
              <p>{recipient.reason}</p>
              {recipient.evidence_attempt_ids.map((id, index) => (
                <a
                  key={id}
                  href={`#evidence-${id}`}
                  className="lp-text-link mr-3"
                >
                  Inspect response {index + 1}
                </a>
              ))}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
