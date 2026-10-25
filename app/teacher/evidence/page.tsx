import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Icon } from "../../components/icons.tsx";
import {
  parseTeacherWorkspaceContext,
  teacherWorkspaceHref,
  type TeacherWorkspaceParams,
} from "../../../lib/teacher/workspace-contracts.ts";
import { calculatePatterns } from "../../../lib/teacher/patterns.ts";
import { loadTeacherView, evidenceDescription } from "../data.ts";
import { TeacherFrame, date } from "../presentation.tsx";
import { evidenceResult } from "./model.ts";
import { evidenceEvaluationDisplay } from "./evaluation-display.ts";
import { evidenceResultsScope } from "./results-navigation.ts";
import { resolveEvidenceSelection } from "./selection.ts";
import { EvidenceResults } from "./results.tsx";
import {
  EvidenceContextLink,
  EvidenceResultsReturnLink,
} from "./context-link.tsx";
import { EvidenceWorkspace } from "./workspace.tsx";
import "./workbench.css";

export const dynamic = "force-dynamic";
export default async function EvidencePage({
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
  const { origin, data } = await loadTeacherView(context);
  if (!data)
    return (
      <TeacherFrame section="Evidence" context={context}>
        <header className="lp-page-heading">
          <h1 className="lp-title">Evidence</h1>
        </header>
        <section className="lp-panel">
          <h2>No teaching assignments yet</h2>
          <p>Your assignment’s saved student work will appear here.</p>
          <Link href="/teacher/lessons" className="lp-text-link">
            Open lessons
          </Link>
        </section>
      </TeacherFrame>
    );
  const selection = resolveEvidenceSelection(data, context);
  if (!selection) notFound();
  const {
    requested,
    concept,
    metric,
    conceptRows,
    query,
    visibleRows,
    selected,
    session,
    evaluation,
  } = selection;
  const evaluationDisplay = selected
    ? evidenceEvaluationDisplay(selected, evaluation, concept)
    : null;
  const resolved = {
    ...context,
    assignment: data.assignment_id,
    concept,
    attempt: selected?.attempt.id,
    evaluation: evaluation?.id,
    session: context.session ?? selected?.session_id,
  };
  const patterns = calculatePatterns(
    data.students.map((student) => student.student_id),
    new Set(data.approved_misconception_ids),
    data.evidence,
  ).filter((group) => group.concept_id === concept);
  const selectedPatterns = patterns.flatMap((group) =>
    group.students
      .filter((student) => student.student_id === selected?.student_id)
      .map((student) => ({ group, student })),
  );
  const judgments =
    evaluation?.validation_status === "accepted"
      ? evaluation.result?.per_concept_results.filter(
          (item) => item.concept_id === concept,
        )
      : [];
  const shownAssistance =
    session?.interventions.filter(
      (item) =>
        item.delivery_status === "displayed" &&
        selected?.attempt.assistance?.intervention_ids.includes(item.id),
    ) ?? [];
  const sourceIds = [
    ...new Set([
      ...(selected?.attempt.question.source_passage_ids ?? []),
      ...(evaluation?.validation_status === "accepted"
        ? (evaluation.result?.source_passage_ids ?? [])
        : []),
    ]),
  ];
  return (
    <TeacherFrame section="Evidence" context={resolved}>
      <div className="wb-evidence-workspace" data-workspace-restoration="page">
        <h1 className="tw-sr-only">Evidence</h1>
        <EvidenceWorkspace
          initialPane={
            context.attempt || context.evaluation || context.session
              ? "main"
              : "navigation"
          }
          navigation={{
            label: "Responses",
            children: (
              <>
                <form
                  action="/teacher/evidence"
                  className="wb-evidence-filters"
                  role="search"
                >
                  <input
                    type="hidden"
                    name="assignment"
                    value={data.assignment_id}
                  />
                  <input
                    type="hidden"
                    name="workspacePane"
                    value="navigation"
                  />
                  <input
                    type="hidden"
                    name="returnTo"
                    value={context.returnTo}
                  />
                  {context.student && (
                    <input
                      type="hidden"
                      name="student"
                      value={context.student}
                    />
                  )}
                  <details className="wb-filter-options">
                    <summary>
                      Filter:{" "}
                      {data.content.concepts.get(concept ?? "")?.title ??
                        "Teaching concept"}
                    </summary>
                    <label className="lp-field">
                      Evidence source
                      <select
                        className="lp-input"
                        name="origin"
                        defaultValue={origin}
                      >
                        <option value="all">All records</option>
                        <option value="live_demo">Live test sessions</option>
                        <option value="synthetic_fixture">
                          Prepared class examples
                        </option>
                      </select>
                    </label>
                    <label className="lp-field">
                      Teaching concept
                      <select
                        className="lp-input"
                        name="concept"
                        defaultValue={concept}
                      >
                        {data.metrics.concepts.map((item) => (
                          <option key={item.concept_id} value={item.concept_id}>
                            {data.content.concepts.get(item.concept_id)
                              ?.title ?? item.concept_id}
                          </option>
                        ))}
                      </select>
                    </label>
                  </details>
                  <label className="lp-field">
                    Find a response
                    <input
                      className="lp-input"
                      type="search"
                      name="q"
                      defaultValue={context.q}
                      maxLength={120}
                      placeholder="Student or words in a response"
                    />
                  </label>
                  <button className="lp-button">Update results</button>
                </form>{" "}
                <EvidenceResults
                  key={evidenceResultsScope(resolved)}
                  rows={visibleRows}
                  context={resolved}
                  selectedAttempt={selected?.attempt.id}
                  totalRows={conceptRows.length}
                />
              </>
            ),
          }}
          main={{
            label: "Record",
            children: (
              <div className="wb-evidence-detail">
                <EvidenceResultsReturnLink className="lp-text-link wb-mobile-back">
                  <Icon name="back" /> Back to responses
                </EvidenceResultsReturnLink>
                {selected ? (
                  <article aria-labelledby="response-detail-title">
                    <div className="wb-detail-heading">
                      {requested && !visibleRows.includes(requested) && (
                        <p role="status" className="wb-meta">
                          Your selected response is retained below, but it is
                          outside the current search results.
                        </p>
                      )}
                      <p className="lp-eyebrow">Original student work</p>
                      <h2 id="response-detail-title" tabIndex={-1}>
                        {selected.student_name}
                      </h2>
                      <p className="wb-meta">
                        {selected.data_origin === "synthetic_fixture"
                          ? "Prepared fictional history"
                          : "Live fictional-student session"}{" "}
                        · {date(selected.attempt.submitted_at!)} ·{" "}
                        {selected.attempt.intent.replaceAll("_", " ")}
                      </p>
                      <span className="lp-badge lp-badge-neutral">
                        {evidenceResult({ ...selected, evaluation }, concept)}
                      </span>
                      {evaluationDisplay?.canPrepareSelected && (
                        <p className="mt-4">
                          <EvidenceContextLink
                            className="lp-button lp-button-primary"
                            preserveSelection={false}
                            href={teacherWorkspaceHref(
                              "/teacher/interventions",
                              resolved,
                              {
                                seedAttempt: [selected.attempt.id],
                                returnTo: "evidence",
                              },
                            )}
                          >
                            Prepare from this response <Icon name="arrow" />
                          </EvidenceContextLink>
                        </p>
                      )}
                      {evaluationDisplay?.notice && (
                        <p role="status">{evaluationDisplay.notice}</p>
                      )}
                    </div>
                    <section className="wb-detail-section">
                      <h3>Original question</h3>
                      <p className="wb-original">
                        {selected.attempt.question.prompt_text}
                      </p>
                      <h3>Original response</h3>
                      <blockquote className="wb-original-response">
                        {selected.attempt.response_text}
                      </blockquote>
                      <p className="wb-meta">
                        The wording above is preserved as submitted.
                      </p>
                    </section>
                    <section className="wb-detail-section">
                      <h3>
                        {evaluation?.validation_status === "accepted"
                          ? "Accepted evaluation"
                          : "Evaluation status"}
                      </h3>
                      {evaluation?.validation_status === "accepted" ? (
                        <>
                          <p>
                            {judgments
                              ?.map((item) =>
                                item.correctness.replaceAll("_", " "),
                              )
                              .join(" · ")}
                          </p>
                          <p className="wb-original">
                            {evaluation.result?.reasoning_observed}
                          </p>
                          {evaluation.result?.uncertainty_reason && (
                            <p>
                              <strong>Uncertainty:</strong>{" "}
                              {evaluation.result.uncertainty_reason}
                            </p>
                          )}
                          {evaluation.result?.misconception_candidates
                            ?.filter(
                              (candidate) => candidate.concept_id === concept,
                            )
                            .map((candidate, index) => (
                              <p key={index}>
                                <strong>Tentative interpretation:</strong>{" "}
                                {candidate.uncertainty_reason}
                              </p>
                            ))}
                        </>
                      ) : (
                        <>
                          <p>
                            {evidenceResult(
                              { ...selected, evaluation },
                              concept,
                            )}
                            . {evaluationDisplay?.preparationNote}
                          </p>
                          {evaluation?.failure_reason && (
                            <p>{evaluation.failure_reason}</p>
                          )}
                          <p>
                            The original response is saved. Inspect the session
                            for its current evaluation and recovery state.
                          </p>
                        </>
                      )}
                      <p className="wb-meta">
                        {selected.attempt.assistance
                          ?.independent_retrieval_eligible_by_concept[
                          concept ?? ""
                        ] === undefined
                          ? "Independence not recorded for this concept."
                          : selected.attempt.assistance
                                .independent_retrieval_eligible_by_concept[
                                concept ?? ""
                              ]
                            ? "Eligible as independent retrieval for this concept."
                            : "Not independent retrieval for this concept."}{" "}
                        Assistance:{" "}
                        {selected.attempt.assistance?.assistance_level.replaceAll(
                          "_",
                          " ",
                        ) ?? "not recorded"}
                        . Correct work after help is not proof of lasting
                        understanding.
                      </p>
                    </section>
                  </article>
                ) : (
                  <section className="wb-empty">
                    <h2>
                      {query
                        ? "No responses match this search"
                        : context.session
                          ? "No submitted responses in this session for this concept"
                          : "No submitted responses for this concept"}
                    </h2>
                    <p>
                      {query
                        ? "Clear the search or choose another concept to review saved work."
                        : context.session
                          ? "Your requested session remains selected. Choose another response from the results or return after a response is submitted."
                          : "No evidence has been invented or treated as incorrect. Choose another concept or return after students submit work."}
                    </p>
                  </section>
                )}
                <p className="wb-footnote">
                  {evidenceDescription(origin)} Recorded interpretations are not
                  lasting student labels.
                </p>
              </div>
            ),
          }}
          context={{
            label: "Context",
            children: (
              <div className="wb-evidence-context">
                {selected ? (
                  <>
                    <section className="wb-detail-section">
                      <h3>Approved source</h3>
                      <p className="wb-meta">
                        Lesson version{" "}
                        {selected.attempt.question.content_ref.content_version}{" "}
                        · source{" "}
                        {selected.attempt.question.content_ref.source_id} ·
                        revision{" "}
                        {"source_commit" in
                        selected.attempt.question.content_ref
                          ? selected.attempt.question.content_ref.source_commit
                          : selected.attempt.question.content_ref
                              .source_version}
                      </p>
                      {!sourceIds.length && (
                        <p>
                          No source passages are linked to this saved response.
                        </p>
                      )}
                      {sourceIds.map((id) => {
                        const passage = data.content.passages.get(id);
                        return (
                          <details key={id} open>
                            <summary>{id} · source passage</summary>
                            <blockquote className="wb-source-text">
                              {passage?.text ??
                                "This passage is unavailable for the saved version."}
                            </blockquote>
                            {passage?.url && (
                              <a
                                className="lp-text-link"
                                href={passage.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open attributed source
                              </a>
                            )}
                          </details>
                        );
                      })}
                    </section>
                    <section className="wb-detail-section">
                      <h3>Assistance displayed before this response</h3>
                      {shownAssistance.length ? (
                        shownAssistance.map((item) => (
                          <details key={item.id}>
                            <summary>{item.type.replaceAll("_", " ")}</summary>
                            <p className="wb-original">{item.text_shown}</p>
                          </details>
                        ))
                      ) : (
                        <p className="wb-meta">
                          No displayed assistance is linked to this response.
                        </p>
                      )}
                      <EvidenceContextLink
                        className="lp-text-link"
                        href={`${teacherWorkspaceHref(`/teacher/sessions/${selected.session_id}`, resolved, { returnTo: "evidence" })}#${evaluation ? `evaluation-${evaluation.id}` : `attempt-${selected.attempt.id}`}`}
                      >
                        Inspect full session and assistance{" "}
                        <Icon name="arrow" />
                      </EvidenceContextLink>
                    </section>
                    <section className="wb-detail-section">
                      <h3>Follow-up and counterevidence</h3>
                      <p className="wb-meta">
                        Keep correct, uncertain and contrary responses alongside
                        the reason for review.
                      </p>
                      {conceptRows.filter(
                        (row) =>
                          row.student_id === selected.student_id &&
                          row.attempt.id !== selected.attempt.id,
                      ).length ? (
                        <ul className="wb-related-list">
                          {conceptRows
                            .filter(
                              (row) =>
                                row.student_id === selected.student_id &&
                                row.attempt.id !== selected.attempt.id,
                            )
                            .map((row) => (
                              <li key={row.attempt.id}>
                                <EvidenceContextLink
                                  href={teacherWorkspaceHref(
                                    "/teacher/evidence",
                                    resolved,
                                    {
                                      attempt: row.attempt.id,
                                      evaluation: row.evaluation?.id,
                                      session: row.session_id,
                                    },
                                  )}
                                >
                                  {evidenceResult(row, concept)} ·{" "}
                                  {row.attempt.intent.replaceAll("_", " ")} ·{" "}
                                  {date(row.attempt.submitted_at!)}
                                </EvidenceContextLink>
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <p>
                          No other submitted responses for this student and
                          concept in this view.
                        </p>
                      )}
                      {selectedPatterns.map(({ group, student }) => (
                        <details
                          key={group.misconception_id ?? "uncategorized"}
                        >
                          <summary>
                            {group.misconception_id
                              ? (data.content.misconceptions.get(
                                  group.misconception_id,
                                )?.definition ?? group.misconception_id)
                              : "Uncategorized uncertainty"}{" "}
                            · {student.current.status.replaceAll("_", " ")}
                          </summary>
                          <ol>
                            {student.history.map((observation, index) => (
                              <li key={`${observation.evaluation_id}:${index}`}>
                                <p>
                                  <strong>
                                    {observation.status.replaceAll("_", " ")}:
                                  </strong>{" "}
                                  {observation.reason}
                                </p>
                                <EvidenceContextLink
                                  className="lp-text-link"
                                  href={teacherWorkspaceHref(
                                    "/teacher/evidence",
                                    resolved,
                                    {
                                      attempt: observation.attempt_id,
                                      evaluation: observation.evaluation_id,
                                      session: observation.session_id,
                                    },
                                  )}
                                >
                                  Read this recorded observation
                                </EvidenceContextLink>
                              </li>
                            ))}
                          </ol>
                        </details>
                      ))}
                    </section>
                  </>
                ) : (
                  <p className="wb-empty">
                    Select a saved response to inspect its source and response
                    history.
                  </p>
                )}
                {metric && (
                  <section className="wb-detail-section wb-concept-context">
                    <h3>Class context</h3>
                    <p>
                      {metric.latest.correct} correct ·{" "}
                      {metric.latest.partially_correct} partly correct ·{" "}
                      {metric.latest.incorrect} incorrect ·{" "}
                      {metric.latest.uncertain} uncertain latest answers.
                    </p>
                    <p className="wb-meta">
                      {metric.latest.accepted_students} assessed students of{" "}
                      {data.metrics.enrolled_students} enrolled.{" "}
                      {metric.latest.pending +
                        metric.latest.evaluation_failed +
                        metric.latest.rejected}{" "}
                      awaiting a valid latest evaluation.{" "}
                      {metric.latest.no_response} without a submitted answer for
                      this concept. Counts include work after help.
                    </p>
                    <EvidenceContextLink
                      className="lp-text-link"
                      href={`${teacherWorkspaceHref("/teacher/insights", resolved)}#concept-${concept}`}
                    >
                      Compare independent and assisted results
                    </EvidenceContextLink>
                  </section>
                )}
              </div>
            ),
          }}
        />
      </div>
    </TeacherFrame>
  );
}
