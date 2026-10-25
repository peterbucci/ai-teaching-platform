import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { AuthError, requireActor } from "../../../../lib/auth.ts";
import {
  EvidenceError,
  evidenceAccess,
} from "../../../../lib/evidence/store.ts";
import { readAssignmentContent } from "../../../../lib/lessons/store.ts";
import { freshCheckConceptNames } from "../../../../lib/interventions/student-concept-names.ts";
import { readStudentIntervention } from "../../../../lib/interventions/approval.ts";
import { Workspace } from "../../../components/workspace.tsx";
import { TeacherReviewFrame } from "../../notebook/reviews/presenters.tsx";
import { DeliveredActivity } from "./activity.tsx";
import "../../../components/intervention-activity.css";
import "../../notebook/reviews/reviews.css";

export const dynamic = "force-dynamic";
export default async function StudentInterventionPage({
  params,
}: {
  params: Promise<{ approvalId: string }>;
}) {
  const id = z.uuid().safeParse((await params).approvalId);
  if (!id.success) notFound();
  const loaded = await (async () => {
    try {
      const actor = await requireActor();
      const intervention = await readStudentIntervention(
        evidenceAccess(actor),
        id.data,
      );
      // The resolver authorizes enrollment and loads the assignment's pinned version.
      // Only public concept titles cross the client boundary, never private criteria.
      const content = await readAssignmentContent(
        evidenceAccess(actor),
        intervention.assignment_id,
        "student",
      );
      return {
        intervention,
        studentId: actor.profileId,
        conceptNames: freshCheckConceptNames(content, intervention),
      };
    } catch (error) {
      if (error instanceof AuthError && error.status === 401)
        redirect("/login");
      if (error instanceof EvidenceError && error.status === 404) notFound();
      return null;
    }
  })();
  return (
    <Workspace area="student" section="Assignments">
      <div className="lp-review-page">
        <Link href="/study/assignments" className="lp-button">
          Back to My learning
        </Link>
        {loaded ? (
          <TeacherReviewFrame intervention={loaded.intervention}>
            <DeliveredActivity
              key={`${loaded.studentId}:${loaded.intervention.approval_id}`}
              intervention={loaded.intervention}
              studentId={loaded.studentId}
              conceptNames={loaded.conceptNames}
            />
          </TeacherReviewFrame>
        ) : (
          <section className="lp-panel" role="alert">
            <h1>We couldn’t load this activity</h1>
            <p>
              Please try again in a moment. Your saved work has not changed.
            </p>
          </section>
        )}
      </div>
    </Workspace>
  );
}
