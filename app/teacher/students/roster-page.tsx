import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireActor } from "../../../lib/auth.ts";
import { evidenceAccess } from "../../../lib/evidence/store.ts";
import { readInterventionDrafts } from "../../../lib/interventions/store.ts";
import { readInterventionReview } from "../../../lib/interventions/approval.ts";
import { readInterventionComparison } from "../../../lib/interventions/outcomes.ts";
import { calculatePatterns } from "../../../lib/teacher/patterns.ts";
import {
  teacherWorkspaceHref,
  type TeacherWorkspaceParams,
} from "../../../lib/teacher/workspace-contracts.ts";
import type {
  Attempt,
  SessionEvidence,
} from "../../../lib/evidence/contracts.ts";
import { loadTeacherView, evidenceDescription } from "../data.ts";
import {
  TeacherFrame,
  TeacherWorkspacePanes,
  date,
  label,
  originLabel,
} from "../presentation.tsx";
import {
  parseRosterContext,
  rosterHref,
  rosterSessionHref,
  type RosterContext,
} from "./roster-context.ts";
import {
  authorizedRosterSelection,
  conceptTrail,
  evaluationFor,
  linkedAssistance,
  participation,
  responseMark,
  studentInterventions,
  studentSessions,
  workEvents,
} from "./roster-model.ts";
import { RosterFocus, RosterSessionLink } from "./roster-links.tsx";
import "./roster.css";

function Mark({
  evidence,
  attempt,
  concept,
}: {
  evidence: SessionEvidence;
  attempt: Attempt;
  concept: string;
}) {
  const mark = responseMark(evidence, attempt, concept);
  const description = `${mark.label} · ${mark.condition}`;
  return (
    <span
      className={`roster-mark roster-mark--${mark.state} roster-mark--${mark.help}`}
      title={description}
    >
      <span aria-hidden="true">{mark.symbol}</span>
      <span className="roster-sr">{description}</span>
    </span>
  );
}

