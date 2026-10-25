"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  InterventionComparisonSchema,
  type InterventionComparison,
  type StudentInterventionFollowup,
} from "../../../lib/interventions/outcomes-contracts.ts";
import type {
  Evaluation,
  QuestionSnapshot,
} from "../../../lib/evidence/contracts.ts";
import { followupConceptLabel } from "./concept-label.ts";

const statusLabels = {
  not_submitted: "No response yet",
  pending: "Evaluation pending",
  accepted: "Evaluation accepted",
  failed: "Evaluation failed",
};
const roleLabels = {
  supporting: "Reason to review",
  contradictory: "Counterevidence",
  context: "Context / uncertainty",
};
function EvaluationDetails({
  evaluation,
  provenance,
  comparison,
  question,
}: {
  evaluation: Evaluation | null;
  provenance?: StudentInterventionFollowup["evaluation_provenance"];
  comparison: InterventionComparison;
  question: QuestionSnapshot | null;
}) {
  if (!evaluation) return <p>No evaluation has been recorded.</p>;
  return (
    <>
      <p className="lp-intervention-meta">
        {provenance === "injected_fixture" ||
        evaluation.evaluator.type === "synthetic_fixture"
          ? "Fixture evaluation for testing"
          : provenance === "configured_model"
            ? `Configured model evaluation · ${evaluation.evaluator.model}`
            : provenance === "human_review" ||
                evaluation.evaluator.type === "human_review"
              ? "Human review"
              : `Evaluator ${evaluation.evaluator.model ?? "unknown"} · provenance not available`}
        {" · "}
        {evaluation.validation_status.replaceAll("_", " ")}
      </p>
      {evaluation.validation_status === "accepted" && evaluation.result && (
        <>
          <ul>
            {evaluation.result.per_concept_results.map((result) => (
              <li key={result.concept_id}>
                <strong>
                  {followupConceptLabel(
                    comparison,
                    question,
                    result.concept_id,
                  )}
                  :
                </strong>{" "}
                {result.correctness.replaceAll("_", " ")}
              </li>
            ))}
          </ul>
          <p>{evaluation.result.reasoning_observed}</p>
          {evaluation.result.uncertainty_reason && (
            <p>
              <strong>Uncertainty:</strong>{" "}
              {evaluation.result.uncertainty_reason}
            </p>
          )}
          {evaluation.result.misconception_candidates?.map(
            (candidate, index) => (
              <p key={index}>
                <strong>Tentative interpretation:</strong>{" "}
                {candidate.uncertainty_reason}
              </p>
            ),
          )}
        </>
      )}
      {evaluation.validation_status !== "accepted" && (
        <p>
          The saved response remains available. No accepted judgment is shown
          for this evaluation.
        </p>
      )}
    </>
  );
}

