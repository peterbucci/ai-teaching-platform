import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { AuthError, requireActor } from "../../../../lib/auth.ts";
import {
  EvidenceError,
  evidenceAccess,
} from "../../../../lib/evidence/store.ts";
import { readStudentIntervention } from "../../../../lib/interventions/approval.ts";
import { Workspace } from "../../../components/workspace.tsx";
import { DeliveredActivity } from "./activity.tsx";
import "../../../components/intervention-activity.css";

export const dynamic = "force-dynamic";
export default async function StudentInterventionPage({
  params,
}: {
  params: Promise<{ approvalId: string }>;
}) {
  const id = z.uuid().safeParse((await params).approvalId);
  if (!id.success) notFound();
  const intervention = await (async () => {
    try {
      return await readStudentIntervention(
        evidenceAccess(await requireActor()),
        id.data,
      );
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
          Back to assignments
        </Link>
        {intervention ? (
          <section className="lp-panel">
            <p className="lp-review-meta">
              Assigned review · Available since{" "}
              {new Date(intervention.delivered_at).toLocaleDateString("en-US", {
                timeZone: "America/New_York",
              })}
            </p>
            <DeliveredActivity intervention={intervention} />
            <p className="lp-review-meta">
              Use this review to practice and discuss your reasoning with your
              teacher. Responses are not collected on this page yet.
            </p>
          </section>
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
