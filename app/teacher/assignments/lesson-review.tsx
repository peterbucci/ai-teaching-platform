import type { ApprovedContent } from "../../../lib/evidence/content.ts";
import type { ContentRef } from "../../../lib/evidence/contracts.ts";
import { assignedReading } from "../../../lib/assignments/reading.ts";
import { Reading } from "../../components/reading.tsx";
import {
  assignmentLessonCoverage,
  projectStudentLearningPreview,
} from "./preview-model.ts";

type LessonProps = { content: ApprovedContent; contentRef: ContentRef };

export function AssignmentLessonReview({ content, contentRef }: LessonProps) {
  const coverage = assignmentLessonCoverage(content, contentRef);
  const questions = [...content.questions.entries()];
  return (
    <div className="awa-lesson-review">
      <section className="lp-panel" id="learning-goals">
        <p className="lp-eyebrow">Published lesson · Learning goals</p>
        <h2>What students will explore</h2>
        <p className="lp-panel-description">
          {coverage.concepts.length} concepts with their approved objectives and
          source passages. One question can cover several concepts.
        </p>
        <div className="awa-concept-cards">
          {coverage.concepts.map((concept) => (
            <article key={concept.id} className="awa-concept-card">
              <h3>{concept.title}</h3>
              <ul className="list-disc pl-5 my-3 space-y-2">
                {concept.objectives.map((objective) => (
                  <li key={objective}>{objective}</li>
                ))}
              </ul>
              <p className="lp-panel-description">
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
      <section className="lp-panel" id="prepared-practice">
        <p className="lp-eyebrow">Published lesson · Question coverage</p>
        <h2>Prepared questions and tutoring</h2>
        <p className="lp-panel-description">
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
      <section className="lp-panel awa-reading" id="assigned-reading">
        <p className="lp-eyebrow">Published lesson · Approved reading</p>
        <h2>Assigned reading</h2>
        <p className="lp-panel-description mb-4">
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
}: LessonProps & {
  title: string;
  instructions: string | null;
  active: boolean;
  assignmentId?: string;
}) {
  const preview = projectStudentLearningPreview(content, contentRef);
  return (
    <div className="awa-preview">
      <section className="lp-panel">
        <p className="lp-eyebrow">Read-only student learning preview</p>
        <h2>{title}</h2>
        <p className="lp-panel-description">
          This preview shows the approved learning material. Opening it does not
          start a student session, submit an answer, or record reading as
          assistance.
        </p>
        <dl className="awa-preview-identity">
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
        <h3>Instructions</h3>
        <p className="my-3 whitespace-pre-wrap">
          {instructions || "No additional instructions were provided."}
        </p>
      </section>
      <section className="lp-panel">
        <h2>Start or continue learning</h2>
        <p>
          {active
            ? "Enrolled students open this assignment from their own Assignments page."
            : "After activation, enrolled students can open this assignment from their own Assignments page."}{" "}
          They can start practice, resume an active saved session, or review
          completed work. This teacher preview does not open those controls.
        </p>
        <h3 className="mt-5">What to expect in a session</h3>
        <ul className="list-disc pl-5 my-3 space-y-2">
          {preview.interactions.map((interaction) => (
            <li key={interaction}>{interaction}</li>
          ))}
        </ul>
        <p className="lp-panel-description">
          The next activity depends on the student’s response. Original work and
          any help actually shown remain part of the saved evidence.
        </p>
      </section>
      <section className="lp-panel">
        <h2>Learning goals</h2>
        <div className="awa-concept-cards">
          {preview.concepts.map((concept) => (
            <article key={concept.id} className="awa-concept-card">
              <h3>{concept.title}</h3>
              <ul className="list-disc pl-5 my-3 space-y-2">
                {concept.objectives.map((objective) => (
                  <li key={objective}>{objective}</li>
                ))}
              </ul>
              <p className="lp-panel-description">
                Reading: {concept.passageIds.join(", ")}
              </p>
            </article>
          ))}
        </div>
      </section>
      <section className="lp-panel awa-reading">
        <h2>Assigned reading</h2>
        <Reading reading={preview.reading} />
      </section>
    </div>
  );
}
