import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthError, requireActor } from "../../../lib/auth.ts";
import { EvidenceError, evidenceAccess } from "../../../lib/evidence/store.ts";
import { loadApprovedContent } from "../../../lib/evidence/content.ts";
import { teacherAssignments } from "../../../lib/teacher/store.ts";
import { OriginFilterSchema } from "../../../lib/teacher/metrics.ts";
import { assignmentReview } from "../../../lib/assignments/store.ts";
import { assignedReading } from "../../../lib/assignments/reading.ts";
import { Reading } from "../../components/reading.tsx";
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
    };
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect("/login");
    if (error instanceof EvidenceError && error.status === 404) notFound();
    throw error;
  }
}
export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ assignment?: string; origin?: string }>;
}) {
  const params = await searchParams;
  const { assignments, selected } = await load(params.assignment);
  const origin = OriginFilterSchema.safeParse(params.origin).data ?? "all";
  const content = loadApprovedContent();
  return (
    <TeacherFrame
      section="Assignments"
      context={{ assignment: selected?.id, origin }}
    >
      <div className="lp-evidence-page">
        <h1 className="lp-title">Review an assignment</h1>
        <p className="lp-intro">
          Check the reading and practice, then make them available to your
          class.
        </p>
        {assignments.length > 1 && (
          <nav aria-label="Assignments" className="my-6 space-y-3">
            {assignments.map((item) => (
              <p key={item.id}>
                <Link
                  className="lp-text-link"
                  href={`/teacher/assignments?${new URLSearchParams({ assignment: item.id, origin })}`}
                >
                  {item.class_name} · {item.title}
                </Link>
              </p>
            ))}
          </nav>
        )}
        {selected ? (
          <>
            <section className="lp-panel p-6 my-6">
              <p className="lp-eyebrow">{selected.class_name}</p>
              <h2 className="text-xl font-semibold my-2">{selected.title}</h2>
              {selected.teacher_approved_at ? (
                <p role="status" className="my-4">
                  Active for students · Approved by your teacher account on{" "}
                  {date(selected.teacher_approved_at)}.
                </p>
              ) : (
                <>
                  <p className="my-4">
                    Waiting for your review. The team approved this material for
                    the hackathon; activating it records your separate classroom
                    review.
                  </p>
                  <ApproveAssignment
                    id={selected.id}
                    token={selected.review_token}
                  />
                </>
              )}
              <p className="text-sm text-slate-600 mt-4">
                Changes to an activated reading or its learning goals need a new
                assignment and review. Saved student work keeps its original
                version.
              </p>
            </section>
            <section className="lp-panel p-6 my-6">
              <h2 className="text-xl font-semibold mb-4">
                Five learning goals
              </h2>
              {[...content.concepts.values()].map((concept) => (
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
            <section className="lp-panel p-6 my-6">
              <h2 className="text-xl font-semibold mb-4">Prepared practice</h2>
              <p className="mb-4">
                Fifteen questions, with one complete guided sequence for
                transmission and propagation delay.
              </p>
              <details className="lp-evidence-details">
                <summary>Questions and answer guidance</summary>
                {[...content.questions.values()]
                  .filter((q) => q.question_id?.startsWith("NP-"))
                  .map((question) => (
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
                <summary>Guided transmission and propagation sequence</summary>
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
            <section className="lp-panel p-6 my-6">
              <h2 className="text-xl font-semibold mb-4">Assigned reading</h2>
              <Reading reading={assignedReading(selected.content_ref)} />
            </section>
          </>
        ) : (
          <p className="lp-panel p-6 my-6">
            No assignments are available for this teacher account.
          </p>
        )}
      </div>
    </TeacherFrame>
  );
}
