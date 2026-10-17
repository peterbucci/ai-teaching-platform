import Link from "next/link";
import type { ApprovedContent } from "../../lib/evidence/content.ts";
import type { PatternGroup } from "../../lib/teacher/patterns.ts";
import { date, label } from "./presentation.tsx";

export function Patterns({
  groups,
  students,
  content,
}: {
  groups: PatternGroup[];
  students: { student_id: string; display_name: string }[];
  content: ApprovedContent;
}) {
  return (
    <section className="mt-10" aria-labelledby="patterns-title">
      <h2 id="patterns-title" className="text-2xl font-semibold">
        Possible reasoning patterns
      </h2>
      <p className="my-3 max-w-3xl text-sm text-slate-600">
        For the assignment, evidence source, and all-recorded-time scope
        selected above. Each category counts each student once using their
        latest recorded hypothesis observation. A later correct retest does not
        erase an earlier investigation. These counts are not a diagnosis or
        proof of a persistent belief.
      </p>
      {!groups.length && (
        <p className="rounded-lg bg-slate-50 p-4">
          No recorded misconception hypotheses or uncategorized uncertain
          responses in this view. Missing evidence does not establish
          understanding.
        </p>
      )}
      <div className="space-y-4">
        {groups.map((group) => (
          <article
            key={`${group.concept_id}:${group.misconception_id}`}
            className="rounded-xl border border-slate-200 p-5"
          >
            <p className="text-sm font-medium text-teal-800">
              {content.concepts.get(group.concept_id)?.title ??
                group.concept_id}
            </p>
            <h3 className="mt-1 font-semibold">
              {group.misconception_id === "other_or_uncertain"
                ? "Unclear or uncategorized reasoning"
                : (content.misconceptions.get(group.misconception_id)
                    ?.definition ?? group.misconception_id)}
            </h3>
            <dl className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(group.counts).map(([status, count]) => (
                <div key={status} className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-sm capitalize">{label(status)}</dt>
                  <dd className="mt-1 text-xl font-semibold">
                    {count} / {group.denominator}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-slate-600">
              Distinct students / enrolled students. {group.students.length}{" "}
              with a recorded observation in this group. Suspected includes
              explicitly tentative, uninvestigated evaluator candidates;
              supported requires the recorded investigation evidence.
            </p>
            <details className="mt-4">
              <summary className="cursor-pointer font-medium text-teal-800">
                Inspect students and changing evidence
              </summary>
              <ul className="mt-4 divide-y divide-slate-200">
                {group.students.map((student) => (
                  <li key={student.student_id} className="py-4">
                    <h4 className="font-semibold">
                      {students.find((s) => s.student_id === student.student_id)
                        ?.display_name ?? "Enrolled student"}{" "}
                      · {label(student.current.status)}
                    </h4>
                    <p className="mt-1 text-xs text-slate-600">
                      Latest observation {date(student.current.at)} ·{" "}
                      {label(student.current.basis)}
                    </p>
                    <ol className="mt-3 space-y-4">
                      {student.history.map((observation, index) => (
                        <li
                          key={`${observation.evaluation_id}:${index}`}
                          className="border-l-2 border-teal-200 pl-3 text-sm"
                        >
                          <p className="font-medium">
                            {label(observation.status)} · {date(observation.at)}
                          </p>
                          <p className="my-1">{observation.reason}</p>
                          {observation.quotes.map((q, i) => (
                            <blockquote
                              key={i}
                              className="my-2 whitespace-pre-wrap text-slate-600"
                            >
                              “{q.quote}”
                            </blockquote>
                          ))}
                          <Link
                            className="text-teal-800 underline"
                            href={`/teacher/sessions/${observation.session_id}#evaluation-${observation.evaluation_id}`}
                          >
                            Original response, judgment, citations and
                            follow-ups
                          </Link>
                          {observation.supporting_evaluation_ids.length > 0 && (
                            <p className="mt-2">
                              Supporting evidence:{" "}
                              {observation.supporting_evaluation_ids.map(
                                (id) => (
                                  <Link
                                    key={id}
                                    className="mr-3 underline"
                                    href={`/teacher/sessions/${observation.session_id}#evaluation-${id}`}
                                  >
                                    Inspect support
                                  </Link>
                                ),
                              )}
                            </p>
                          )}
                          {observation.contradicting_evaluation_ids.length >
                            0 && (
                            <p className="mt-2">
                              Contradicting evidence:{" "}
                              {observation.contradicting_evaluation_ids.map(
                                (id) => (
                                  <Link
                                    key={id}
                                    className="mr-3 underline"
                                    href={`/teacher/sessions/${observation.session_id}#evaluation-${id}`}
                                  >
                                    Inspect contradiction
                                  </Link>
                                ),
                              )}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ul>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
