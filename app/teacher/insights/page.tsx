import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { calculatePatterns } from "../../../lib/teacher/patterns.ts";
import {
  parseTeacherWorkspaceContext,
  teacherWorkspaceHref,
  type TeacherWorkspaceParams,
} from "../../../lib/teacher/workspace-contracts.ts";
import { teacherEvidenceRows, evidenceResult } from "../evidence/model.ts";
import { Patterns, ResponseExcerpt } from "../patterns.tsx";
import { loadTeacherView, evidenceDescription } from "../data.ts";
import { TeacherFrame, ResultSummary } from "../presentation.tsx";
import { ConcernWorkspace } from "./workspace.tsx";
import {
  concernPreparation,
  concernResponses,
  evaluationRows,
  investigationContext,
  originalEvidenceHref,
  patternStatusLabels,
} from "./model.ts";
import "./concerns.css";

export const dynamic = "force-dynamic";
export default async function TeacherInsightsPage({
  searchParams,
}: {
  searchParams: Promise<TeacherWorkspaceParams>;
}) {
  const params = await searchParams;
  let parsed;
  let view: "ideas" | "concerns";
  try {
    parsed = parseTeacherWorkspaceContext({
      ...params,
      concept: params.concept === "" ? undefined : params.concept,
    });
    view = z
      .enum(["ideas", "concerns"])
      .parse(
        params.view ?? (params.returnTo === "insights" ? "ideas" : "concerns"),
      );
  } catch (error) {
    if (error instanceof z.ZodError) notFound();
    throw error;
  }
  const { assignments, origin, data } = await loadTeacherView(parsed);
  if (!data)
    return (
      <TeacherFrame section="Learning insights" context={parsed}>
        <h1>No teaching assignments yet</h1>
        <p>
          Saved student work will appear here when an authorized assignment is
          available.
        </p>
      </TeacherFrame>
    );
  const { content, metrics } = data;
  const rows = teacherEvidenceRows(data);
  const references = evaluationRows(rows, data.evidence);
  const groups = calculatePatterns(
    data.students.map((s) => s.student_id),
    new Set(data.approved_misconception_ids),
    data.evidence,
  )
    .filter((group) => !parsed.concept || group.concept_id === parsed.concept)
    .sort(
      (a, b) =>
        b.counts.supported - a.counts.supported ||
        b.counts.suspected - a.counts.suspected ||
        b.students.length - a.students.length ||
        a.concept_id.localeCompare(b.concept_id),
    );
  if (
    parsed.misconception &&
    !groups.some((g) => g.misconception_id === parsed.misconception)
  )
    notFound();
  const selected = parsed.misconception
    ? groups.find((g) => g.misconception_id === parsed.misconception)
    : parsed.returnTo === "patterns" && parsed.concept
      ? (groups.find((g) => g.misconception_id === null) ?? groups[0])
      : groups[0];
  const concept =
    view === "ideas"
      ? (parsed.concept ?? metrics.concepts[0]?.concept_id)
      : (selected?.concept_id ?? parsed.concept);
  const metric = metrics.concepts.find((c) => c.concept_id === concept);
  const conceptInfo = content.concepts.get(concept ?? "");
  const relatedRows = rows.filter((row) =>
    row.attempt.question.concept_ids.includes(concept ?? ""),
  );
  const context = {
    ...investigationContext(parsed),
    assignment: data.assignment_id,
    origin,
    concept,
    misconception:
      view === "concerns"
        ? (selected?.misconception_id ?? undefined)
        : undefined,
    returnTo:
      view === "concerns" ? ("patterns" as const) : ("insights" as const),
  };
  const href = (
    nextView: "ideas" | "concerns",
    nextConcept?: string,
    misconception?: string,
  ) => {
    const url = teacherWorkspaceHref("/teacher/insights", context, {
      concept: nextConcept,
      misconception,
      returnTo: nextView === "ideas" ? "insights" : "patterns",
    });
    return `${url}&view=${nextView}&workspacePane=main#${nextView === "concerns" ? "patterns" : nextConcept ? `concept-${encodeURIComponent(nextConcept)}` : "concepts"}`;
  };
  const preparation =
    selected && view === "concerns"
      ? concernPreparation(selected, rows, context)
      : null;
  const category = selected?.misconception_id
    ? content.misconceptions.get(selected.misconception_id)
    : undefined;
  const title =
    view === "ideas"
      ? (conceptInfo?.title ?? "Choose an idea")
      : (category?.definition ??
        (selected
          ? "Unclear or uncategorized reasoning"
          : "No concerns recorded"));
  const latestByStudent = new Map<string, (typeof rows)[number]>();
  relatedRows.forEach((row) => {
    if (!latestByStudent.has(row.student_id))
      latestByStudent.set(row.student_id, row);
  });
  return (
    <TeacherFrame section="Learning insights" context={context}>
      <div className="ci-workspace" data-workspace-restoration="page">
        <ConcernWorkspace
          selection={context}
          initialPane={
            parsed.concept || parsed.misconception ? "main" : "navigation"
          }
          navigation={{
            label: view === "ideas" ? "By idea" : "Concerns",
            children: (
              <>
                <form action="/teacher/insights" className="ci-filters">
                  <input type="hidden" name="view" value={view} />
                  <input
                    type="hidden"
                    name="returnTo"
                    value={view === "ideas" ? "insights" : "patterns"}
                  />
                  <label>
                    Assignment and class
                    <select
                      name="assignment"
                      className="lp-input"
                      defaultValue={data.assignment_id}
                    >
                      {assignments.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title} — {item.class_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Evidence source
                    <select
                      name="origin"
                      className="lp-input"
                      defaultValue={origin}
                    >
                      <option value="all">All records</option>
                      <option value="live_demo">Live test sessions</option>
                      <option value="synthetic_fixture">
                        Prepared class examples
                      </option>
                    </select>
                  </label>
                  <label>
                    Idea
                    <select
                      name="concept"
                      className="lp-input"
                      defaultValue={parsed.concept ?? ""}
                    >
                      <option value="">All ideas</option>
                      {metrics.concepts.map((c) => (
                        <option key={c.concept_id} value={c.concept_id}>
                          {content.concepts.get(c.concept_id)?.title ??
                            c.concept_id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="lp-button">Update view</button>
                </form>
                <p className="ci-meta" style={{ padding: "8px 18px" }}>
                  {view === "concerns"
                    ? "Saved interpretations to investigate. Follow-up support first; these are not student traits."
                    : "Explore the objectives and original work for each idea."}
                </p>
                <ul className="ci-list">
                  {view === "concerns"
                    ? groups.map((group) => (
                        <li
                          key={`${group.concept_id}:${group.misconception_id}`}
                        >
                          <Link
                            href={href(
                              "concerns",
                              group.concept_id,
                              group.misconception_id ?? undefined,
                            )}
                            aria-current={
                              selected === group ? "true" : undefined
                            }
                          >
                            <small>
                              {content.concepts.get(group.concept_id)?.title ??
                                group.concept_id}
                            </small>
                            <strong>
                              {group.misconception_id
                                ? (content.misconceptions.get(
                                    group.misconception_id,
                                  )?.definition ?? group.misconception_id)
                                : "Unclear or uncategorized reasoning"}
                            </strong>
                            <small>
                              {group.students.length} of {group.denominator}{" "}
                              enrolled students ·{" "}
                              {concernResponses(group, references)} linked
                              responses
                            </small>
                            <small>
                              {group.counts.supported} supported ·{" "}
                              {group.counts.uncertain} unclear ·{" "}
                              {group.counts.not_supported} evidence against
                            </small>
                          </Link>
                        </li>
                      ))
                    : metrics.concepts.map((c) => (
                        <li key={c.concept_id}>
                          <Link
                            href={href("ideas", c.concept_id)}
                            aria-current={
                              concept === c.concept_id ? "true" : undefined
                            }
                          >
                            <strong>
                              {content.concepts.get(c.concept_id)?.title ??
                                c.concept_id}
                            </strong>
                            <small>
                              {c.latest.accepted_students} assessed students of{" "}
                              {metrics.enrolled_students} enrolled ·{" "}
                              {
                                rows.filter((row) =>
                                  row.attempt.question.concept_ids.includes(
                                    c.concept_id,
                                  ),
                                ).length
                              }{" "}
                              responses
                            </small>
                          </Link>
                        </li>
                      ))}
                </ul>
                {view === "concerns" && !groups.length && (
                  <p className="ci-empty" style={{ padding: 18 }}>
                    No recorded concerns in this scope. This is not evidence
                    that every student understands the material.{" "}
                    <Link href={href("ideas", parsed.concept)}>
                      Inspect work by idea
                    </Link>
                    .
                  </p>
                )}
              </>
            ),
          }}
          main={{
            label: "Investigation",
            children: (
              <article
                className="ci-record"
                id={view === "concerns" ? "patterns" : "concepts"}
                tabIndex={-1}
              >
                <p className="lp-eyebrow">
                  {view === "concerns" ? "Concern" : "Idea in this lesson"} ·{" "}
                  {conceptInfo?.title ?? "Student work"}
                </p>
                <h1
                  id={concept ? `concept-${concept}` : "investigation-title"}
                  tabIndex={-1}
                >
                  {title}
                </h1>
                {view === "concerns" ? (
                  <p>
                    Read the reasoning behind this possible concern, check
                    evidence for and against it, then decide whether a teacher
                    review would help.
                  </p>
                ) : (
                  <ul>
                    {conceptInfo?.objectives.map((objective) => (
                      <li key={objective}>{objective}</li>
                    ))}
                  </ul>
                )}
                {category?.diagnostic_caution && (
                  <p className="ci-note">
                    <strong>Interpret with care:</strong>{" "}
                    {category.diagnostic_caution}
                  </p>
                )}
                <div className="ci-actions">
                  {preparation && (
                    <Link
                      className="lp-button lp-button-primary"
                      href={preparation}
                    >
                      Prepare an intervention →
                    </Link>
                  )}
                  <Link
                    className="lp-text-link"
                    href={teacherWorkspaceHref("/teacher/evidence", context)}
                  >
                    All answers on this idea →
                  </Link>
                  {view === "concerns" && concept && (
                    <Link
                      className="lp-text-link"
                      href={href("ideas", concept)}
                    >
                      About this idea →
                    </Link>
                  )}
                </div>
                {view === "concerns" && selected ? (
                  <>
                    <dl className="ci-counts">
                      <div>
                        <dd>
                          {selected.students.length} / {selected.denominator}
                        </dd>
                        <dt>linked / enrolled students</dt>
                      </div>
                      <div>
                        <dd>{concernResponses(selected, references)}</dd>
                        <dt>distinct linked responses</dt>
                      </div>
                      {(
                        Object.keys(
                          patternStatusLabels,
                        ) as (keyof typeof patternStatusLabels)[]
                      ).map((status) => (
                        <div key={status}>
                          <dd>{selected.counts[status]}</dd>
                          <dt>{patternStatusLabels[status]}</dt>
                        </div>
                      ))}
                    </dl>
                    <p className="ci-meta">
                      Each student is counted once by their latest saved
                      observation in this category. Earlier evidence stays
                      available. Counts describe recorded evidence, not
                      diagnoses.
                    </p>
                    {!preparation && (
                      <p className="ci-note">
                        Review the original responses first. A named concern
                        with current accepted supporting responses is needed for
                        a concern-wide handoff. You can select eligible
                        responses individually in Evidence.
                      </p>
                    )}
                    <Patterns
                      group={selected}
                      rows={rows}
                      references={references}
                      content={content}
                      context={context}
                    />
                  </>
                ) : view === "ideas" && metric ? (
                  <>
                    <section className="ci-section">
                      <h2>
                        Latest answers{" "}
                        <small>
                          {metric.latest.accepted_students} assessed /{" "}
                          {metrics.enrolled_students} enrolled students
                        </small>
                      </h2>
                      <ResultSummary results={metric.latest} />
                    </section>
                    <section className="ci-section">
                      <h2>By situation</h2>
                      <p className="ci-meta">
                        Existing metrics: latest submitted answer per student
                        within each situation. Groups may overlap. Reading-only
                        assistance is disclosed on each original response; these
                        aggregates do not supply a separate reading-only group.
                      </p>
                      <div className="ci-situations">
                        {(
                          [
                            ["Independent retrieval", metric.independent],
                            ["After content help", metric.content_assisted],
                            ["Immediate retest", metric.immediate_retest],
                            ["Later review", metric.delayed_review],
                          ] as const
                        ).map(([name, result]) => (
                          <section key={name}>
                            <h3>{name}</h3>
                            <ResultSummary results={result} />
                          </section>
                        ))}
                      </div>
                    </section>
                    <section className="ci-section">
                      <h2>Concerns on this idea</h2>
                      {groups
                        .filter((group) => group.concept_id === concept)
                        .map((group) => (
                          <p key={group.misconception_id ?? "uncategorized"}>
                            <Link
                              className="lp-text-link"
                              href={href(
                                "concerns",
                                concept,
                                group.misconception_id ?? undefined,
                              )}
                            >
                              {group.misconception_id
                                ? content.misconceptions.get(
                                    group.misconception_id,
                                  )?.definition
                                : "Unclear reasoning"}{" "}
                              →
                            </Link>
                          </p>
                        ))}
                    </section>
                    <section className="ci-section">
                      <h2>
                        Whole class{" "}
                        <small>Latest submitted response per student</small>
                      </h2>
                      <p className="ci-meta">
                        Missing answers are missing evidence. Correct work after
                        help and immediate retests do not establish lasting
                        understanding.
                      </p>
                      {data.students.map((student) => {
                        const row = latestByStudent.get(student.student_id);
                        const earlier = relatedRows.filter(
                          (item) =>
                            item.student_id === student.student_id &&
                            item.attempt.id !== row?.attempt.id,
                        );
                        return (
                          <div className="ci-student" key={student.student_id}>
                            {row ? (
                              <ResponseExcerpt
                                row={row}
                                concept={concept!}
                                context={context}
                              />
                            ) : (
                              <p>
                                {student.display_name} · No submitted response
                                for this idea
                              </p>
                            )}
                            {earlier.length > 0 && (
                              <details className="ci-history">
                                <summary>
                                  Earlier responses · {earlier.length}
                                </summary>
                                <p className="ci-meta">
                                  Original reasoning remains available across
                                  sessions. The latest answer does not replace
                                  this history.
                                </p>
                                {earlier.map((item) => (
                                  <ResponseExcerpt
                                    key={item.attempt.id}
                                    row={item}
                                    concept={concept!}
                                    context={context}
                                  />
                                ))}
                              </details>
                            )}
                          </div>
                        );
                      })}
                    </section>
                  </>
                ) : (
                  <p className="ci-empty">
                    Choose an idea or return after students submit work. No
                    misunderstanding has been inferred from missing evidence.
                  </p>
                )}
              </article>
            ),
          }}
          context={{
            label: "Context",
            children: (
              <div className="ci-context">
                <section>
                  <h2>Scope of this investigation</h2>
                  <p>
                    {
                      assignments.find((a) => a.id === data.assignment_id)
                        ?.title
                    }
                  </p>
                  <p className="ci-meta">{evidenceDescription(origin)}</p>
                  <p className="ci-meta">
                    {relatedRows.length} submitted responses from{" "}
                    {new Set(relatedRows.map((r) => r.student_id)).size}{" "}
                    distinct students on this idea.
                  </p>
                </section>
                <section>
                  <h2>Approved lesson and source</h2>
                  {conceptInfo?.boundaries.map((boundary) => (
                    <p className="ci-meta" key={boundary}>
                      {boundary}
                    </p>
                  ))}
                  {[
                    ...new Map(
                      relatedRows.map((row) => [
                        JSON.stringify(row.attempt.question.content_ref),
                        row.attempt.question.content_ref,
                      ]),
                    ).values(),
                  ].map((ref) => (
                    <p className="ci-meta" key={JSON.stringify(ref)}>
                      Lesson version {ref.content_version}
                      <br />
                      Source {ref.source_id}
                      <br />
                      Revision{" "}
                      {"source_commit" in ref
                        ? ref.source_commit
                        : ref.source_version}
                    </p>
                  ))}
                  {conceptInfo?.source_passage_ids.map((id) => {
                    const passage = content.passages.get(id);
                    return (
                      <details key={id}>
                        <summary>{id} · approved passage</summary>
                        <blockquote>
                          {passage?.text ??
                            "Passage unavailable for this lesson version."}
                        </blockquote>
                        {passage?.url && (
                          <a
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
                  <p className="ci-meta">
                    Open an original response for its exact question, source
                    citations and displayed assistance.
                  </p>
                </section>
                <section>
                  <h2>Check before acting</h2>
                  <p>
                    Uncertain is a valid evaluation outcome. Pending, failed and
                    rejected evaluations are not incorrect answers.
                  </p>
                  <p className="ci-meta">
                    Preparing an intervention opens a private review workspace.
                    It does not generate, assign or deliver anything. Recipients
                    remain the teacher’s choice.
                  </p>
                </section>
                {relatedRows.some(
                  (row) => row.evaluation?.validation_status !== "accepted",
                ) && (
                  <section>
                    <h2>Evaluations to check</h2>
                    {relatedRows
                      .filter(
                        (row) =>
                          row.evaluation?.validation_status !== "accepted",
                      )
                      .map((row) => (
                        <p key={row.attempt.id}>
                          <Link href={originalEvidenceHref(context, row)}>
                            {row.student_name} · {evidenceResult(row, concept)}
                          </Link>
                        </p>
                      ))}
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
