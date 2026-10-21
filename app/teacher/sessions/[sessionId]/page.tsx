import Link from "next/link";
import { Icon } from "../../../components/icons.tsx";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { AuthError, requireActor } from "../../../../lib/auth.ts";
import { loadApprovedContent } from "../../../../lib/evidence/content.ts";
import {
  EvidenceError,
  evidenceAccess,
} from "../../../../lib/evidence/store.ts";
import { readTeacherSession } from "../../../../lib/teacher/store.ts";
import { TeacherFrame, date, label, originLabel } from "../../presentation.tsx";
import { EvidenceAnchor } from "../evidence-anchor.tsx";

export const dynamic = "force-dynamic";
async function load(id: string) {
  try {
    return await readTeacherSession(evidenceAccess(await requireActor()), id);
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect("/login");
    if (
      error instanceof z.ZodError ||
      (error instanceof EvidenceError && [403, 404].includes(error.status))
    )
      notFound();
    throw error;
  }
}
export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { evidence, display_name, title } = await load(
    (await params).sessionId,
  );
  const content = loadApprovedContent();
  const { session, attempts, evaluations, interventions } = evidence;
  const conceptName = (id: string) => content.concepts.get(id)?.title ?? id;
  const stepNames = {
    initial_retrieval: "First answer",
    neutral_clarification: "Clarification",
    diagnostic_followup: "Diagnostic follow-up",
    immediate_retest: "Retest after feedback",
    delayed_review: "Later review",
  };
  const resultNames = {
    correct: "Correct",
    partially_correct: "Partly correct",
    incorrect: "Incorrect",
    uncertain: "Uncertain",
  };
  const evaluationNames = {
    accepted: "Accepted evaluation",
    pending_review: "Awaiting evaluation",
    rejected: "Evaluation rejected",
    evaluation_failed: "Evaluation failed",
  };
  function passages(ids: string[]) {
    return (
      <ul className="mt-2 space-y-2">
        {ids.map((id) => {
          const p = content.passages.get(id);
          return (
            <li key={id}>
              <details className="rounded border border-slate-200 p-3">
                <summary className="cursor-pointer text-teal-800">
                  {id} · textbook evidence
                </summary>
                <p className="my-3 whitespace-pre-wrap text-sm">
                  {p?.text ?? "Passage text unavailable for this version."}
                </p>
                {p && (
                  <a
                    href={p.url}
                    className="text-sm underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open pinned textbook source, lines {p.start_line}–
                    {p.end_line}
                  </a>
                )}
              </details>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <TeacherFrame section="Student evidence">
      <EvidenceAnchor key={session.id} />
      <div className="lp-evidence-page">
        <Link
          href={`/teacher?assignment=${session.assignment_id}`}
          className="lp-text-link"
        >
          <Icon name="back" />
          Back to assignment overview
        </Link>
        <h1 className="lp-title mt-4">{display_name}</h1>
        <p className="lp-evidence-subtitle">{title}</p>
        <div className="lp-evidence-meta">
          <span className="lp-badge">{originLabel(session.data_origin)}</span>
          <span>{label(session.status)}</span>
          <span>{attempts.filter((a) => a.submitted_at).length} answers</span>
        </div>
        <p className="lp-evidence-note">
          {session.data_origin === "synthetic_fixture"
            ? "Example data for the demo, not measured classroom outcomes."
            : "Fictional demo student. Each result identifies how it was evaluated."}
        </p>
        <details className="lp-evidence-details lp-session-about">
          <summary>Session details</summary>
          <p>Started {date(session.started_at)}</p>
          {session.ended_at && <p>Ended {date(session.ended_at)}</p>}
          <p>
            Judgments describe these responses, not a fixed trait or lasting
            mastery. Synthetic histories are not measured educational outcomes.
          </p>
        </details>
        <ol className="lp-evidence-steps">
          {attempts.map((a) => {
            const history = evaluations.filter((e) => e.attempt_id === a.id);
            const current = history.find(
              (e) => e.id === a.current_evaluation_id,
            );
            const latest = history.at(-1);
            return (
              <li
                key={a.id}
                id={`attempt-${a.id}`}
                className="lp-panel lp-evidence-step scroll-mt-4"
              >
                <header className="lp-evidence-step-heading">
                  <span className="lp-evidence-step-number">
                    {a.sequence_index + 1}
                  </span>
                  <h2>{stepNames[a.intent]}</h2>
                </header>
                <p className="lp-evidence-concepts">
                  {a.question.concept_ids.map(conceptName).join(" · ")}
                </p>
                <h3 className="lp-evidence-label">Question</h3>
                <p className="lp-evidence-question">{a.question.prompt_text}</p>
                <h3 className="lp-evidence-label">Original student response</h3>
                <blockquote className="lp-evidence-answer">
                  {a.response_text ?? "No response submitted."}
                </blockquote>
                {a.assistance && (
                  <p className="lp-evidence-note">
                    {a.assistance.assistance_level === "none_recorded"
                      ? "No content help recorded before this answer."
                      : `Help before this answer: ${label(a.assistance.assistance_level)}.`}
                  </p>
                )}
                {current?.result ? (
                  <section
                    className="lp-evidence-result"
                    aria-label="Current accepted result"
                  >
                    <h3 className="lp-evidence-label">Result by concept</h3>
                    <ul>
                      {current.result.per_concept_results.map((c) => (
                        <li key={c.concept_id}>
                          <span>
                            {conceptName(c.concept_id)}
                            {c.error_type && (
                              <small>{label(c.error_type)}</small>
                            )}
                          </span>
                          <strong
                            className={`lp-result-badge lp-result-${c.correctness}`}
                          >
                            {resultNames[c.correctness]}
                          </strong>
                        </li>
                      ))}
                    </ul>
                    <p className="lp-evidence-note">
                      {current.evaluator.type === "synthetic_fixture"
                        ? "Prepared example judgment · not an AI result"
                        : current.evaluator.type === "human_review"
                          ? "Human-reviewed judgment"
                          : `AI evaluation · ${current.evaluator.model}`}
                    </p>
                    {current.result.uncertainty_reason && (
                      <p className="lp-evidence-caution">
                        <strong>Uncertainty:</strong>{" "}
                        {current.result.uncertainty_reason}
                      </p>
                    )}
                    {Boolean(
                      current.result.misconception_candidates?.length,
                    ) && (
                      <p className="lp-evidence-caution">
                        Possible misunderstanding to investigate. The
                        evaluator’s suggestion is tentative.
                      </p>
                    )}
                    {current.applied_result?.hypothesis_events.map((h) => (
                      <p key={h.id} className="lp-evidence-caution">
                        Reasoning pattern: <strong>{label(h.status)}</strong>.
                        Supporting and contradicting evidence is available
                        below.
                      </p>
                    ))}
                  </section>
                ) : (
                  <p className="lp-evidence-caution">
                    {a.submitted_at
                      ? `${latest ? evaluationNames[latest.validation_status] : "Awaiting evaluation"}. No accepted result yet.`
                      : "Waiting for the student's answer."}
                  </p>
                )}
                {current &&
                  latest &&
                  latest !== current &&
                  latest.validation_status !== "accepted" && (
                    <p className="lp-evidence-caution">
                      {evaluationNames[latest.validation_status]}. The earlier
                      accepted result is still shown.
                    </p>
                  )}
                {history.length > 0 && (
                  <details className="lp-evidence-details">
                    <summary>Evidence, sources, and evaluation history</summary>
                    <div className="lp-evidence-history">
                      {history.map((e) => (
                        <section
                          key={e.id}
                          id={`evaluation-${e.id}`}
                          className="lp-evidence-evaluation"
                        >
                          <h3 className="font-semibold">
                            {evaluationNames[e.validation_status]}
                            {e.id === a.current_evaluation_id
                              ? " · current accepted judgment"
                              : ""}
                          </h3>
                          <p className="mt-1 text-xs text-slate-600">
                            {label(e.evaluator.type)}
                            {e.evaluator.model &&
                              ` · ${e.evaluator.model}`} · {e.evaluator.version}{" "}
                            · {date(e.evaluated_at)}
                          </p>
                          {e.failure_reason && (
                            <p className="mt-3">
                              No new accepted judgment:{" "}
                              {label(e.failure_reason)}
                            </p>
                          )}
                          {e.result && (
                            <>
                              <ul className="mt-3 space-y-2">
                                {e.result.per_concept_results.map((c) => (
                                  <li key={c.concept_id}>
                                    <strong>
                                      {conceptName(c.concept_id)}:{" "}
                                      {label(c.correctness)}
                                    </strong>
                                    {c.error_type && (
                                      <span> · {label(c.error_type)}</span>
                                    )}
                                    <p className="text-sm">
                                      Demonstrated:{" "}
                                      {c.rubric_criteria_met.join("; ") ||
                                        "None recorded"}
                                    </p>
                                    <p className="text-sm">
                                      Missing:{" "}
                                      {c.rubric_criteria_missing.join("; ") ||
                                        "None recorded"}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                              <p className="mt-3 whitespace-pre-wrap">
                                {e.result.reasoning_observed}
                              </p>
                              {e.result.uncertainty_reason && (
                                <p className="mt-3">
                                  <strong>Uncertainty:</strong>{" "}
                                  {e.result.uncertainty_reason}
                                </p>
                              )}
                              {e.result.evidence_quotes.map((q, i) => (
                                <blockquote
                                  key={i}
                                  className="my-3 border-l-2 border-slate-400 pl-3 text-sm"
                                >
                                  <p className="whitespace-pre-wrap">
                                    “{q.quote}”
                                  </p>
                                  <p className="mt-1 text-slate-600">
                                    {q.interpretation}
                                  </p>
                                </blockquote>
                              ))}
                              {(e.result.misconception_candidates ?? []).map(
                                (c, i) => (
                                  <p key={i} className="mt-2 text-sm">
                                    <strong>Tentative candidate:</strong>{" "}
                                    {content.misconceptions.get(
                                      c.misconception_id,
                                    )?.definition ?? c.misconception_id}{" "}
                                    — {c.uncertainty_reason}
                                  </p>
                                ),
                              )}
                              <p className="mt-3 text-sm">
                                Evaluator recommended:{" "}
                                {label(
                                  e.result.proposed_next_action.toLowerCase(),
                                )}
                              </p>
                              <p className="text-sm">
                                Application applied:{" "}
                                {e.applied_result
                                  ? label(e.applied_result.action.toLowerCase())
                                  : "No action recorded"}
                              </p>
                              {e.applied_result?.hypothesis_events.map((h) => (
                                <div
                                  key={h.id}
                                  className="mt-4 border-t border-slate-300 pt-3 text-sm"
                                >
                                  <p>
                                    <strong>Possible misunderstanding:</strong>{" "}
                                    {content.misconceptions.get(
                                      h.misconception_id,
                                    )?.definition ?? h.misconception_id}
                                  </p>
                                  <p>
                                    {h.previous_status
                                      ? `${label(h.previous_status)} → `
                                      : ""}
                                    {label(h.status)} · {date(h.created_at)}
                                  </p>
                                  <p className="my-2">{h.reason}</p>
                                  <p>
                                    Supporting evaluations:{" "}
                                    {h.evidence_evaluation_ids.map((id) => (
                                      <a
                                        key={id}
                                        href={`#evaluation-${id}`}
                                        className="mr-3 underline"
                                      >
                                        Inspect evidence
                                      </a>
                                    ))}
                                  </p>
                                  <p>
                                    Contradicting evaluations:{" "}
                                    {h.contradicting_evaluation_ids.length
                                      ? h.contradicting_evaluation_ids.map(
                                          (id) => (
                                            <a
                                              key={id}
                                              href={`#evaluation-${id}`}
                                              className="mr-3 underline"
                                            >
                                              Inspect contradiction
                                            </a>
                                          ),
                                        )
                                      : "None recorded"}
                                  </p>
                                </div>
                              ))}
                              {passages(e.result.source_passage_ids)}
                            </>
                          )}
                        </section>
                      ))}
                    </div>
                  </details>
                )}
                {interventions
                  .filter((i) => i.related_attempt_id === a.id)
                  .map((i) => (
                    <details key={i.id} className="lp-evidence-details">
                      <summary>
                        {label(i.type)} ·{" "}
                        {i.delivery_status === "displayed"
                          ? "shown to student"
                          : "not recorded as shown"}
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap">{i.text_shown}</p>
                      <p className="mt-2 text-xs">
                        {i.visible_at
                          ? `Displayed ${date(i.visible_at)}`
                          : `Delivery ${label(i.delivery_status)}. Not recorded as displayed; does not count as received help.`}
                      </p>
                      {passages(i.source_passage_ids)}
                    </details>
                  ))}
                {a.outcome && (
                  <details className="lp-evidence-details">
                    <summary>Outcome and next review</summary>
                    <p>{label(a.outcome.outcome)}</p>
                    <p>{a.outcome.review_reason}</p>
                    {a.outcome.next_review_at && (
                      <p>Proposed review: {date(a.outcome.next_review_at)}</p>
                    )}
                  </details>
                )}
                <details className="lp-evidence-details">
                  <summary>Question, timing, and source details</summary>
                  <p>
                    Question: {a.question.question_id ?? "Generated question"}
                  </p>
                  <p>Presented {date(a.presented_at)}</p>
                  {a.submitted_at && <p>Submitted {date(a.submitted_at)}</p>}
                  {a.assistance && (
                    <ul className="my-3">
                      {a.question.concept_ids.map((id) => (
                        <li key={id}>
                          {conceptName(id)}:{" "}
                          {a.assistance
                            ?.independent_retrieval_eligible_by_concept[id]
                            ? "eligible as independent retrieval"
                            : "not independent retrieval"}
                        </li>
                      ))}
                    </ul>
                  )}
                  {a.question.embedded_scaffolding.map((s, i) => (
                    <p key={i}>
                      Already supplied in the question: {s.supplied_content}
                    </p>
                  ))}
                  <h3 className="mt-4 font-semibold">
                    Expected-answer guidance
                  </h3>
                  <p className="my-2 whitespace-pre-wrap">
                    {a.question.rubric.answer_guidance}
                  </p>
                  <p className="break-all">
                    Content: {a.question.content_ref.package_id} ·{" "}
                    {a.question.content_ref.content_version}
                  </p>
                  <p className="break-all">
                    Source: {a.question.content_ref.source_id} ·{" "}
                    {a.question.content_ref.source_commit}
                  </p>
                  <p>
                    Question passages:{" "}
                    {a.question.source_passage_ids.join(", ")}
                  </p>
                </details>
              </li>
            );
          })}
        </ol>
      </div>
    </TeacherFrame>
  );
}