function Answer({
  evidence,
  attempt,
  context,
  titles,
}: {
  evidence: SessionEvidence;
  attempt: Attempt;
  context: RosterContext;
  titles: Map<string, string>;
}) {
  const evaluation = evaluationFor(evidence, attempt);
  const assistance = linkedAssistance(evidence, attempt);
  return (
    <article
      className="roster-answer"
      id={`roster-attempt-${attempt.id}`}
      tabIndex={-1}
    >
      <div className="roster-event-meta">
        <strong>{label(attempt.intent)}</strong>
        <time dateTime={attempt.submitted_at ?? attempt.presented_at}>
          {date(attempt.submitted_at ?? attempt.presented_at)}
        </time>
      </div>
      <p className="roster-question">{attempt.question.prompt_text}</p>
      {attempt.submitted_at ? (
        <blockquote>
          {attempt.response_text === "" ? (
            <em>Empty response submitted.</em>
          ) : (
            attempt.response_text
          )}
        </blockquote>
      ) : (
        <p className="roster-note">Question shown; no submitted response.</p>
      )}
      <ul className="roster-results">
        {attempt.question.concept_ids.map((concept) => {
          const mark = responseMark(evidence, attempt, concept);
          return (
            <li key={concept}>
              <Mark evidence={evidence} attempt={attempt} concept={concept} />
              <span>
                {titles.get(concept) ?? concept}: <strong>{mark.label}</strong>
                <small>{mark.condition}</small>
              </span>
            </li>
          );
        })}
      </ul>
      {evaluation?.validation_status === "accepted" &&
        evaluation.result?.uncertainty_reason && (
          <p className="roster-notice">
            <strong>Uncertainty:</strong> {evaluation.result.uncertainty_reason}
          </p>
        )}
      {evaluation?.validation_status !== "accepted" &&
        evaluation?.failure_reason && (
          <p className="roster-notice">{evaluation.failure_reason}</p>
        )}
      {attempt.submitted_at && (
        <details className="roster-assistance">
          <summary>
            Assistance recorded at submission
            {assistance.length ? ` · ${assistance.length} linked records` : ""}
          </summary>
          <p>
            {label(attempt.assistance?.assistance_level ?? "unavailable")}. This
            saved snapshot describes recorded help, not help outside Learning
            Pulse.
          </p>
          {assistance.map(({ id, record }) => (
            <div key={id}>
              {record ? (
                <>
                  <strong>
                    {label(record.type)} · displayed {date(record.visible_at!)}
                  </strong>
                  <p className="roster-original">{record.text_shown}</p>
                </>
              ) : (
                <p>
                  Linked assistance {id}: display record unavailable in this
                  session. No timing inferred.
                </p>
              )}
            </div>
          ))}
          {!!attempt.question.embedded_scaffolding.length && (
            <ul>
              {attempt.question.embedded_scaffolding.map((item, i) => (
                <li key={i}>
                  {label(item.type)}: {item.supplied_content}
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
      <div className="roster-record-links">
        <RosterSessionLink
          className="lp-text-link"
          href={rosterSessionHref(
            context,
            evidence.session.id,
            attempt.id,
            evaluation?.id,
          )}
        >
          Read exact session →
        </RosterSessionLink>
        <span>
          {evaluation
            ? `Evaluation: ${label(evaluation.validation_status)}`
            : "No evaluation recorded"}
        </span>
      </div>
      <details className="roster-source">
        <summary>Exact source and record identities</summary>
        <dl>
          <dt>Attempt</dt>
          <dd>{attempt.id}</dd>
          <dt>Session</dt>
          <dd>{attempt.session_id}</dd>
          <dt>Accepted evaluation</dt>
          <dd>{attempt.current_evaluation_id ?? "None recorded"}</dd>
          <dt>Displayed evaluation</dt>
          <dd>{evaluation?.id ?? "None recorded"}</dd>
          <dt>Question passages</dt>
          <dd>{attempt.question.source_passage_ids.join(" · ")}</dd>
          <dt>Source reference</dt>
          <dd>
            <pre>{JSON.stringify(attempt.question.content_ref, null, 2)}</pre>
          </dd>
        </dl>
      </details>
    </article>
  );
}

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<TeacherWorkspaceParams>;
}) {
  let context: RosterContext;
  try {
    context = parseRosterContext(await searchParams);
  } catch (error) {
    if (error instanceof z.ZodError) notFound();
    throw error;
  }
  const { assignments, origin, data } = await loadTeacherView(context);
  if (!data)
    return (
      <TeacherFrame section="Students">
        <div className="roster">
          <h1>Roster</h1>
          <p>
            No teaching assignments yet. Your authorized class roster will
            appear here.
          </p>
          <Link href="/teacher/assignments">Open assignments</Link>
        </div>
      </TeacherFrame>
    );
  context = { ...context, assignment: data.assignment_id };
  if (!authorizedRosterSelection(data, context)) notFound();
  const access = evidenceAccess(await requireActor());
  const drafts = await readInterventionDrafts(access, data.assignment_id);
  const reviews: Awaited<ReturnType<typeof readInterventionReview>>[] = [];
  for (const draft of drafts)
    reviews.push(await readInterventionReview(access, draft.id));
  const concepts = data.metrics.concepts.map((c) => ({
    id: c.concept_id,
    title: data.content.concepts.get(c.concept_id)?.title ?? c.concept_id,
  }));
  const titles = new Map(concepts.map((c) => [c.id, c.title]));
  const selected = data.students.find((s) => s.student_id === context.student);
  const sessions = selected ? studentSessions(data, selected.student_id) : [];
  const responses = sessions.flatMap((e) =>
    e.attempts.filter((a) => a.submitted_at),
  );
  const relations = selected
    ? studentInterventions(reviews, selected.student_id)
    : [];
  const comparisons = new Map<
    string,
    Awaited<ReturnType<typeof readInterventionComparison>>
  >();
  for (const relation of relations)
    if (relation.status === "Delivered")
      comparisons.set(
        relation.review.draft.id,
        await readInterventionComparison(access, relation.review.draft.id),
      );
  const patterns = selected
    ? calculatePatterns(
        data.students.map((s) => s.student_id),
        new Set(data.approved_misconception_ids),
        data.evidence,
      ).flatMap((group) =>
        group.students
          .filter((s) => s.student_id === selected.student_id)
          .map((student) => ({ group, student })),
      )
    : [];
  const visibleStudents = data.students.filter(
    (student) =>
      student.display_name
        .toLocaleLowerCase()
        .includes((context.q ?? "").toLocaleLowerCase()) &&
      (context.participation === "all" ||
        participation(studentSessions(data, student.student_id)) ===
          context.participation),
  );
  const clearRecord = {
    student: undefined,
    session: undefined,
    attempt: undefined,
    evaluation: undefined,
  };
  return (
    <TeacherFrame section="Students" context={context}>
      <div
        className={`roster${selected ? " roster--selected" : ""}`}
        data-workspace-restoration="page"
      >
        <RosterFocus />
        <header className="roster-heading" id="roster-main" tabIndex={-1}>
          <p className="lp-eyebrow">
            {data.class_name} · {data.title}
          </p>
          {selected ? (
            <>
              <Link
                className="lp-text-link"
                href={rosterHref(
                  context,
                  { ...clearRecord, concept: undefined, rosterPane: "main" },
                  `roster-student-${selected.student_id}`,
                )}
              >
                ← Back to Roster
              </Link>
              <h1 id={`roster-student-${selected.student_id}`} tabIndex={-1}>
                {selected.display_name}
              </h1>
              <p>
                {sessions.length} study sessions · {responses.length} submitted
                responses in this assignment
              </p>
            </>
          ) : (
            <>
              <h1>Roster</h1>
              <p>
                Each row shows a student’s responses on each idea, in order.
                Open their work to inspect the original answers and recorded
                help.
              </p>
            </>
          )}
          <p className="roster-note">
            {evidenceDescription(origin)} All dates are UTC. This view covers
            the selected assignment across its saved sessions.
          </p>
        </header>
        {!selected ? (
          <>
            <form
              action="/teacher/students"
              className="roster-filters"
              aria-label="Roster filters"
            >
              <label>
                Assignment
                <select name="assignment" defaultValue={data.assignment_id}>
                  {assignments.map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.class_name} · {a.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Evidence source
                <select name="origin" defaultValue={origin}>
                  <option value="all">All records</option>
                  <option value="synthetic_fixture">Synthetic histories</option>
                  <option value="live_demo">Live demo interactions</option>
                </select>
              </label>
              <label>
                Participation
                <select
                  name="participation"
                  defaultValue={context.participation}
                >
                  <option value="all">All students</option>
                  <option value="submitted">Submitted responses</option>
                  <option value="opened">Opened · no response</option>
                  <option value="missing">No sessions</option>
                </select>
              </label>
              <label>
                Find a student
                <input
                  type="search"
                  name="q"
                  defaultValue={context.q}
                  maxLength={120}
                  placeholder="Search by name"
                />
              </label>
              <button className="lp-button" type="submit">
                Apply filters
              </button>
            </form>
            <div className="roster-legend" aria-label="Response markers">
              {[
                ["correct", "✓", "Correct"],
                ["partially_correct", "◐", "Partly correct"],
                ["incorrect", "×", "Incorrect"],
                ["uncertain", "?", "Uncertain"],
                ["pending", "…", "Pending"],
                ["failed", "!", "Failed / rejected"],
                ["missing", "—", "No response"],
              ].map(([state, symbol, text]) => (
                <span key={state}>
                  <span
                    aria-hidden="true"
                    className={`roster-mark roster-mark--${state}`}
                  >
                    {symbol}
                  </span>
                  {text}
                </span>
              ))}
              <span>
                <i className="roster-help-key" />
                Help before submission
              </span>
              <span>
                <i className="roster-reading-key" />
                Reading only
              </span>
            </div>
            <p className="roster-note">
              {visibleStudents.length} of {data.students.length} enrolled
              students · Marks describe responses, not ability. Missing work is
              not evidence of difficulty.
            </p>
            {visibleStudents.length ? (
              <div
                className="roster-table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Student-by-idea evidence grid; scroll horizontally for all concepts"
              >
                <table className="roster-table">
                  <caption className="roster-sr">
                    Responses in recorded time order by student and concept
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Student</th>
                      <th scope="col">Participation</th>
                      {concepts.map((c) => (
                        <th key={c.id} scope="col">
                          {c.title}
                        </th>
                      ))}
                      <th scope="col">Interventions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleStudents.map((student) => {
                      const all = studentSessions(data, student.student_id);
                      const count = all.flatMap((e) =>
                        e.attempts.filter((a) => a.submitted_at),
                      ).length;
                      const pending = all.flatMap((e) =>
                        e.attempts.filter((a) => !a.submitted_at),
                      ).length;
                      const interventions = studentInterventions(
                        reviews,
                        student.student_id,
                      );
                      return (
                        <tr key={student.student_id}>
                          <th scope="row">
                            <Link
                              id={`roster-student-${student.student_id}`}
                              href={rosterHref(context, {
                                student: student.student_id,
                                concept: undefined,
                                session: undefined,
                                attempt: undefined,
                                evaluation: undefined,
                                rosterPane: "main",
                              })}
                            >
                              {student.display_name}
                            </Link>
                          </th>
                          <td>
                            <strong>
                              {all.length
                                ? `${all.length} sessions · ${count} responses`
                                : "No sessions"}
                            </strong>
                            {pending > 0 && (
                              <small>{pending} shown, not answered</small>
                            )}
                          </td>
                          {concepts.map((c) => {
                            const trail = conceptTrail(all, c.id);
                            return (
                              <td key={c.id}>
                                <Link
                                  className="roster-trail"
                                  aria-label={`${student.display_name}, ${c.title}: ${trail.length} question records. Open work log`}
                                  href={rosterHref(context, {
                                    student: student.student_id,
                                    concept: c.id,
                                    session: undefined,
                                    attempt: undefined,
                                    evaluation: undefined,
                                    rosterPane: "main",
                                  })}
                                >
                                  {trail.length ? (
                                    trail.map(({ evidence, attempt }) => (
                                      <Mark
                                        key={attempt.id}
                                        evidence={evidence}
                                        attempt={attempt}
                                        concept={c.id}
                                      />
                                    ))
                                  ) : (
                                    <span className="roster-missing">
                                      —
                                      <span className="roster-sr">
                                        No evidence
                                      </span>
                                    </span>
                                  )}
                                </Link>
                              </td>
                            );
                          })}
                          <td>
                            {interventions.length ? (
                              interventions.map(({ review, status }) => (
                                <p
                                  className="roster-intervention-marker"
                                  key={review.draft.id}
                                >
                                  {review.draft.activity.title}
                                  <small>{status}</small>
                                </p>
                              ))
                            ) : (
                              <span className="roster-note">
                                None in loaded records
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <section className="roster-empty">
                <h2>No students match these filters</h2>
                <p>Try a different name or participation filter.</p>
                <Link
                  href={rosterHref(context, {
                    q: undefined,
                    participation: "all",
                    ...clearRecord,
                  })}
                >
                  Clear search and participation
                </Link>
              </section>
            )}
            <p className="roster-note">
              Intervention relationships use the most recent {drafts.length}{" "}
              saved drafts returned by the existing service (maximum 30), across
              evidence sources. Absence here does not establish that no older
              intervention exists.
            </p>
          </>
        ) : (
          <TeacherWorkspacePanes
            initialPane={context.rosterPane}
            navigation={{
              label: "Ideas",
              children: (
                <nav className="roster-ideas" aria-label="Student concepts">
                  <Link
                    className={!context.concept ? "is-selected" : ""}
                    aria-current={!context.concept ? "page" : undefined}
                    href={rosterHref(context, {
                      concept: undefined,
                      attempt: undefined,
                      session: undefined,
                      evaluation: undefined,
                      rosterPane: "main",
                    })}
                  >
                    <strong>All ideas</strong>
                    <small>Every recorded response</small>
                  </Link>
                  {concepts.map((c) => (
                    <Link
                      key={c.id}
                      className={context.concept === c.id ? "is-selected" : ""}
                      aria-current={
                        context.concept === c.id ? "page" : undefined
                      }
                      href={rosterHref(context, {
                        concept: c.id,
                        attempt: undefined,
                        session: undefined,
                        evaluation: undefined,
                        rosterPane: "main",
                      })}
                    >
                      <strong>{c.title}</strong>
                      <span className="roster-marks">
                        {conceptTrail(sessions, c.id).map(
                          ({ evidence, attempt }) => (
                            <Mark
                              key={attempt.id}
                              evidence={evidence}
                              attempt={attempt}
                              concept={c.id}
                            />
                          ),
                        )}
                      </span>
                      <small>
                        {
                          conceptTrail(sessions, c.id).filter(
                            (r) => r.attempt.submitted_at,
                          ).length
                        }{" "}
                        submitted responses
                      </small>
                    </Link>
                  ))}
                </nav>
              ),
            }}
            main={{
              label: "Work log",
              children: (
                <div className="roster-log">
                  <p className="lp-eyebrow">
                    {context.concept
                      ? titles.get(context.concept)
                      : "All ideas"}
                  </p>
                  <h2>Every saved session</h2>
                  <p className="roster-note">
                    Original work and displayed help, ordered by recorded time
                    within each session. Help affects an answer only where its
                    submission snapshot links it. Equal timestamps do not
                    establish causal order.
                  </p>
                  {sessions.length ? (
                    sessions.map((evidence) => {
                      const events = workEvents(evidence, context.concept);
                      if (!events.length && context.concept) return null;
                      const undelivered = evidence.interventions.filter(
                        (h) =>
                          h.delivery_status !== "displayed" &&
                          (!context.concept ||
                            h.concept_ids.includes(context.concept)),
                      );
                      return (
                        <section
                          key={evidence.session.id}
                          className="roster-session"
                        >
                          <header>
                            <h3>{date(evidence.session.started_at)}</h3>
                            <p>
                              {originLabel(evidence.session.data_origin)} ·{" "}
                              {label(evidence.session.status)}
                            </p>
                            <RosterSessionLink
                              href={rosterSessionHref(
                                context,
                                evidence.session.id,
                              )}
                              className="lp-text-link"
                            >
                              Inspect this session →
                            </RosterSessionLink>
                          </header>
                          <ol className="roster-events">
                            {events.map((event) => (
                              <li
                                key={
                                  event.kind === "help"
                                    ? event.help.id
                                    : event.attempt.id
                                }
                              >
                                {event.kind === "help" ? (
                                  <article
                                    className={`roster-help${event.help.type === "reading" ? " roster-help--reading" : ""}`}
                                  >
                                    <div className="roster-event-meta">
                                      <strong>
                                        {label(event.help.type)} shown
                                      </strong>
                                      <time dateTime={event.at}>
                                        {date(event.at)}
                                      </time>
                                    </div>
                                    <p className="roster-original">
                                      {event.help.text_shown}
                                    </p>
                                    <small>
                                      Displayed record ·{" "}
                                      {event.help.source_passage_ids.join(
                                        " · ",
                                      )}
                                    </small>
                                    <details>
                                      <summary>
                                        Help identity and source
                                      </summary>
                                      <p>{event.help.id}</p>
                                      <pre>
                                        {JSON.stringify(
                                          event.help.content_ref,
                                          null,
                                          2,
                                        )}
                                      </pre>
                                    </details>
                                  </article>
                                ) : (
                                  <Answer
                                    evidence={evidence}
                                    attempt={event.attempt}
                                    context={context}
                                    titles={titles}
                                  />
                                )}
                              </li>
                            ))}
                          </ol>
                          {!events.length && (
                            <p className="roster-note">
                              Session opened; no question or displayed-help
                              records.
                            </p>
                          )}
                          {!!undelivered.length && (
                            <details className="roster-undelivered">
                              <summary>
                                {undelivered.length} help records not confirmed
                                displayed
                              </summary>
                              <p>
                                These do not count as help shown before
                                submission.
                              </p>
                              <ul>
                                {undelivered.map((h) => (
                                  <li key={h.id}>
                                    {label(h.type)} · {label(h.delivery_status)}{" "}
                                    · created {date(h.created_at)}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </section>
                      );
                    })
                  ) : (
                    <div className="roster-empty">
                      <h3>No sessions in this evidence source</h3>
                      <p>Missing activity is not a learning judgment.</p>
                    </div>
                  )}
                  {context.concept &&
                    sessions.length > 0 &&
                    !sessions.some(
                      (e) => workEvents(e, context.concept).length,
                    ) && (
                      <p className="roster-empty">
                        No question or displayed-help records for this idea.
                      </p>
                    )}
                </div>
              ),
            }}
            context={{
              label: "Summary",
              children: (
                <div className="roster-summary">
                  <section>
                    <h3>Interventions</h3>
                    <p className="roster-note">
                      Involving {selected.display_name}. Latest {drafts.length}{" "}
                      saved drafts, across evidence sources; maximum 30.
                    </p>
                    {relations.length ? (
                      relations.map(({ review, status, recipient }) => {
                        const followup = comparisons
                          .get(review.draft.id)
                          ?.recipients.find(
                            (r) => r.student_id === selected.student_id,
                          );
                        return (
                          <article key={review.draft.id}>
                            <Link
                              className="lp-text-link"
                              href={`${teacherWorkspaceHref("/teacher/interventions", context, { attempt: undefined, evaluation: undefined, session: undefined })}&draft=${review.draft.id}`}
                            >
                              {review.draft.activity.title}
                            </Link>
                            <p>
                              <strong>{status}</strong>
                            </p>
                            <p>
                              {recipient
                                ? "Approved recipient"
                                : "Responses used as evidence; not an approved recipient"}
                            </p>
                            {followup && (
                              <p>
                                {followup.displayed_at
                                  ? `Displayed ${date(followup.displayed_at)}`
                                  : "Delivery recorded; display not confirmed"}
                                .{" "}
                                {followup.followup.submitted_at
                                  ? "Follow-up response saved."
                                  : followup.session_id
                                    ? "Follow-up opened; no submitted response."
                                    : "Follow-up not started."}
                              </p>
                            )}
                            {followup?.session_id && (
                              <p className="roster-note">
                                Follow-up session: {followup.session_id}. Open
                                the intervention for its exact linked evidence;
                                no result is inferred from later unrelated
                                sessions.
                              </p>
                            )}
                          </article>
                        );
                      })
                    ) : (
                      <p>
                        No relationships in the loaded intervention records.
                      </p>
                    )}
                  </section>
                  <section>
                    <h3>Recorded concerns</h3>
                    {patterns.length ? (
                      patterns.map(({ group, student }) => (
                        <article
                          key={`${group.concept_id}-${group.misconception_id}`}
                        >
                          <Link
                            className="lp-text-link"
                            href={teacherWorkspaceHref(
                              "/teacher/insights",
                              context,
                              {
                                concept: group.concept_id,
                                misconception:
                                  group.misconception_id ?? undefined,
                                session: student.current.session_id,
                                attempt: student.current.attempt_id,
                                evaluation: student.current.evaluation_id,
                              },
                            )}
                          >
                            {group.misconception_id
                              ? (data.content.misconceptions.get(
                                  group.misconception_id,
                                )?.definition ?? label(group.misconception_id))
                              : "Uncategorized observation"}
                          </Link>
                          <p>
                            {label(student.current.status)} ·{" "}
                            {label(student.current.basis)}
                          </p>
                          <p>{student.current.reason}</p>
                          <small>
                            {
                              student.current.contradicting_evaluation_ids
                                .length
                            }{" "}
                            linked contrary evaluations. A tentative observation
                            is not a diagnosis.
                          </small>
                        </article>
                      ))
                    ) : (
                      <p>No recorded concerns in this view.</p>
                    )}
                  </section>
                  <section>
                    <h3>Recorded activity</h3>
                    <dl className="roster-counts">
                      <dt>Submitted responses</dt>
                      <dd>{responses.length}</dd>
                      <dt>With recorded help or supplied content</dt>
                      <dd>
                        {
                          responses.filter(
                            (a) =>
                              a.assistance &&
                              a.assistance.assistance_level !== "none_recorded",
                          ).length
                        }
                      </dd>
                      <dt>Immediate retests</dt>
                      <dd>
                        {
                          responses.filter(
                            (a) => a.intent === "immediate_retest",
                          ).length
                        }
                      </dd>
                      <dt>Delayed reviews</dt>
                      <dd>
                        {
                          responses.filter((a) => a.intent === "delayed_review")
                            .length
                        }
                      </dd>
                      <dt>Displayed help records</dt>
                      <dd>
                        {
                          sessions.flatMap((e) =>
                            e.interventions.filter(
                              (h) => h.delivery_status === "displayed",
                            ),
                          ).length
                        }
                      </dd>
                      <dt>Without accepted evaluation</dt>
                      <dd>
                        {sessions.reduce(
                          (n, e) =>
                            n +
                            e.attempts.filter(
                              (a) =>
                                a.submitted_at &&
                                evaluationFor(e, a)?.validation_status !==
                                  "accepted",
                            ).length,
                          0,
                        )}
                      </dd>
                    </dl>
                    <p className="roster-note">
                      Counts are responses and records, not scores. Retests
                      after help do not establish lasting learning.
                    </p>
                  </section>
                  <section>
                    <h3>Scope of this log</h3>
                    <p>
                      All saved sessions for this assignment and selected
                      evidence source. Other assignments, unrecorded help and a
                      causal link between interventions and later performance
                      are not inferred.
                    </p>
                    <details>
                      <summary>Authorized context</summary>
                      <p>Student: {selected.student_id}</p>
                      <p>Class: {data.class_id}</p>
                      <p>Assignment: {data.assignment_id}</p>
                    </details>
                  </section>
                </div>
              ),
            }}
          />
        )}
      </div>
    </TeacherFrame>
  );
}
