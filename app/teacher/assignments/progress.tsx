import Link from "next/link";
import type { ReactNode } from "react";
import type { ApprovedContent } from "../../../lib/evidence/content.ts";
import { date, label, originLabel, ResultSummary } from "../presentation.tsx";
import {
  buildAssignmentProgress,
  progressEvaluation,
  progressEvaluationHistory,
  progressEvidenceHref,
  progressHref,
  progressMark,
  progressSelectionId,
  progressSessionHref,
  progressStatusLabel,
  selectProgressEvidence,
  type AssignmentEvidence,
  type OriginFilter,
  type ProgressEvidence,
  type ProgressFollowup,
  type ProgressListContext,
  type ProgressPane,
  type ProgressReturnContext,
  type ProgressStatus,
  type ProgressView,
} from "./progress-model.ts";
import { ProgressPanes } from "./progress-pane.tsx";
import "./progress.css";

const views = [
  ["grid", "Class grid"],
  ["concepts", "By idea"],
  ["questions", "Questions used"],
  ["sessions", "Study sessions"],
] as const;
const kinds = {
  initial_retrieval: "First answer",
  neutral_clarification: "Clarification",
  diagnostic_followup: "Follow-up question",
  immediate_retest: "Fresh check",
  delayed_review: "Later review",
};
const statuses: ProgressStatus[] = [
  "correct",
  "partially_correct",
  "incorrect",
  "uncertain",
  "pending",
  "evaluation_failed",
  "rejected",
  "no_response",
];

function EvidenceItem({
  row,
  content,
  returnContext,
  concept,
  studentName,
}: {
  row: ProgressEvidence;
  content: ApprovedContent;
  returnContext: ProgressReturnContext;
  concept?: string;
  studentName: string;
}) {
  const { attempt, evidence } = row;
  const evaluation = progressEvaluation(row);
  const latest = progressEvaluationHistory(row).at(-1);
  const accepted =
    evaluation?.validation_status === "accepted" ? evaluation : undefined;
  const concepts = concept ? [concept] : attempt.question.concept_ids;
  return (
    <li className="ap-evidence-item">
      <div className="ap-evidence-meta">
        <span className={`ap-kind ap-kind-${attempt.intent}`}>
          {kinds[attempt.intent]}
        </span>
        {concepts.map((id) => {
          const mark = progressMark(row, id);
          return (
            <span
              key={id}
              className={`ap-result ap-result-${mark.status}`}
              title={content.concepts.get(id)?.title ?? id}
            >
              {progressStatusLabel(mark.status)}
              {concepts.length > 1
                ? ` · ${content.concepts.get(id)?.title ?? id}`
                : ""}
            </span>
          );
        })}
      </div>
      <p className="ap-evidence-meta">
        <span>
          {attempt.assistance?.assistance_level === "none_recorded"
            ? "No content help recorded"
            : attempt.assistance
              ? `Help: ${label(attempt.assistance.assistance_level)}`
              : "Not answered yet"}
        </span>
        <time dateTime={attempt.submitted_at ?? attempt.presented_at}>
          {date(attempt.submitted_at ?? attempt.presented_at)}
        </time>
      </p>
      <blockquote className="ap-original-response">
        {attempt.response_text ?? "No response submitted."}
      </blockquote>
      {accepted?.result?.uncertainty_reason && (
        <p className="ap-caution">
          <strong>Uncertainty:</strong> {accepted.result.uncertainty_reason}
        </p>
      )}
      {!accepted && attempt.submitted_at && (
        <p className="ap-caution">
          {evaluation?.validation_status === "evaluation_failed"
            ? "Evaluation failed."
            : evaluation?.validation_status === "rejected"
              ? "Evaluation rejected."
              : "Evaluation pending."}{" "}
          The original answer is preserved.
        </p>
      )}
      {accepted &&
        latest &&
        accepted.id !== latest.id &&
        latest.validation_status !== "accepted" && (
          <p className="ap-caution">
            A later evaluation is {label(latest.validation_status)}. The
            accepted judgment remains in effect.
          </p>
        )}
      <Link className="ap-link" href={progressEvidenceHref(row, returnContext)}>
        Read in full
      </Link>
      <details className="ap-record-details">
        <summary>Question, sources and evaluation</summary>
        <p className="ap-note">
          {studentName} · {originLabel(evidence.session.data_origin)}
        </p>
        <h4>Question</h4>
        <p className="ap-preserve-text">{attempt.question.prompt_text}</p>
        <p className="ap-source-reference">
          Lesson version {attempt.question.content_ref.content_version} ·
          Passages {attempt.question.source_passage_ids.join(", ")}
        </p>
        {accepted && (
          <p className="ap-note">
            {accepted.evaluator.type === "synthetic_fixture"
              ? "Prepared example judgment; not a model result."
              : accepted.evaluator.type === "human_review"
                ? "Human-reviewed judgment."
                : "Accepted model evaluation."}
          </p>
        )}
        {attempt.assistance && (
          <p className="ap-note">
            {concepts
              .map(
                (id) =>
                  `${content.concepts.get(id)?.title ?? id}: ${attempt.assistance?.independent_retrieval_eligible_by_concept[id] ? "independent evidence" : "not independent evidence"}`,
              )
              .join(" · ")}
          </p>
        )}
      </details>
    </li>
  );
}

