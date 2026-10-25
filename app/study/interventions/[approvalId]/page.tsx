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
import { TeacherReviewFrame } from "../../notebook/reviews/presenters.tsx";
import { ReviewWorkspace } from "../../notebook/reviews/review-workspace.tsx";
import { reviewReturnContext } from "../../notebook/reviews/return-context.ts";
import { DeliveredActivity } from "./activity.tsx";
import "../../../components/intervention-activity.css";
import "../../notebook/reviews/reviews.css";

export const dynamic = "force-dynamic";
export default async function StudentInterventionPage({
  params,
  searchParams,
}: {
  params: Promise<{ approvalId: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const id = z.uuid().safeParse((await params).approvalId);
  if (!id.success) notFound();
  const requestedReturn = (await searchParams).returnTo;
  const returnContext = reviewReturnContext(
    typeof requestedReturn === "string" ? requestedReturn : undefined,
  );
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
    <ReviewWorkspace
      approvalId={id.data}
      title={loaded?.intervention.activity.title ?? "Review unavailable"}
      intervention={loaded?.intervention}
      returnContext={returnContext}
    >
      <div className="sn-review-page">
        {loaded ? (
          <TeacherReviewFrame intervention={loaded.intervention} embedded>
            <DeliveredActivity
              key={`${loaded.studentId}:${loaded.intervention.approval_id}`}
              intervention={loaded.intervention}
              studentId={loaded.studentId}
              conceptNames={loaded.conceptNames}
            />
          </TeacherReviewFrame>
        ) : (
          <section className="lp-panel" role="alert">
            <h2>We couldn’t load this activity</h2>
            <p>
              Please try again in a moment. Your saved work has not changed.
            </p>
          </section>
        )}
      </div>
    </ReviewWorkspace>
  );
}