export function InterventionFollowup({
  draftId,
  approvalId,
}: {
  draftId: string;
  approvalId: string;
}) {
  const [comparison, setComparison] = useState<InterventionComparison | null>(
    null,
  );
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const endpoint = `/api/teacher/interventions/${draftId}/followup`;

  useEffect(() => {
    let active = true;
    void fetch(endpoint, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    })
      .then(async (result) => {
        if (!result.ok)
          throw new Error("We couldn’t load the follow-up evidence.");
        const saved = InterventionComparisonSchema.parse(await result.json());
        if (saved.approval_id !== approvalId)
          throw new Error(
            "The evidence belongs to a different approved activity.",
          );
        if (active) setComparison(saved);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load follow-up evidence.",
          );
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [approvalId, endpoint]);

  async function refresh() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await fetch(endpoint, {
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      if (!result.ok)
        throw new Error(
          "We couldn’t refresh the follow-up evidence. The last loaded results are kept below.",
        );
      const saved = InterventionComparisonSchema.parse(await result.json());
      if (saved.approval_id !== approvalId)
        throw new Error(
          "The evidence belongs to a different approved activity.",
        );
      setComparison(saved);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to refresh follow-up evidence.",
      );
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <section
      className="lp-intervention-section lp-intervention-followup"
      aria-labelledby="intervention-followup-title"
      aria-busy={busy}
    >
      <div className="lp-followup-heading">
        <h2 id="intervention-followup-title">Before and after the activity</h2>
        <button
          type="button"
          className="lp-button"
          disabled={busy}
          onClick={() => void refresh()}
        >
          Refresh follow-up
        </button>
      </div>
      <p>
        Compare the original supporting work with each recipient’s saved
        fresh-check response. Missing responses are not failures. A correct
        answer after assistance does not establish independent learning or
        long-term retention.
      </p>
      {busy && <p role="status">Loading saved follow-up evidence…</p>}
      {error && (
        <p role="alert" className="lp-intervention-warning">
          {error}
        </p>
      )}
      {comparison && (
        <>
          <dl className="lp-followup-counts">
            {(
              [
                ["Intended recipients", comparison.counts.intended],
                ["Started", comparison.counts.started],
                ["Submitted", comparison.counts.submitted],
                ["Missing follow-up", comparison.counts.missing],
                ["Accepted evaluations", comparison.counts.accepted],
                ["Pending evaluations", comparison.counts.pending],
                ["Failed evaluations", comparison.counts.failed],
                ["Uncertain judgments", comparison.counts.uncertain],
              ] as const
            ).map(([label, count]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
          <p className="lp-intervention-meta">
            All counts are distinct recipients out of{" "}
            {comparison.counts.intended}. Uncertain accepted judgments also
            appear in accepted evaluations. These observations do not show that
            the activity caused a change.
          </p>
          <details className="lp-intervention-section">
            <summary>Exact approved activity and source version</summary>
            <dl className="lp-followup-identities">
              <div>
                <dt>Approved revision</dt>
                <dd>{comparison.approved_revision}</dd>
              </div>
              <div>
                <dt>Approval</dt>
                <dd>{comparison.approval_id}</dd>
              </div>
              <div>
                <dt>Draft</dt>
                <dd>{comparison.draft_id}</dd>
              </div>
              <div>
                <dt>Assignment</dt>
                <dd>{comparison.assignment_id}</dd>
              </div>
              <div>
                <dt>Package</dt>
                <dd>{comparison.content_ref.package_id}</dd>
              </div>
              <div>
                <dt>Lesson version</dt>
                <dd>{comparison.content_ref.content_version}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{comparison.content_ref.source_id}</dd>
              </div>
              <div>
                <dt>Source revision</dt>
                <dd>
                  {"source_commit" in comparison.content_ref
                    ? comparison.content_ref.source_commit
                    : comparison.content_ref.source_version}
                </dd>
              </div>
              <div>
                <dt>Excerpt SHA-256</dt>
                <dd>{comparison.content_ref.excerpt_sha256}</dd>
              </div>
            </dl>
            {comparison.original_evidence.sources.map((source) =>
              source.url ? (
                <a
                  key={source.passage_id}
                  className="lp-text-link mr-3"
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {source.passage_id}
                </a>
              ) : (
                <span key={source.passage_id} className="mr-3">
                  {source.passage_id} - private approved source
                </span>
              ),
            )}
          </details>
          {comparison.recipients.map((recipient) => {
            const originals = comparison.original_evidence.observations.filter(
              (observation) => observation.student_id === recipient.student_id,
            );
            const state = recipient.followup;
            return (
              <details
                className="lp-followup-recipient"
                key={recipient.student_id}
              >
                <summary>
                  <strong>{recipient.display_name}</strong>
                  <span className="lp-badge lp-badge-neutral">
                    {statusLabels[state.evaluation_status]}
                  </span>
                  {state.uncertain && (
                    <span className="lp-badge lp-badge-neutral">Uncertain</span>
                  )}
                </summary>
                <dl className="lp-followup-identities">
                  <div>
                    <dt>Explanation / source excerpts displayed</dt>
                    <dd>
                      {recipient.displayed_at
                        ? new Date(recipient.displayed_at).toLocaleString()
                        : "No display recorded"}
                    </dd>
                  </div>
                  <div>
                    <dt>Started</dt>
                    <dd>
                      {state.started_at
                        ? new Date(state.started_at).toLocaleString()
                        : "Not started"}
                    </dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>
                      {state.submitted_at
                        ? new Date(state.submitted_at).toLocaleString()
                        : "No response yet"}
                    </dd>
                  </div>
                </dl>
                <section className="lp-followup-before">
                  <h3>Before · original evidence</h3>
                  {originals.length === 0 && (
                    <p>
                      No response from this recipient was included in the
                      approved draft’s original evidence snapshot.
                    </p>
                  )}
                  {originals.map(
                    ({
                      attempt,
                      evaluation,
                      role,
                      session_id,
                      data_origin,
                    }) => (
                      <details
                        key={attempt.id}
                        className="lp-followup-original"
                      >
                        <summary>
                          {roleLabels[role]} ·{" "}
                          {attempt.question.question_id ?? "Recorded question"}
                        </summary>
                        <p className="lp-intervention-meta">
                          {data_origin === "synthetic_fixture"
                            ? "Prepared fictional history"
                            : "Live fictional-student session"}
                        </p>
                        <h4>Original question</h4>
                        <p className="whitespace-pre-wrap">
                          {attempt.question.prompt_text}
                        </p>
                        <h4>Original response</h4>
                        <blockquote>{attempt.response_text}</blockquote>
                        <EvaluationDetails
                          evaluation={evaluation}
                          comparison={comparison}
                          question={attempt.question}
                        />
                        <p className="lp-intervention-meta">
                          Assistance before this response:{" "}
                          {attempt.assistance?.assistance_level.replaceAll(
                            "_",
                            " ",
                          ) ?? "Unknown"}
                          .
                        </p>
                        <p className="lp-intervention-meta">
                          Lesson {attempt.question.content_ref.content_version}{" "}
                          · Source revision{" "}
                          {"source_commit" in attempt.question.content_ref
                            ? attempt.question.content_ref.source_commit
                            : attempt.question.content_ref.source_version}{" "}
                          · Passages{" "}
                          {attempt.question.source_passage_ids.join(", ")}
                        </p>
                        <Link
                          className="lp-text-link"
                          href={`/teacher/sessions/${session_id}#evaluation-${evaluation.id}`}
                        >
                          Inspect original session and assistance
                        </Link>
                      </details>
                    ),
                  )}
                </section>
                <section className="lp-followup-after">
                  <h3>After · approved fresh check</h3>
                  {recipient.attempt && (
                    <p className="whitespace-pre-wrap">
                      {recipient.attempt.question.prompt_text}
                    </p>
                  )}
                  {state.submitted_at ? (
                    <>
                      <blockquote>{state.response_text}</blockquote>
                      <p className="lp-intervention-meta">
                        Assistance recorded before submission:{" "}
                        {state.assistance?.assistance_level.replaceAll(
                          "_",
                          " ",
                        ) ?? "Unknown"}
                        . Display recorded later is shown separately above.
                      </p>
                      <h4>{statusLabels[state.evaluation_status]}</h4>
                      <EvaluationDetails
                        evaluation={recipient.evaluation}
                        provenance={state.evaluation_provenance}
                        comparison={comparison}
                        question={recipient.attempt?.question ?? null}
                      />
                      {state.feedback && <p>{state.feedback}</p>}
                      {recipient.attempt && (
                        <p className="lp-intervention-meta">
                          Question {recipient.attempt.question.question_id} ·
                          Lesson{" "}
                          {
                            recipient.attempt.question.content_ref
                              .content_version
                          }{" "}
                          · Passages{" "}
                          {recipient.attempt.question.source_passage_ids.join(
                            ", ",
                          )}
                        </p>
                      )}
                      {recipient.session_id && recipient.attempt && (
                        <Link
                          className="lp-text-link"
                          href={`/teacher/sessions/${recipient.session_id}#attempt-${recipient.attempt.id}`}
                        >
                          Inspect saved follow-up session
                        </Link>
                      )}
                      {recipient.evaluations.length > 1 && (
                        <details className="lp-intervention-section">
                          <summary>
                            Evaluation history ({recipient.evaluations.length})
                          </summary>
                          {recipient.evaluations.map((evaluation) => (
                            <div key={evaluation.id}>
                              <p className="lp-intervention-meta">
                                {new Date(
                                  evaluation.evaluated_at,
                                ).toLocaleString()}{" "}
                                · {evaluation.id}
                              </p>
                              <EvaluationDetails
                                evaluation={evaluation}
                                comparison={comparison}
                                question={recipient.attempt?.question ?? null}
                              />
                            </div>
                          ))}
                        </details>
                      )}
                    </>
                  ) : (
                    <p>
                      {state.started_at
                        ? "This student started the check and has not submitted a response."
                        : "This student has not started the check."}{" "}
                      No learning outcome is inferred.
                    </p>
                  )}
                </section>
              </details>
            );
          })}
        </>
      )}
    </section>
  );
}
