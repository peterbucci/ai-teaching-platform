import { requireActor } from "../../../lib/auth.ts";
import { evidenceAccess } from "../../../lib/evidence/store.ts";
import { listStudentInterventions } from "../../../lib/interventions/approval.ts";
import { TeacherReviewList } from "../notebook/reviews/presenters.tsx";
import "../notebook/reviews/reviews.css";

export async function AssignedInterventionList() {
  const interventions = await (async () => {
    try {
      return await listStudentInterventions(
        evidenceAccess(await requireActor()),
      );
    } catch {
      return null;
    }
  })();
  return (
    <TeacherReviewList
      status={interventions === null ? "unavailable" : "ready"}
      interventions={(interventions ?? []).map((item) => ({
        approval_id: item.approval_id,
        assignment_id: item.assignment_id,
        delivered_at: item.delivered_at,
        displayed_at: item.displayed_at,
        activity: {
          title: item.activity.title,
          learning_objective: item.activity.learning_objective,
        },
      }))}
    />
  );
}
