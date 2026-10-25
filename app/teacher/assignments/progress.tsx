import Link from "next/link";
import type { ApprovedContent } from "../../../lib/evidence/content.ts";
import { date, label, originLabel, ResultSummary } from "../presentation.tsx";
import {
  buildAssignmentProgress,
  progressEvaluation,
  progressEvaluationHistory,
  progressEvidenceHref,
  progressHref,
  progressStatusLabel,
  selectProgressEvidence,
  type AssignmentEvidence,
  type OriginFilter,
  type ProgressListContext,
} from "./progress-model.ts";
import "./progress.css";

export function AssignmentProgress({
  data,
  content,
  origin,
  selectedStudent,
  selectedConcept,
  listContext,
}: {
  data: AssignmentEvidence;
  content: ApprovedContent;
  origin: OriginFilter;
  selectedStudent?: string;
  selectedConcept?: string;
  listContext?: ProgressListContext;
}) {
  const progress = buildAssignmentProgress(data, origin);
  const { summary, metrics } = progress;
  const selectionHref = (
    selection: { student?: string; concept?: string } = {},
  ) => progressHref(data.assignment_id, origin, selection, listContext);
  const conceptName = (id: string) => content.concepts.get(id)?.title ?? id;
  const studentName = (id: string) =>
    data.students.find((student) => student.student_id === id)?.display_name ??
    "Student";
  const selection = selectedStudent || selectedConcept;
  const selectedEvidence = selection
    ? selectProgressEvidence(
        progress.sessions,
        selectedStudent,
        selectedConcept,
      )
    : [];
  const context = {
    assignment: data.assignment_id,
    origin,
    ...(selectedConcept ? { concept: selectedConcept } : {}),
  };
  return (
    <div className="assignment-progress">
      <section className="ap-heading">
        <div>
          <p className="lp-eyebrow">Learning sessions → evidence</p>
          <h2>Class progress</h2>
          <p>
            Inspect participation and saved work for this assignment’s approved
            lesson version.
          </p>
        </div>
        <Link
          className="lp-text-link"
          href={`/teacher/interventions?${new URLSearchParams(context)}`}
        >
          Teacher-assigned follow-ups →
        </Link>
      </section>
      <form action="/teacher/assignments" className="ap-origin-filter">
        <input type="hidden" name="assignment" value={data.assignment_id} />
        <input type="hidden" name="view" value="progress" />
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
        <label className="lp-field">
          Evidence source
          <select className="lp-input" name="origin" defaultValue={origin}>
            <option value="all">All demo evidence</option>
            <option value="synthetic_fixture">
              Prepared synthetic histories
            </option>
            <option value="live_demo">Live demo sessions</option>
          </select>
        </label>
        <button className="lp-button">Apply source</button>
      </form>
      <p className="ap-note">
        {origin === "synthetic_fixture"
          ? "Prepared fictional histories; these are examples, not measured learning outcomes."
          : origin === "live_demo"
            ? "Saved sessions from fictional demo accounts."
            : "Prepared fictional histories and live demo sessions shown together. Filter to inspect either source."}
      </p>
      <dl className="ap-summary">
        <div>
          <dt>Students enrolled</dt>
          <dd>
            {summary.enrolled}
            <p>Authorized class roster</p>
          </dd>
        </div>
        <div>
          <dt>Students started</dt>
          <dd>
            {summary.startedStudents}
            <small> / {summary.enrolled}</small>
            <p>{summary.studentsAnswered} students submitted an answer</p>
          </dd>
        </div>
        <div>
          <dt>Completed sessions</dt>
          <dd>
            {summary.completedSessions}
            <p>Recorded session completions</p>
          </dd>
        </div>
        <div>
          <dt>Submitted responses</dt>
          <dd>
            {summary.submittedResponses}
            <p>Individual answers, including retests</p>
          </dd>
        </div>
        <div>
          <dt>Missing responses</dt>
          <dd>
            {summary.unansweredQuestions}
            <p>Presented questions without a saved answer</p>
          </dd>
        </div>
        <div>
          <dt>Evaluations pending</dt>
          <dd>
            {summary.pendingEvaluations}
            <p>
              {summary.failedEvaluations} failed · {summary.rejectedEvaluations}{" "}
              rejected
            </p>
          </dd>
        </div>
      </dl>
      {summary.startedStudents === 0 && (
        <div className="ap-empty">
          <h3>
            {summary.enrolled === 0
              ? "No students enrolled yet"
              : "No learning sessions in this view yet"}
          </h3>
          <p>
            {summary.enrolled === 0
              ? "This class does not have an enrolled student roster yet. "
              : "Saved student responses will appear here after students start this assignment and answer. "}
            Missing answers are not incorrect answers.
          </p>
        </div>
      )}
      <section
        className="lp-panel ap-grid-panel"
        aria-labelledby="ap-grid-heading"
      >
        <div className="ap-section-heading">
          <div>
            <h3 id="ap-grid-heading">Students and concepts</h3>
            <p>
              Latest submitted answer per student and concept. Select a cell
              with recorded activity to inspect the work.
            </p>
          </div>
          <span className="lp-badge lp-badge-neutral">
            {data.students.length} students · {metrics.concepts.length} concepts
          </span>
        </div>
        {data.students.length === 0 ? (
          <p className="ap-empty">No students are enrolled in this class.</p>
        ) : (
          <div
            className="ap-table-scroll"
            role="region"
            aria-label="Student and concept results; scroll horizontally for more concepts"
            tabIndex={0}
          >
            <table className="ap-grid">
              <caption className="ap-sr-only">
                Latest response results. Counts describe evidence, not mastery.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  {metrics.concepts.map((concept) => (
                    <th scope="col" key={concept.concept_id}>
                      <Link
                        href={selectionHref({
                          concept: concept.concept_id,
                        })}
                      >
                        {conceptName(concept.concept_id)}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {progress.students.map((student) => (
                  <tr key={student.student_id}>
                    <th scope="row">
                      <Link
                        href={selectionHref({
                          student: student.student_id,
                        })}
                      >
                        {student.display_name}
                      </Link>
                      <small>
                        {student.sessionCount} sessions ·{" "}
                        {student.responseCount} responses
                      </small>
                    </th>
                    {student.cells.map((cell) => (
                      <td
                        key={cell.conceptId}
                        className={
                          selectedStudent === student.student_id &&
                          selectedConcept === cell.conceptId
                            ? "ap-selected-cell"
                            : undefined
                        }
                      >
                        {cell.evidenceCount > 0 ? (
                          <Link
                            className={`ap-cell ap-status-${cell.status}`}
                            href={selectionHref({
                              student: student.student_id,
                              concept: cell.conceptId,
                            })}
                            aria-label={`${student.display_name}, ${conceptName(cell.conceptId)}: ${progressStatusLabel(cell.status)}. Inspect evidence.`}
                          >
                            <span>{progressStatusLabel(cell.status)}</span>
                            {cell.latestSubmitted?.attempt.assistance ? (
                              <small>
                                {cell.latestSubmitted.attempt.assistance
                                  .independent_retrieval_eligible_by_concept[
                                  cell.conceptId
                                ]
                                  ? "Independent evidence"
                                  : cell.latestSubmitted.attempt.intent ===
                                      "immediate_retest"
                                    ? "Immediate retest"
                                    : cell.latestSubmitted.attempt.assistance
                                          .assistance_level === "none_recorded"
                                      ? "Not independent evidence"
                                      : `Help: ${label(cell.latestSubmitted.attempt.assistance.assistance_level)}`}
                              </small>
                            ) : (
                              <small>Presented; awaiting response</small>
                            )}
                          </Link>
                        ) : (
                          <span className="ap-no-answer">No answer yet</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="ap-note">
          “Independent” uses the recorded eligibility for that concept. Success
          after help or on an immediate retest does not establish lasting
          understanding.
        </p>
      </section>
      <section
        id="cell-evidence"
        className="lp-panel ap-evidence"
        aria-labelledby="ap-evidence-heading"
      >
        <div className="ap-section-heading">
          <div>
            <h3 id="ap-evidence-heading">
              {selectedStudent
                ? studentName(selectedStudent)
                : "Original student work"}
              {selectedConcept ? ` · ${conceptName(selectedConcept)}` : ""}
            </h3>
            <p>
              {selection
                ? "Saved questions, original responses, assistance and evaluation status for this selection."
                : "Select a student, concept or result above to inspect the corresponding saved evidence."}
            </p>
          </div>
          {selection && (
            <Link className="lp-text-link" href={selectionHref()}>
              Clear selection
            </Link>
          )}
        </div>
        {selection && selectedEvidence.length === 0 && (
          <p className="ap-empty">
            No recorded questions or answers for this selection in the chosen
            evidence source.
          </p>
        )}
        <ol className="ap-evidence-list">
          {selectedEvidence.map((row) => {
            const { attempt, evidence } = row;
            const evaluation = progressEvaluation(row);
            const latestEvaluation = progressEvaluationHistory(row).at(-1);
            const accepted =
              evaluation?.validation_status === "accepted"
                ? evaluation
                : undefined;
            const judgments =
              accepted?.result?.per_concept_results.filter(
                (item) =>
                  !selectedConcept || item.concept_id === selectedConcept,
              ) ?? [];
            return (
              <li key={attempt.id} className="ap-evidence-item">
                <header>
                  <strong>{studentName(evidence.session.student_id)}</strong>
                  <span>
                    {originLabel(evidence.session.data_origin)} ·{" "}
                    {label(attempt.intent)}
                  </span>
                </header>
                <p className="ap-evidence-date">
                  {attempt.submitted_at
                    ? `Answered ${date(attempt.submitted_at)}`
                    : `Presented ${date(attempt.presented_at)}`}
                </p>
                <h4>Question</h4>
                <p className="ap-preserve-text">
                  {attempt.question.prompt_text}
                </p>
                <h4>Original response</h4>
                <blockquote className="ap-preserve-text">
                  {attempt.response_text ?? "No response submitted."}
                </blockquote>
                {attempt.assistance && (
                  <p className="ap-note">
                    {attempt.assistance.assistance_level === "none_recorded"
                      ? "No content assistance recorded before this answer."
                      : `Recorded assistance: ${label(attempt.assistance.assistance_level)}.`}
                  </p>
                )}
                {judgments.length > 0 ? (
                  <ul className="ap-judgments">
                    {judgments.map((judgment) => (
                      <li key={judgment.concept_id}>
                        <span>{conceptName(judgment.concept_id)}</span>
                        <strong className={`ap-status-${judgment.correctness}`}>
                          {progressStatusLabel(judgment.correctness)}
                        </strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ap-caution">
                    {!attempt.submitted_at
                      ? "Waiting for a student response."
                      : evaluation?.validation_status === "evaluation_failed"
                        ? "Evaluation failed. The original answer is preserved."
                        : evaluation?.validation_status === "rejected"
                          ? "Evaluation rejected. No accepted result yet."
                          : "Evaluation pending. The original answer is preserved."}
                  </p>
                )}
                {accepted?.result?.uncertainty_reason && (
                  <p className="ap-caution">
                    <strong>Uncertainty:</strong>{" "}
                    {accepted.result.uncertainty_reason}
                  </p>
                )}
                {accepted && (
                  <p className="ap-note">
                    {accepted.evaluator.type === "synthetic_fixture"
                      ? "Prepared example judgment; not a model result."
                      : accepted.evaluator.type === "human_review"
                        ? "Human-reviewed judgment."
                        : "Accepted model evaluation."}
                  </p>
                )}
                {accepted &&
                  latestEvaluation &&
                  accepted.id !== latestEvaluation.id &&
                  latestEvaluation.validation_status !== "accepted" && (
                    <p className="ap-caution">
                      A later evaluation is{" "}
                      {label(latestEvaluation.validation_status)}. The accepted
                      judgment remains in effect; the full session preserves
                      both records.
                    </p>
                  )}
                <p className="ap-source-reference">
                  Lesson version {attempt.question.content_ref.content_version}{" "}
                  · Passages {attempt.question.source_passage_ids.join(", ")}
                </p>
                <Link
                  className="lp-text-link"
                  href={progressEvidenceHref(row, origin, selectedConcept)}
                >
                  Open full session evidence →
                </Link>
              </li>
            );
          })}
        </ol>
        {selection && (
          <Link
            className="lp-text-link"
            href={`/teacher/insights?${new URLSearchParams(context)}#responses`}
          >
            Open assignment evidence workspace →
          </Link>
        )}
      </section>
      <section
        className="lp-panel ap-concepts"
        aria-labelledby="ap-concepts-heading"
      >
        <h3 id="ap-concepts-heading">Concept results across the class</h3>
        <p className="ap-note">
          Each group counts the latest eligible answer from each student, once
          per concept. A student may appear in both independent and assisted
          groups.
        </p>
        {metrics.concepts.map((concept) => (
          <details
            key={concept.concept_id}
            open={selectedConcept === concept.concept_id}
          >
            <summary>
              <span>{conceptName(concept.concept_id)}</span>
              <span>
                {concept.latest.correct} correct ·{" "}
                {concept.latest.accepted_students} assessed ·{" "}
                {concept.latest.no_response} without answers
              </span>
            </summary>
            <div className="ap-concept-breakdown">
              <section>
                <h4>Latest answers</h4>
                <ResultSummary results={concept.latest} />
              </section>
              <section>
                <h4>Independent evidence</h4>
                <ResultSummary results={concept.independent} />
              </section>
              <section>
                <h4>After content assistance</h4>
                <ResultSummary results={concept.content_assisted} />
              </section>
              <section>
                <h4>Immediate retest</h4>
                <ResultSummary results={concept.immediate_retest} />
              </section>
              <section>
                <h4>Later review</h4>
                <ResultSummary results={concept.delayed_review} />
              </section>
            </div>
            <Link
              className="lp-text-link"
              href={selectionHref({
                concept: concept.concept_id,
              })}
            >
              Inspect concept evidence →
            </Link>
          </details>
        ))}
      </section>
    </div>
  );
}
