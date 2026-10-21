import Link from "next/link";
import type { ApprovedContent } from "../../lib/evidence/content.ts";
import type { PatternGroup } from "../../lib/teacher/patterns.ts";
import { Icon } from "../components/icons.tsx";
import { date, originLabel } from "./presentation.tsx";

const statusLabels = {
  suspected: "Suspected",
  supported: "Supported",
  not_supported: "Not supported",
  uncertain: "Uncertain",
} as const;
const statuses = [
  "suspected",
  "supported",
  "not_supported",
  "uncertain",
] as const;
const basisLabels = {
  applied_hypothesis: "Tutor observation",
  tentative_candidate: "Initial suggestion",
  uncategorized_response: "No named pattern",
} as const;

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
    <section
      id="patterns"
      className="lp-panel lp-patterns"
      aria-labelledby="patterns-title"
    >
      <h2 id="patterns-title">Possible reasoning patterns</h2>
      <p className="lp-panel-description">
        Open a pattern to see the students and evidence behind it.
      </p>
      {!groups.length && (
        <p className="lp-empty-results">
          No possible patterns recorded in this view yet. This does not tell us
          whether students understand the material.
        </p>
      )}
      <div className="lp-pattern-list">
        {groups.map((group) => (
          <details
            key={`${group.concept_id}:${group.misconception_id}`}
            className="lp-pattern-detail"
          >
            <summary>
              <span className="lp-pattern-heading">
                <span className="lp-pattern-concept">
                  {content.concepts.get(group.concept_id)?.title ??
                    group.concept_id}
                </span>
                <span className="lp-pattern-title">
                  {group.misconception_id === "other_or_uncertain"
                    ? "Unclear or uncategorized reasoning"
                    : (content.misconceptions.get(group.misconception_id)
                        ?.definition ?? group.misconception_id)}
                </span>
              </span>
              <span className="lp-pattern-total">
                <strong>
                  {group.students.length} of {group.denominator} students
                </strong>
                <span>with recorded evidence</span>
              </span>
              <span className="lp-expand-icon" aria-hidden="true">
                +
              </span>
            </summary>
            <div className="lp-pattern-body">
              <h3>Latest evidence for each student</h3>
              <dl className="lp-pattern-counts">
                {statuses.map((status) => (
                  <div key={status}>
                    <dt>{statusLabels[status]}</dt>
                    <dd>
                      {group.counts[status]} <span>/ {group.denominator}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="lp-result-note">
                Each count is distinct students out of {group.denominator}{" "}
                enrolled. Supported means there is follow-up evidence, not a
                confirmed lasting belief.
              </p>
              <ul className="lp-pattern-students">
                {group.students.map((student) => (
                  <li key={student.student_id}>
                    <details className="lp-pattern-student">
                      <summary>
                        <span className="lp-pattern-student-name">
                          {students.find(
                            (s) => s.student_id === student.student_id,
                          )?.display_name ?? "Enrolled student"}
                        </span>
                        <span className="lp-badge lp-badge-neutral">
                          {statusLabels[student.current.status]}
                        </span>
                        <span className="lp-pattern-origin">
                          {originLabel(student.current.data_origin)}
                        </span>
                        <span className="lp-expand-icon" aria-hidden="true">
                          +
                        </span>
                      </summary>
                      <ol
                        className="lp-pattern-history"
                        aria-label="Evidence history, oldest first"
                      >
                        {student.history.map((observation, index) => (
                          <li key={`${observation.evaluation_id}:${index}`}>
                            <div className="lp-pattern-observation-heading">
                              <strong>
                                {statusLabels[observation.status]}
                              </strong>
                              <span className="lp-badge lp-badge-neutral">
                                {originLabel(observation.data_origin)}
                              </span>
                            </div>
                            <p className="lp-pattern-meta">
                              {date(observation.at)} ·{" "}
                              {basisLabels[observation.basis]}
                            </p>
                            <p className="lp-pattern-reason">
                              {observation.reason}
                            </p>
                            {observation.quotes.map((q, i) => (
                              <blockquote key={i}>“{q.quote}”</blockquote>
                            ))}
                            <Link
                              className="lp-text-link"
                              href={`/teacher/sessions/${observation.session_id}#evaluation-${observation.evaluation_id}`}
                            >
                              Read original response and feedback{" "}
                              <Icon name="arrow" />
                            </Link>
                            {observation.supporting_evaluation_ids.length >
                              0 && (
                              <div className="lp-pattern-evidence-links">
                                <span>Supporting evidence</span>
                                {observation.supporting_evaluation_ids.map(
                                  (id) => (
                                    <Link
                                      key={id}
                                      className="lp-text-link"
                                      href={`/teacher/sessions/${observation.session_id}#evaluation-${id}`}
                                    >
                                      Inspect support
                                    </Link>
                                  ),
                                )}
                              </div>
                            )}
                            {observation.contradicting_evaluation_ids.length >
                              0 && (
                              <div className="lp-pattern-evidence-links">
                                <span>Contradicting evidence</span>
                                {observation.contradicting_evaluation_ids.map(
                                  (id) => (
                                    <Link
                                      key={id}
                                      className="lp-text-link"
                                      href={`/teacher/sessions/${observation.session_id}#evaluation-${id}`}
                                    >
                                      Inspect contradiction
                                    </Link>
                                  ),
                                )}
                              </div>
                            )}
                          </li>
                        ))}
                      </ol>
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ))}
      </div>
      <details className="lp-results-help">
        <summary>How to read these patterns</summary>
        <p>
          These are possible interpretations of answers, not permanent labels
          for students. Counts use the assignment and evidence filter selected
          above, across all recorded time. Each student appears once per
          pattern, using their latest observation. A student can appear in more
          than one pattern.
        </p>
        <p>
          Suspected means a tentative suggestion. Supported means follow-up
          evidence supported it; not supported means later evidence challenged
          it. Uncertain cases stay separate. A correct retest does not erase the
          earlier investigation or establish lasting mastery. Open a student to
          follow the history, including original answers and contradictory
          evidence.
        </p>
      </details>
    </section>
  );
}
