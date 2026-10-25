import type { ApprovedContent } from "../../../lib/evidence/content.ts";
import type { ContentRef } from "../../../lib/evidence/contracts.ts";
import { assignedReading } from "../../../lib/assignments/reading.ts";
import { Reading } from "../../components/reading.tsx";
import {
  assignmentLessonCoverage,
  projectStudentLearningPreview,
} from "./preview-model.ts";
import "./lesson-review.css";

type LessonProps = { content: ApprovedContent; contentRef: ContentRef };

export function AssignmentLessonReview({ content, contentRef }: LessonProps) {
  const coverage = assignmentLessonCoverage(content, contentRef);
  const questions = [...content.questions.entries()];
  return (
    <div className="awa-lesson-review">
      <section className="awa-review-section" id="learning-goals">
        <h2 className="awa-review-title">Learning goals</h2>
        <p className="awa-review-meta">
          {coverage.concepts.length} concepts with their approved objectives and
          source passages. One question can cover several concepts.
        </p>
        <div className="awa-review-concepts">
          {coverage.concepts.map((concept) => (
            <article key={concept.id} className="awa-review-concept">
              <h3 className="awa-review-concept-title">{concept.title}</h3>
              <ul className="awa-review-objectives">
                {concept.objectives.map((objective) => (
                  <li key={objective}>{objective}</li>
                ))}
              </ul>
              <p className="awa-review-meta">
                {concept.questionCount} prepared questions · Reading:{" "}
                {concept.passageIds.map((id, index) => (
                  <span key={id}>
                    {index > 0 && ", "}
                    <a className="lp-text-link" href={`#${id}`}>
                      {id}
                    </a>
                  </span>
                ))}
              </p>
            </article>
          ))}
        </div>
      </section>
      <section className="awa-review-section" id="prepared-practice">
        <h2 className="awa-review-title">Prepared questions and tutoring</h2>
        <p className="awa-review-meta">
          {coverage.questionCount} distinct prepared questions, including{" "}
          {coverage.sequenceQuestionCount} in the approved tutoring sequence.
          Coverage counts include questions used for clarification, diagnosis,
          and retesting; students do not necessarily answer every question.
        </p>
        <details className="lp-evidence-details">
          <summary>
            Inspect question bank and teacher-only answer guidance
          </summary>
          <p className="my-3">
            Private teacher review. Answer guidance and unrevealed follow-up
            questions are excluded from the student learning preview.
          </p>
          {questions.map(([id, question]) => (
            <details className="lp-evidence-details" key={id}>
              <summary>{question.prompt_text}</summary>
              <p className="lp-panel-description my-3">
                {id} ·{" "}
                {question.concept_ids
                  .map(
                    (conceptId) =>
                      content.concepts.get(conceptId)?.title ?? conceptId,
                  )
                  .join(", ")}
                {" · "}Reading: {question.source_passage_ids.join(", ")}
              </p>
              <h3>Private answer guidance</h3>
              <p className="my-3 whitespace-pre-wrap">
                {question.rubric.answer_guidance}
              </p>
              <ul className="list-disc pl-5 space-y-2">
                {question.rubric.criteria.map((criterion) => (
                  <li key={criterion}>{criterion}</li>
                ))}
              </ul>
            </details>
          ))}
        </details>
        <details className="lp-evidence-details awa-sequence">
          <summary>Inspect the prepared tutoring sequence</summary>
          <p className="my-3">
            Students begin with the approved starting question. Subsequent steps
            depend on their saved responses and the permitted tutoring actions.
            The steps below are available branches, not a checklist every
            student must complete.
          </p>
          <p className="lp-panel-description">
            Starting question: {content.sequence.initial_question_id}. At most{" "}
            {content.sequence.bounds.max_student_response_prompts} response
            prompts in a prepared tutoring episode.
          </p>
          <ol className="awa-sequence-list">
            {content.sequence.nodes.map((node) => (
              <li key={node.node_id}>
                <h3>{node.kind.replaceAll("_", " ")}</h3>
                <p className="lp-panel-description">{node.node_id}</p>
                {node.prompt && <p className="my-2">{node.prompt}</p>}
                {node.feedback && <p className="my-2">{node.feedback}</p>}
                {node.feedback_variants && (
                  <details className="lp-evidence-details">
                    <summary>Feedback variants</summary>
                    {Object.entries(node.feedback_variants).map(
                      ([kind, text]) => (
                        <p className="my-3" key={kind}>
                          <strong>{kind.replaceAll("_", " ")}: </strong>
                          {text}
                        </p>
                      ),
                    )}
                  </details>
                )}
              </li>
            ))}
          </ol>
        </details>
      </section>
      <section className="awa-review-section awa-reading" id="assigned-reading">
        <h2 className="awa-review-title">Assigned reading</h2>
        <p className="awa-review-meta">
          {coverage.passageCount} passages from the exact source version
          attached to this lesson.
        </p>
        <Reading reading={assignedReading(contentRef, content)} />
      </section>
    </div>
  );
}

