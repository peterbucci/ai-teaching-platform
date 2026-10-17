import Link from "next/link";
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
    <TeacherFrame>
      <Link
        href={`/teacher?assignment=${session.assignment_id}`}
        className="text-sm text-teal-800 underline"
      >
        Back to assignment overview
      </Link>
      <h1 className="mt-4 text-3xl font-semibold">
        {display_name} · saved learning evidence
      </h1>
      <p className="mt-3 text-slate-600">
        {title} · {originLabel(session.data_origin)} · {label(session.status)}
      </p>
      <p className="mt-2 text-sm text-slate-600">
        Started {date(session.started_at)}
        {session.ended_at && ` · Ended ${date(session.ended_at)}`}
      </p>
      <p className="my-5 rounded-lg bg-amber-50 p-4 text-sm">
        {session.data_origin === "synthetic_fixture"
          ? "This history is a synthetic demonstration, not a measured educational outcome."
          : "This interaction uses a fictional demo student. Each evaluation below identifies its actual evaluator."}{" "}
        Judgments describe these responses, not a fixed trait or lasting
        mastery.
      </p>
      <ol className="space-y-8">
        {attempts.map((a) => (
          <li
            key={a.id}
            id={`attempt-${a.id}`}
            className="scroll-mt-4 rounded-xl border border-slate-200 p-5 sm:p-6"
          >
            <p className="text-sm font-medium text-teal-800">
              Step {a.sequence_index + 1} · {label(a.intent)} ·{" "}
              {a.question.question_id ?? "Generated question"}
            </p>
            <h2 className="mt-2 whitespace-pre-wrap text-lg font-semibold">
              {a.question.prompt_text}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {a.question.concept_ids.map(conceptName).join(" · ")}
            </p>
            <h3 className="mt-5 font-semibold">Original student response</h3>
            <blockquote className="mt-2 whitespace-pre-wrap break-words border-l-4 border-teal-600 bg-slate-50 p-4">
              {a.response_text ?? "No response submitted."}
            </blockquote>
            <p className="mt-2 text-xs text-slate-600">
              Presented {date(a.presented_at)}
              {a.submitted_at && ` · Submitted ${date(a.submitted_at)}`}
            </p>
            {a.assistance && (
              <div className="mt-4 text-sm">
                <p>Recorded help: {label(a.assistance.assistance_level)}</p>
                <p>
                  {a.question.concept_ids
                    .map(
                      (id) =>
                        `${conceptName(id)}: ${a.assistance?.independent_retrieval_eligible_by_concept[id] ? "eligible as independent retrieval" : "not independent retrieval"}`,
                    )
                    .join(" · ")}
                </p>
              </div>
            )}
            {a.question.embedded_scaffolding.map((s, i) => (
              <p key={i} className="mt-2 text-sm">
                Already supplied in the question: {s.supplied_content}
              </p>
            ))}
            {evaluations
              .filter((e) => e.attempt_id === a.id)
              .map((e) => (
                <section
                  key={e.id}
                  id={`evaluation-${e.id}`}
                  className="mt-5 rounded-lg bg-slate-50 p-4"
                >
                  <h3 className="font-semibold">
                    {label(e.validation_status)} evaluation
                    {e.id === a.current_evaluation_id
                      ? " · current accepted judgment"
                      : ""}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    {label(e.evaluator.type)}
                    {e.evaluator.model && ` · ${e.evaluator.model}`} ·{" "}
                    {e.evaluator.version} · {date(e.evaluated_at)}
                  </p>
                  {e.failure_reason && (
                    <p className="mt-3">
                      No new accepted judgment: {label(e.failure_reason)}
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
                          <p className="whitespace-pre-wrap">“{q.quote}”</p>
                          <p className="mt-1 text-slate-600">
                            {q.interpretation}
                          </p>
                        </blockquote>
                      ))}
                      {(e.result.misconception_candidates ?? []).map((c, i) => (
                        <p key={i} className="mt-2 text-sm">
                          <strong>Tentative candidate:</strong>{" "}
                          {content.misconceptions.get(c.misconception_id)
                            ?.definition ?? c.misconception_id}{" "}
                          — {c.uncertainty_reason}
                        </p>
                      ))}
                      <p className="mt-3 text-sm">
                        Evaluator recommended:{" "}
                        {label(e.result.proposed_next_action)}
                      </p>
                      <p className="text-sm">
                        Application applied:{" "}
                        {e.applied_result
                          ? label(e.applied_result.action)
                          : "No action recorded"}
                      </p>
                      {e.applied_result?.hypothesis_events.map((h) => (
                        <div
                          key={h.id}
                          className="mt-4 border-t border-slate-300 pt-3 text-sm"
                        >
                          <p>
                            <strong>Possible misunderstanding:</strong>{" "}
                            {content.misconceptions.get(h.misconception_id)
                              ?.definition ?? h.misconception_id}
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
                              ? h.contradicting_evaluation_ids.map((id) => (
                                  <a
                                    key={id}
                                    href={`#evaluation-${id}`}
                                    className="mr-3 underline"
                                  >
                                    Inspect contradiction
                                  </a>
                                ))
                              : "None recorded"}
                          </p>
                        </div>
                      ))}
                      {passages(e.result.source_passage_ids)}
                    </>
                  )}
                </section>
              ))}
            {a.submitted_at &&
              !evaluations.some((e) => e.attempt_id === a.id) && (
                <p className="mt-4">
                  Evaluation pending. This response has no accepted judgment
                  yet.
                </p>
              )}
            {interventions
              .filter((i) => i.related_attempt_id === a.id)
              .map((i) => (
                <section
                  key={i.id}
                  className="mt-4 rounded-lg border border-teal-200 p-4"
                >
                  <h3 className="font-semibold">
                    {label(i.type)} · {label(i.delivery_status)}
                  </h3>
                  <p className="mt-2 whitespace-pre-wrap">{i.text_shown}</p>
                  <p className="mt-2 text-xs">
                    {i.visible_at
                      ? `Displayed ${date(i.visible_at)}`
                      : "Not recorded as displayed; does not count as received help."}
                  </p>
                  {passages(i.source_passage_ids)}
                </section>
              ))}
            {a.outcome && (
              <div className="mt-5 text-sm">
                <h3 className="font-semibold">Recorded episode outcome</h3>
                <p>{label(a.outcome.outcome)}</p>
                <p>{a.outcome.review_reason}</p>
                {a.outcome.next_review_at && (
                  <p>Proposed review: {date(a.outcome.next_review_at)}</p>
                )}
              </div>
            )}
            <details className="mt-5 text-xs text-slate-600">
              <summary className="cursor-pointer">
                Question guidance and source version
              </summary>
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
                Question passages: {a.question.source_passage_ids.join(", ")}
              </p>
            </details>
          </li>
        ))}
      </ol>
    </TeacherFrame>
  );
}
