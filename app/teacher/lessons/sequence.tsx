import type { LessonDraftContent } from "../../../lib/lessons/contracts.ts";
import { sequenceCoverage } from "./authoring-state.ts";
import { LessonPreview } from "./preview.tsx";

export function TutoringSequence({
  content,
}: {
  content: LessonDraftContent | null;
}) {
  const coverage = sequenceCoverage(content);
  const sequence = content?.sequence;
  return (
    <section aria-labelledby="sequence-heading">
      <h2 id="sequence-heading" className="aw-record-heading">
        Tutoring sequence
      </h2>
      <p className="la-muted">
        Prepared instructional content and the decisions the tutor can make.
      </p>
      <div className="la-notice">
        <strong>The bank is a collection of possibilities.</strong> The current
        text tutor uses one selected question family. It chooses diagnostics,
        feedback and retests from the student’s responses. A session may use
        only part of the bank.
      </div>
      {sequence ? (
        <>
          <dl className="la-facts">
            <div>
              <dt>Question bank</dt>
              <dd>
                <strong>{coverage.bankCount} questions</strong>
              </dd>
            </div>
            <div>
              <dt>Prepared family</dt>
              <dd>
                <strong>{coverage.preparedCount} questions</strong>
              </dd>
            </div>
            <div>
              <dt>Covered concepts</dt>
              <dd>
                <strong>
                  {coverage.included
                    .map((concept) => concept.title)
                    .join(", ") || sequence.concept_ids.join(", ")}
                </strong>
              </dd>
            </div>
          </dl>
          {!!coverage.outside.length && (
            <p className="la-notice la-notice-warning">
              Other lesson concepts:{" "}
              {coverage.outside.map((concept) => concept.title).join(", ")}.
              This prepared family does not cover them. A sequence spanning
              multiple families requires a future controller change.
            </p>
          )}
          <p className="la-muted">
            Available steps below are grouped by purpose, not a fixed run order.
            Feedback may lead to a retest; the controller selects each next step
            from the observed response.
          </p>
          <ul className="la-sequence">
            {sequence.nodes.map((node) => (
              <li key={node.node_id}>
                <div>
                  <h3>{node.kind.replaceAll("_", " ")}</h3>
                  {node.prompt && (
                    <p className="whitespace-pre-wrap">{node.prompt}</p>
                  )}
                  {node.feedback && (
                    <details className="la-review-disclosure">
                      <summary>Teacher-reviewed feedback</summary>
                      <p className="whitespace-pre-wrap">{node.feedback}</p>
                    </details>
                  )}
                  {node.feedback_variants && (
                    <details className="la-review-disclosure">
                      <summary>Possible feedback</summary>
                      {Object.entries(node.feedback_variants).map(
                        ([name, text]) => (
                          <p key={name}>
                            <strong>{name.replaceAll("_", " ")}: </strong>
                            {text}
                          </p>
                        ),
                      )}
                    </details>
                  )}
                  <p className="la-muted">
                    {node.kind === "initial_retrieval"
                      ? "Starting question"
                      : "Available when selected by the runtime controller"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="la-notice la-notice-warning">
          No sequence is prepared yet. Approve the question bank, then choose a
          family with an initial question, diagnostic and retest.
        </p>
      )}
      <section className="lp-panel">
        <h3>What the AI may propose</h3>
        <p className="mt-2">
          {content?.activity_policy?.allow_runtime_generation
            ? "Generated instructional actions are permitted within the approved lesson policy. Each proposed action must pass the existing server checks before it is used."
            : sequence
              ? "Runtime generation is disabled for this draft. Prepared content remains the text tutoring path."
              : "Runtime generation is disabled for this draft. A reviewed text sequence must still be prepared."}
        </p>
        <p className="mt-2">
          The teacher reviews content and policy. The runtime controller
          authorizes the next action, validates its source and observes the
          student’s response. This authoring workspace does not change those
          decisions.
        </p>
      </section>
      <details className="la-review-disclosure">
        <summary>
          Inspect private evaluation policy, limits and sequence identifiers
        </summary>
        <LessonPreview content={content} section="policy" />
      </details>
    </section>
  );
}