export function StudentLearningPreview({
  content,
  contentRef,
  title,
  instructions,
  active,
  assignmentId,
  className,
}: LessonProps & {
  title: string;
  instructions: string | null;
  active: boolean;
  assignmentId?: string;
  className?: string;
}) {
  const preview = projectStudentLearningPreview(content, contentRef);
  return (
    <div className="awa-student-preview">
      <p className="awa-preview-caption">
        What students see before they start, using this assignment’s fixed
        lesson version.
      </p>
      <section className="awa-preview-frame" aria-label="What students see">
        <p className="awa-preview-kicker">
          My Learning{className ? ` · ${className}` : ""}
        </p>
        <div className="awa-preview-card">
          <div className="awa-preview-card-heading">
            <h2 className="awa-preview-title">{title}</h2>
            <span className="awa-preview-state">
              {active ? "Ready to start" : "Not active yet"}
            </span>
          </div>
          <p className="awa-preview-instructions">
            {instructions || "No additional instructions were provided."}
          </p>
          <div className="awa-preview-stack">
            <h3 className="awa-preview-label">You’ll practise</h3>
            {preview.concepts.map((concept) => (
              <div className="awa-preview-goal" key={concept.id}>
                <p className="awa-preview-concept">{concept.title}</p>
                {concept.objectives.map((objective) => (
                  <p key={objective}>{objective}</p>
                ))}
              </div>
            ))}
          </div>
          <div className="awa-preview-stack">
            <h3 className="awa-preview-label">How this works</h3>
            <ol className="awa-preview-how">
              <li>
                <span>Read the assigned pages when you’re ready.</span>
              </li>
              <li>
                <span>
                  Answer questions in your own words. You’ll see questions
                  selected from the approved lesson, rather than every question.
                </span>
              </li>
              <li>
                <span>
                  Ask for help when you need it. Help actually shown is saved
                  with your work for your teacher.
                </span>
              </li>
            </ol>
          </div>
        </div>
      </section>
      <p className="awa-preview-caption awa-preview-readonly">
        Read-only preview. No student session is started, no answer is
        submitted, and reading is not recorded as assistance.
      </p>
      <details className="awa-preview-disclosure">
        <summary>Start, resume, and tutoring interactions</summary>
        <div className="awa-preview-disclosure-body">
          <p>
            {active
              ? "Enrolled students open this assignment from their own Assignments page."
              : "After activation, enrolled students can open this assignment from their own Assignments page."}{" "}
            They can start practice, resume an active saved session, or review
            completed work. This teacher preview does not open those controls.
          </p>
          <ul>
            {preview.interactions.map((interaction) => (
              <li key={interaction}>{interaction}</li>
            ))}
          </ul>
          <p className="awa-preview-caption">
            The next activity depends on the student’s response. Original work
            and any help actually shown remain part of the saved evidence.
          </p>
        </div>
      </details>
      <details className="awa-preview-disclosure">
        <summary>Assignment and published version</summary>
        <dl className="awa-preview-version">
          {assignmentId && (
            <>
              <dt>Assignment</dt>
              <dd>{assignmentId}</dd>
            </>
          )}
          <dt>Published lesson</dt>
          <dd>{preview.contentRef.package_id}</dd>
          <dt>Version</dt>
          <dd>{preview.contentRef.content_version}</dd>
          <dt>Availability</dt>
          <dd>
            {active
              ? "Active for enrolled students"
              : "Inactive — teacher activation required"}
          </dd>
        </dl>
      </details>
      <details className="awa-preview-disclosure awa-reading">
        <summary>Read the assigned passages</summary>
        <div className="awa-preview-disclosure-body">
          <Reading reading={preview.reading} />
        </div>
      </details>
    </div>
  );
}
