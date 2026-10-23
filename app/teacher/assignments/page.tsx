import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { AuthError, requireActor } from "../../../lib/auth.ts";
import { EvidenceError, evidenceAccess } from "../../../lib/evidence/store.ts";
import { readAssignmentContent } from "../../../lib/lessons/store.ts";
import { teacherAssignments } from "../../../lib/teacher/store.ts";
import { assignmentReview } from "../../../lib/assignments/store.ts";
import { assignedReading } from "../../../lib/assignments/reading.ts";
import { Reading } from "../../components/reading.tsx";
import { Icon } from "../../components/icons.tsx";
import { TeacherFrame, date } from "../presentation.tsx";
import { ApproveAssignment } from "./approve.tsx";

export const dynamic = "force-dynamic";
async function load(id?: string) {
  try {
    const access = evidenceAccess(await requireActor());
    const assignments = await teacherAssignments(access);
    const selected = id ?? assignments[0]?.id;
    return {
      assignments,
      selected: selected ? await assignmentReview(access, selected) : null,
      content: selected
        ? await readAssignmentContent(access, selected, "teacher")
        : null,
    };
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
export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ assignment?: string }>;
}) {
  const { assignments, selected, content } = await load(
    (await searchParams).assignment,
  );
  const questions = content
    ? [...content.questions.values()].filter(
        (question) =>
          !question.sequence_id ||
          question.question_id === content.sequence.initial_question_id,
      )
    : [];
  return (
    <TeacherFrame section="Assignments">
      <header className="lp-page-heading">
        <p className="lp-eyebrow">Prepare learning</p>
        <h1 className="lp-title">Assignments</h1>
        <p className="lp-intro">
          Review the source, learning goals, and practice before making them
          available to your class.
        </p>
        <Link href="/teacher/lessons" className="lp-button">
          Review and publish lessons
        </Link>
      </header>
      {assignments.length > 1 && (
        <form action="/teacher/assignments" className="lp-filter-bar">
          <label className="lp-field">
            Assignment and class
            <select
              className="lp-input"
              name="assignment"
              defaultValue={selected?.id}
            >
              {assignments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} — {item.class_name}
                </option>
              ))}
            </select>
          </label>
          <button className="lp-button">Open assignment</button>
        </form>
      )}
      {selected && content ? (
        <>
          <section className="lp-assignment-summary">
            <p className="lp-eyebrow">{selected.class_name}</p>
            <h2>{selected.title}</h2>
            <p>
              Approved lesson version {selected.content_ref.content_version}
            </p>
            <p>
              A versioned reading and grounded practice sequence. Students’
              original answers, feedback, and source references stay linked to
              this assignment.
            </p>
            <div className="lp-assignment-facts">
              <span className="lp-badge">
                {selected.teacher_approved_at
                  ? "Active for students"
                  : "Awaiting teacher approval"}
              </span>
              <span className="lp-badge lp-badge-neutral">
                {selected.approved_concept_ids.length} learning goals
              </span>
              <span className="lp-badge lp-badge-neutral">
                {selected.approved_passage_ids.length} reading passages
              </span>
              <span className="lp-badge lp-badge-neutral">
                {questions.length} prepared questions
              </span>
            </div>
          </section>
          <div className="lp-assignment-layout">
            <div className="lp-assignment-main">
              <section id="assignment-instructions" className="lp-panel">
                <h2>Instructions for students</h2>
                <p className="whitespace-pre-wrap">
                  {selected.instructions ||
                    "No additional instructions were provided."}
                </p>
              </section>
              <section id="learning-goals" className="lp-panel">
                <p className="lp-eyebrow">01 · Learning goals</p>
                <h2>What students will explore</h2>
                <p className="lp-panel-description mb-4">
                  The approved concepts for this assignment. Expand a goal to
                  review its objectives.
                </p>
                {[...content.concepts.values()]
                  .filter((concept) =>
                    selected.approved_concept_ids.includes(concept.id),
                  )
                  .map((concept) => (
                    <details key={concept.id} className="lp-evidence-details">
                      <summary>{concept.title}</summary>
                      <ul className="list-disc pl-5 my-3 space-y-2">
                        {concept.objectives.map((objective) => (
                          <li key={objective}>{objective}</li>
                        ))}
                      </ul>
                    </details>
                  ))}
              </section>
              <section id="prepared-practice" className="lp-panel">
                <p className="lp-eyebrow">02 · Guided practice</p>
                <h2>Prepared practice</h2>
                <p className="lp-panel-description mb-4">
                  {questions.length} prepared questions and an approved guided
                  sequence for this lesson.
                </p>
                <details className="lp-evidence-details">
                  <summary>Questions and answer guidance</summary>
                  {questions.map((question) => (
                    <details
                      className="lp-evidence-details"
                      key={question.question_id}
                    >
                      <summary>{question.prompt_text}</summary>
                      <p className="my-3">{question.rubric.answer_guidance}</p>
                      <ul className="list-disc pl-5">
                        {question.rubric.criteria.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </details>
                <details className="lp-evidence-details">
                  <summary>Guided practice sequence</summary>
                  <p className="my-3">
                    Initial question → clarification or diagnostic follow-up →
                    grounded feedback → fresh retests. Only the permitted steps
                    are used.
                  </p>
                  {content.sequence.nodes
                    .filter((node) => node.prompt || node.feedback)
                    .map((node) => (
                      <div key={node.node_id} className="my-4">
                        <h3 className="font-semibold">
                          {node.node_id} · {node.kind.replaceAll("_", " ")}
                        </h3>
                        <p className="my-2">{node.prompt ?? node.feedback}</p>
                      </div>
                    ))}
                </details>
              </section>
              <section id="assigned-reading" className="lp-panel">
                <p className="lp-eyebrow">03 · Approved source</p>
                <h2>Assigned reading</h2>
                <Reading
                  reading={assignedReading(selected.content_ref, content)}
                />
              </section>
            </div>
            <aside
              className="lp-panel lp-assignment-sidebar"
              aria-label="Assignment review and activation"
            >
              <span
                className={`lp-badge${selected.teacher_approved_at ? "" : " lp-badge-neutral"}`}
              >
                {selected.teacher_approved_at
                  ? "Active assignment"
                  : "Review required"}
              </span>
              <h2>
                {selected.teacher_approved_at
                  ? "Ready for your class"
                  : "Your review matters"}
              </h2>
              {selected.teacher_approved_at ? (
                <>
                  <p role="status">
                    Approved by your teacher account on{" "}
                    {date(selected.teacher_approved_at)}.
                  </p>
                  <Link
                    href={`/teacher/insights?assignment=${selected.id}`}
                    className="lp-button"
                  >
                    View learning evidence <Icon name="arrow" />
                  </Link>
                </>
              ) : (
                <>
                  <p>
                    This lesson version is approved. Activating it records your
                    separate classroom review.
                  </p>
                  <ApproveAssignment
                    id={selected.id}
                    token={selected.review_token}
                  />
                </>
              )}
              <nav
                className="lp-assignment-review-list"
                aria-label="Review assignment sections"
              >
                <a href="#assignment-instructions">
                  <Icon name="check" /> Student instructions
                </a>
                <a href="#learning-goals">
                  <Icon name="check" /> Learning goals
                </a>
                <a href="#prepared-practice">
                  <Icon name="chat" /> Prepared practice
                </a>
                <a href="#assigned-reading">
                  <Icon name="book" /> Assigned reading
                </a>
              </nav>
              <p className="mt-4">
                Changes to an activated reading or its learning goals need a new
                assignment and review. Saved student work keeps its original
                version.
              </p>
            </aside>
          </div>
        </>
      ) : (
        <section className="lp-panel">
          <h2>No assignments available</h2>
          <p>No assignments are available for this teacher account.</p>
        </section>
      )}
    </TeacherFrame>
  );
}
