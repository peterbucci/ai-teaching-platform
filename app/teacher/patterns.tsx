import Link from "next/link";
import type { ApprovedContent } from "../../lib/evidence/content.ts";
import type { PatternGroup } from "../../lib/teacher/patterns.ts";
import type { TeacherWorkspaceContext } from "../../lib/teacher/workspace-contracts.ts";
import { evidenceResult, type EvidenceRow } from "./evidence/model.ts";
import {
  assistanceLabel,
  originalEvidenceHref,
  originalSessionHref,
  patternStatusLabels,
} from "./insights/model.ts";
import { date, originLabel } from "./presentation.tsx";

/** Investigation excerpts only. Full original records remain in Evidence. */
export function ResponseExcerpt({
  row,
  concept,
  context,
}: {
  row: EvidenceRow;
  concept: string;
  context: TeacherWorkspaceContext;
}) {
  return (
    <article className="ci-response">
      <p className="ci-meta">
        <strong>{row.student_name}</strong> ·{" "}
        {row.attempt.intent.replaceAll("_", " ")} ·{" "}
        {date(row.attempt.submitted_at!)}
        <span>
          {row.evaluation?.validation_status === "accepted"
            ? "Accepted evaluation · "
            : ""}
          {evidenceResult(row, concept)}
        </span>
      </p>
      <blockquote>
        {row.attempt.response_text?.slice(0, 280)}
        {(row.attempt.response_text?.length ?? 0) > 280 ? "…" : ""}
      </blockquote>
      <p className="ci-meta">
        {assistanceLabel(row, concept)} · {originLabel(row.data_origin)}
      </p>
      <Link className="lp-text-link" href={originalEvidenceHref(context, row)}>
        Read original response, source and feedback →
      </Link>
      <Link
        className="lp-text-link ci-session-link"
        href={originalSessionHref(context, row)}
      >
        Inspect full session →
      </Link>
    </article>
  );
}

export function Patterns({
  group,
  rows,
  references,
  content,
  context,
}: {
  group: PatternGroup;
  rows: EvidenceRow[];
  references: Map<string, EvidenceRow>;
  content: ApprovedContent;
  context: TeacherWorkspaceContext;
}) {
  const sections = [
    {
      title: "Reasons to look closer",
      statuses: ["suspected", "supported"],
      note: "Saved observations suggest this interpretation. Follow-up support does not establish a lasting belief.",
    },
    {
      title: "Unclear",
      statuses: ["uncertain"],
      note: "These observations cannot confirm or rule out this concern.",
    },
    {
      title: "Evidence against",
      statuses: ["not_supported"],
      note: "The saved investigation records evidence challenging this interpretation. Read the original work and assistance before drawing conclusions.",
    },
  ];
  const title = group.misconception_id
    ? content.misconceptions.get(group.misconception_id)?.definition
    : undefined;
  return (
    <div
      className="ci-investigation"
      aria-label={title ?? "Unclear reasoning investigation"}
    >
      {sections.map((section) => {
        const students = group.students.filter((student) =>
          section.statuses.includes(student.current.status),
        );
        return (
          <section className="ci-section" key={section.title}>
            <h2>
              {section.title}{" "}
              <small>
                {students.length}{" "}
                {students.length === 1 ? "student" : "students"}
              </small>
            </h2>
            <p className="ci-meta">{section.note}</p>
            {!students.length && (
              <p className="ci-empty">
                No recorded observations in this group.
              </p>
            )}
            {students.map((student) => {
              const related = rows.filter(
                (row) =>
                  row.student_id === student.student_id &&
                  row.attempt.question.concept_ids.includes(group.concept_id),
              );
              const current = references.get(student.current.evaluation_id);
              return (
                <section key={student.student_id} className="ci-student">
                  <h3>
                    {related[0]?.student_name ?? "Enrolled student"}{" "}
                    <small>
                      Latest: {patternStatusLabels[student.current.status]}
                    </small>
                  </h3>
                  <p className="ci-reason">{student.current.reason}</p>
                  {current ? (
                    <ResponseExcerpt
                      row={current}
                      concept={group.concept_id}
                      context={context}
                    />
                  ) : (
                    <p>Original observation unavailable in this view.</p>
                  )}
                  <details className="ci-history">
                    <summary>
                      Supporting and contrary evidence ·{" "}
                      {student.history.length} recorded observations
                    </summary>
                    <ol>
                      {student.history.map((observation, index) => {
                        const row = references.get(observation.evaluation_id);
                        return (
                          <li key={`${observation.evaluation_id}-${index}`}>
                            <p>
                              <strong>
                                {patternStatusLabels[observation.status]}
                              </strong>{" "}
                              · {date(observation.at)} ·{" "}
                              {observation.basis.replaceAll("_", " ")}
                            </p>
                            <p>{observation.reason}</p>
                            {row && (
                              <Link href={originalEvidenceHref(context, row)}>
                                Open this exact observation
                              </Link>
                            )}
                            {(
                              [
                                [
                                  "Supporting evidence",
                                  observation.supporting_evaluation_ids,
                                ],
                                [
                                  "Contrary evidence",
                                  observation.contradicting_evaluation_ids,
                                ],
                              ] as const
                            ).map(([label, ids]) => (
                              <div key={label} className="ci-reference-links">
                                <strong>{label}:</strong>{" "}
                                {ids.length ? (
                                  ids.map((id, i) => {
                                    const target = references.get(id);
                                    return target ? (
                                      <Link
                                        key={id}
                                        href={originalEvidenceHref(
                                          context,
                                          target,
                                        )}
                                      >
                                        {label} {i + 1}
                                      </Link>
                                    ) : (
                                      <span key={id}>
                                        Unavailable in this authorized view
                                      </span>
                                    );
                                  })
                                ) : (
                                  <span>No linked evaluation</span>
                                )}
                              </div>
                            ))}
                          </li>
                        );
                      })}
                    </ol>
                  </details>
                  <details className="ci-history">
                    <summary>
                      All related responses · {related.length} (including later
                      work)
                    </summary>
                    <p className="ci-meta">
                      Correct, uncertain and unavailable results remain visible.
                      Later correct work is not automatically counterevidence or
                      proof of retention.
                    </p>
                    {[...related].reverse().map((row) => (
                      <ResponseExcerpt
                        key={row.attempt.id}
                        row={row}
                        concept={group.concept_id}
                        context={context}
                      />
                    ))}
                  </details>
                </section>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