export function AssignmentProgress({
  data,
  content,
  origin,
  selectedStudent,
  selectedConcept,
  listContext,
  progressView = "grid",
  pane,
  previewHref,
  followups = [],
  heading,
}: {
  data: AssignmentEvidence;
  content: ApprovedContent;
  origin: OriginFilter;
  selectedStudent?: string;
  selectedConcept?: string;
  listContext?: ProgressListContext;
  progressView?: ProgressView;
  pane?: ProgressPane;
  previewHref?: string;
  followups?: ProgressFollowup[];
  heading?: ReactNode;
}) {
  const progress = buildAssignmentProgress(data, origin);
  const { summary, metrics } = progress;
  const selected = {
    ...(selectedStudent ? { student: selectedStudent } : {}),
    ...(selectedConcept ? { concept: selectedConcept } : {}),
  };
  const selection = selectedStudent || selectedConcept;
  const activePane = pane ?? (selection ? "details" : "grid");
  const sessionReturnContext: ProgressReturnContext = {
    assignment: data.assignment_id,
    origin,
    ...selected,
    progressView,
    pane: "grid",
    // A linked assignment may sit outside the current list filter. The shared
    // session-return contract accepts only the target's authorized class.
    ...(listContext?.class === data.class_id
      ? { class: listContext.class }
      : {}),
    status: listContext?.status ?? "all",
  };
  const href = (
    selection: { student?: string; concept?: string } = selected,
    targetPane: ProgressPane = "details",
    targetView: ProgressView = progressView,
  ) =>
    progressHref(data.assignment_id, origin, selection, listContext, {
      progressView: targetView,
      pane: targetPane,
    });
  const conceptName = (id: string) => content.concepts.get(id)?.title ?? id;
  const studentName = (id: string) =>
    data.students.find((student) => student.student_id === id)?.display_name ??
    "Student";
  const selectedEvidence = selection
    ? selectProgressEvidence(
        progress.sessions,
        selectedStudent,
        selectedConcept,
      ).reverse()
    : [];
  const selectedMetric = metrics.concepts.find(
    (item) => item.concept_id === selectedConcept,
  );
  const context = {
    assignment: data.assignment_id,
    origin,
    ...(selectedConcept ? { concept: selectedConcept } : {}),
  };
  const unansweredEvaluations =
    summary.pendingEvaluations +
    summary.failedEvaluations +
    summary.rejectedEvaluations;
  const questions = new Map<
    string,
    { row: ProgressEvidence; students: Set<string>; responses: number }
  >();
  for (const row of selectProgressEvidence(progress.sessions).reverse()) {
    const key = JSON.stringify([
      row.attempt.question.content_ref,
      row.attempt.question.question_id,
      row.attempt.question.prompt_text,
      row.attempt.question.concept_ids,
    ]);
    const item = questions.get(key) ?? {
      row,
      students: new Set<string>(),
      responses: 0,
    };
    item.students.add(row.evidence.session.student_id);
    if (row.attempt.submitted_at) item.responses++;
    questions.set(key, item);
  }
  const evidenceList = (
    <ol className="ap-evidence-list">
      {selectedEvidence.map((row) => (
        <EvidenceItem
          key={row.attempt.id}
          row={row}
          content={content}
          returnContext={{ ...sessionReturnContext, pane: "details" }}
          concept={selectedConcept}
          studentName={studentName(row.evidence.session.student_id)}
        />
      ))}
    </ol>
  );
  const main = (
    <>
      <div className="ap-main-heading">
        {heading}
        <dl className="ap-summary">
          <div>
            <dt>students have answered</dt>
            <dd>
              {summary.studentsAnswered} <small>of {summary.enrolled}</small>
            </dd>
          </div>
          <div>
            <dt>answers</dt>
            <dd>{summary.submittedResponses}</dd>
          </div>
          <div>
            <dt>evaluated</dt>
            <dd>
              {summary.submittedResponses - unansweredEvaluations}{" "}
              <small>of {summary.submittedResponses}</small>
            </dd>
          </div>
          <div>
            <dt>evaluations pending, failed or rejected</dt>
            <dd>{unansweredEvaluations}</dd>
          </div>
          <div>
            <dt>answers given after help was shown</dt>
            <dd>
              {progress.assistanceSummary.helpResponses}{" "}
              <small>of {summary.submittedResponses}</small>
            </dd>
          </div>
        </dl>
        <details className="ap-count-details">
          <summary>Participation and evaluation details</summary>
          <p>
            {summary.startedStudents} students started ·{" "}
            {summary.completedSessions} completed sessions ·{" "}
            {summary.unansweredQuestions} presented questions without answers ·{" "}
            {summary.pendingEvaluations} evaluations pending ·{" "}
            {summary.failedEvaluations} failed · {summary.rejectedEvaluations}{" "}
            rejected · {progress.assistanceSummary.readingOnlyResponses} answers
            after reading only. These are response and session counts, not
            mastery.
          </p>
        </details>
        <nav className="ap-view-tabs" aria-label="Progress view">
          {views.map(([view, title]) => (
            <Link
              key={view}
              href={href(selected, "grid", view)}
              scroll={false}
              aria-current={progressView === view ? "page" : undefined}
            >
              {title}
            </Link>
          ))}
          {previewHref && <Link href={previewHref}>What students see</Link>}
        </nav>
        <form action="/teacher/assignments" className="ap-origin-filter">
          <input type="hidden" name="assignment" value={data.assignment_id} />
          <input type="hidden" name="view" value="progress" />
          <input type="hidden" name="progressView" value={progressView} />
          <input type="hidden" name="pane" value="grid" />
          {listContext?.class && (
            <input type="hidden" name="class" value={listContext.class} />
          )}
          {listContext?.status && (
            <input type="hidden" name="status" value={listContext.status} />
          )}
          {selectedStudent && (
            <input type="hidden" name="student" value={selectedStudent} />
          )}
          {selectedConcept && (
            <input type="hidden" name="concept" value={selectedConcept} />
          )}
          <label>
            Evidence source{" "}
            <select name="origin" defaultValue={origin}>
              <option value="all">All demo evidence</option>
              <option value="synthetic_fixture">
                Prepared synthetic histories
              </option>
              <option value="live_demo">Live demo sessions</option>
            </select>
          </label>
          <button>Apply</button>
        </form>
        <p className="ap-note ap-origin-note">
          {origin === "synthetic_fixture"
            ? "Prepared fictional histories; not measured learning outcomes."
            : origin === "live_demo"
              ? "Saved sessions from fictional demo accounts."
              : "Prepared fictional histories and live demo sessions shown together."}
        </p>
      </div>
      {summary.startedStudents === 0 && (
        <p className="ap-empty">
          {summary.enrolled === 0
            ? "No students enrolled yet."
            : "No learning sessions in this evidence source yet."}{" "}
          Missing answers are not incorrect answers.
        </p>
      )}
      {progressView === "grid" && (
        <>
          <div className="ap-grid-intro">
            <div className="ap-legend">
              {statuses.map((status) => (
                <span key={status} className={`ap-result ap-result-${status}`}>
                  {progressStatusLabel(status)}
                </span>
              ))}
              <span>
                <i
                  className="ap-mark ap-result-correct ap-help"
                  aria-hidden="true"
                />
                help shown before
              </span>
              <span>
                <i
                  className="ap-mark ap-result-correct ap-reading"
                  aria-hidden="true"
                />
                reading only
              </span>
            </div>
            <p className="ap-note">
              Each cell holds one student’s recorded attempts on one idea,
              oldest first. Select a cell to read them, or a column heading for
              that idea.
            </p>
          </div>
          <div
            className="ap-table-scroll"
            role="region"
            aria-label="Class grid; scroll horizontally for all concepts"
            tabIndex={0}
          >
            <table className="ap-grid">
              <caption className="ap-sr-only">
                Recorded attempts, oldest first. Shapes show saved results;
                underlines identify assistance.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">Answers</th>
                  {metrics.concepts.map((concept) => (
                    <th
                      scope="col"
                      key={concept.concept_id}
                      className={
                        selectedConcept === concept.concept_id
                          ? "ap-column-selected"
                          : undefined
                      }
                    >
                      <Link
                        id={progressSelectionId(undefined, concept.concept_id)}
                        href={href({ concept: concept.concept_id })}
                        scroll={false}
                      >
                        {conceptName(concept.concept_id)}
                        <small>
                          {progress.reachedByConcept[concept.concept_id]}{" "}
                          reached it
                        </small>
                      </Link>
                    </th>
                  ))}
                  <th scope="col">Help shown</th>
                  <th scope="col">Interventions</th>
                </tr>
              </thead>
              <tbody>
                {progress.students.map((student) => {
                  const assigned = followups.filter((item) =>
                    item.recipientIds.includes(student.student_id),
                  );
                  return (
                    <tr key={student.student_id}>
                      <th scope="row">
                        <Link
                          className="ap-link"
                          id={progressSelectionId(student.student_id)}
                          href={href({ student: student.student_id })}
                          scroll={false}
                        >
                          {student.display_name}
                        </Link>
                      </th>
                      <td className="ap-muted">
                        {student.sessionCount
                          ? `${student.responseCount} ${student.responseCount === 1 ? "answer" : "answers"}`
                          : "Not started"}
                      </td>
                      {student.cells.map((cell) => (
                        <td
                          key={cell.conceptId}
                          className={
                            selectedStudent === student.student_id &&
                            selectedConcept === cell.conceptId
                              ? "ap-cell-selected"
                              : selectedConcept === cell.conceptId
                                ? "ap-column-selected"
                                : undefined
                          }
                        >
                          <Link
                            className="ap-cell"
                            id={progressSelectionId(
                              student.student_id,
                              cell.conceptId,
                            )}
                            href={href({
                              student: student.student_id,
                              concept: cell.conceptId,
                            })}
                            scroll={false}
                            aria-label={`${student.display_name}, ${conceptName(cell.conceptId)}: ${cell.marks.length} recorded ${cell.marks.length === 1 ? "attempt" : "attempts"}. Inspect evidence.`}
                          >
                            {cell.marks.length ? (
                              cell.marks.map((mark) => (
                                <span
                                  key={mark.attemptId}
                                  className={`ap-mark ap-result-${mark.status}${mark.assistance === "help" ? " ap-help" : mark.assistance === "reading" ? " ap-reading" : ""}`}
                                  title={mark.label}
                                >
                                  <span className="ap-sr-only">
                                    {mark.label};{" "}
                                  </span>
                                </span>
                              ))
                            ) : (
                              <span
                                className="ap-muted"
                                aria-label="No recorded attempts"
                              >
                                —
                              </span>
                            )}
                          </Link>
                        </td>
                      ))}
                      <td
                        className="ap-muted"
                        title={`${student.helpShownCount} displayed hints, examples or feedback; ${student.readingShownCount} displayed reading events`}
                      >
                        {student.helpShownCount
                          ? `${student.helpShownCount} ${student.helpShownCount === 1 ? "time" : "times"}`
                          : "—"}
                        {student.readingShownCount > 0 && (
                          <small>{student.readingShownCount} reading</small>
                        )}
                      </td>
                      <td className="ap-muted">
                        {assigned.length
                          ? assigned.map((item, index) => (
                              <span key={item.id}>
                                {index > 0 && "; "}
                                <Link
                                  href={`/teacher/interventions?${new URLSearchParams({ assignment: data.assignment_id, origin, draft: item.id })}`}
                                >
                                  {item.title}
                                </Link>
                              </span>
                            ))
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {progressView === "concepts" && (
        <div className="ap-subview">
          <p className="ap-note">
            Latest eligible answer per student in each group. Reading-only
            answers remain in overall results and are not included in the shared
            independent or content-help groups. Immediate success after help is
            not lasting understanding.
          </p>
          <div className="ap-table-scroll">
            <table className="ap-ledger">
              <thead>
                <tr>
                  <th>Idea</th>
                  <th>Reached</th>
                  <th>Latest correct</th>
                  <th>Independent</th>
                  <th>After content help</th>
                  <th>Not settled</th>
                </tr>
              </thead>
              <tbody>
                {metrics.concepts.map((concept) => (
                  <tr key={concept.concept_id}>
                    <th>
                      <Link
                        id={progressSelectionId(undefined, concept.concept_id)}
                        className="ap-link"
                        href={href({ concept: concept.concept_id })}
                        scroll={false}
                      >
                        {conceptName(concept.concept_id)}
                      </Link>
                    </th>
                    <td>
                      {progress.reachedByConcept[concept.concept_id]} of{" "}
                      {summary.enrolled}
                    </td>
                    <td>
                      {concept.latest.correct} of{" "}
                      {concept.latest.accepted_students}
                    </td>
                    <td>
                      {concept.independent.correct} of{" "}
                      {concept.independent.accepted_students}
                    </td>
                    <td>
                      {concept.content_assisted.correct} of{" "}
                      {concept.content_assisted.accepted_students}
                    </td>
                    <td>
                      {concept.latest.pending} pending ·{" "}
                      {concept.latest.evaluation_failed} failed ·{" "}
                      {concept.latest.rejected} rejected ·{" "}
                      {concept.latest.uncertain} uncertain
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {progressView === "questions" && (
        <div className="ap-subview">
          <p className="ap-note">
            Questions actually presented in the selected sessions. Students do
            not necessarily see every prepared question. Immutable prompt
            variants remain separate.
          </p>
          {questions.size === 0 ? (
            <p className="ap-empty">No questions presented yet.</p>
          ) : (
            <div className="ap-table-scroll">
              <table className="ap-ledger ap-questions">
                <thead>
                  <tr>
                    <th>Question</th>
                    <th>Concepts</th>
                    <th>Students shown it</th>
                    <th>Answers</th>
                  </tr>
                </thead>
                <tbody>
                  {[...questions].map(([key, item]) => (
                    <tr key={key}>
                      <th>
                        <Link
                          className="ap-link"
                          href={progressEvidenceHref(
                            item.row,
                            sessionReturnContext,
                          )}
                        >
                          {item.row.attempt.question.question_id ??
                            "Generated question"}
                        </Link>
                        <details>
                          <summary>Read question</summary>
                          <p className="ap-preserve-text">
                            {item.row.attempt.question.prompt_text}
                          </p>
                        </details>
                      </th>
                      <td>
                        {item.row.attempt.question.concept_ids
                          .map(conceptName)
                          .join(", ")}
                      </td>
                      <td>{item.students.size}</td>
                      <td>{item.responses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {progressView === "sessions" && (
        <div className="ap-subview">
          <p className="ap-note">
            All saved sessions in the selected evidence source, including
            sessions without submitted answers.
          </p>
          {progress.sessions.length === 0 ? (
            <p className="ap-empty">No study sessions yet.</p>
          ) : (
            <div className="ap-table-scroll">
              <table className="ap-ledger">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>When</th>
                    <th>Status</th>
                    <th>Answers</th>
                  </tr>
                </thead>
                <tbody>
                  {[...progress.sessions]
                    .sort(
                      (a, b) =>
                        Date.parse(b.session.started_at) -
                        Date.parse(a.session.started_at),
                    )
                    .map((item) => (
                      <tr key={item.session.id}>
                        <th>
                          <Link
                            className="ap-link"
                            href={progressSessionHref(
                              item.session.id,
                              sessionReturnContext,
                            )}
                          >
                            {studentName(item.session.student_id)}
                          </Link>
                        </th>
                        <td>{date(item.session.started_at)}</td>
                        <td>
                          {label(item.session.status)}
                          <small>{originLabel(item.session.data_origin)}</small>
                        </td>
                        <td>
                          {
                            item.attempts.filter(
                              (attempt) => attempt.submitted_at,
                            ).length
                          }
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
  const details = (
    <>
      {!selection ? (
        <p className="ap-empty">
          Select a cell in the class grid to read that student’s answers on that
          idea, or a column heading for the idea.
        </p>
      ) : (
        <>
          <div className="ap-detail-section">
            <h3>
              {selectedStudent
                ? studentName(selectedStudent)
                : selectedConcept
                  ? conceptName(selectedConcept)
                  : "Original student work"}
              {selectedStudent && selectedConcept && (
                <span>
                  {" · "}
                  {conceptName(selectedConcept)}
                </span>
              )}
            </h3>
            {!selectedStudent && selectedConcept && (
              <ul className="ap-objectives">
                {content.concepts
                  .get(selectedConcept)
                  ?.objectives.map((objective) => (
                    <li key={objective}>{objective}</li>
                  ))}
              </ul>
            )}
            <div className="ap-detail-actions">
              <Link
                className="ap-link"
                href={`/teacher/insights?${new URLSearchParams(context)}#responses`}
              >
                Open assignment evidence
              </Link>
              <Link href={href({}, "grid")} scroll={false}>
                Clear selection
              </Link>
            </div>
          </div>
          {!selectedStudent && selectedMetric && (
            <div className="ap-detail-section">
              <dl className="ap-concept-totals">
                <div>
                  <dt>Students who reached it</dt>
                  <dd>
                    {progress.reachedByConcept[selectedMetric.concept_id]} of{" "}
                    {summary.enrolled}
                  </dd>
                </div>
                <div>
                  <dt>Latest answer correct</dt>
                  <dd>
                    {selectedMetric.latest.correct} of{" "}
                    {selectedMetric.latest.accepted_students}
                  </dd>
                </div>
                <div>
                  <dt>Independent evidence correct</dt>
                  <dd>
                    {selectedMetric.independent.correct} of{" "}
                    {selectedMetric.independent.accepted_students}
                  </dd>
                </div>
                <div>
                  <dt>After content help correct</dt>
                  <dd>
                    {selectedMetric.content_assisted.correct} of{" "}
                    {selectedMetric.content_assisted.accepted_students}
                  </dd>
                </div>
              </dl>
              <p className="ap-note">
                Students, latest eligible answer in each group; correct out of
                accepted judgments, including uncertain judgments.
              </p>
              <details className="ap-record-details">
                <summary>Full result breakdown and uncertainty</summary>
                {(
                  [
                    ["Latest answers", selectedMetric.latest],
                    ["Independent evidence", selectedMetric.independent],
                    ["After content help", selectedMetric.content_assisted],
                    ["Immediate retest", selectedMetric.immediate_retest],
                    ["Later review", selectedMetric.delayed_review],
                  ] as const
                ).map(([name, result]) => (
                  <section className="ap-result-section" key={name}>
                    <h4>{name}</h4>
                    <ResultSummary results={result} />
                  </section>
                ))}
              </details>
            </div>
          )}
          {selectedEvidence.length === 0 ? (
            <p className="ap-empty">
              No recorded questions or answers for this selection in the chosen
              evidence source.
            </p>
          ) : !selectedStudent && selectedConcept ? (
            <details className="ap-original-work">
              <summary>
                Original student work ({selectedEvidence.length}{" "}
                {selectedEvidence.length === 1 ? "attempt" : "attempts"})
              </summary>
              {evidenceList}
            </details>
          ) : (
            evidenceList
          )}
        </>
      )}
    </>
  );
  return (
    <div className="assignment-progress">
      <ProgressPanes
        pane={activePane}
        progressView={progressView}
        selectedStudent={selectedStudent}
        selectedConcept={selectedConcept}
        selectionKey={`${selectedStudent ?? ""}:${selectedConcept ?? ""}:${progressView}`}
        returnFocusId={progressSelectionId(selectedStudent, selectedConcept)}
        closeHref={href(selected, "grid")}
        openHref={href(selected, "details")}
        main={main}
        details={details}
      />
    </div>
  );
}
