import Link from "next/link";
import { requireActor } from "../../../lib/auth.ts";
import { evidenceAccess } from "../../../lib/evidence/store.ts";
import { listStudentInterventions } from "../../../lib/interventions/approval.ts";
import "../../components/intervention-activity.css";

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
  if (interventions === null)
    return (
      <section className="lp-notice lp-notice-warning" role="status">
        Teacher-assigned reviews are temporarily unavailable. Refresh to try
        again.
      </section>
    );
  if (!interventions.length) return null;
  return (
    <section
      className="lp-assigned-reviews"
      aria-labelledby="assigned-review-title"
    >
      <h2 id="assigned-review-title">Reviews from your teacher</h2>
      <p>A focused activity to revisit and practice an idea.</p>
      <div className="lp-review-cards">
        {interventions.map((item) => (
          <article key={item.approval_id} className="lp-panel lp-review-card">
            <p className="lp-eyebrow">Assigned review</p>
            <h3>{item.activity.title}</h3>
            <p>{item.activity.learning_objective}</p>
            <Link
              className="lp-button lp-button-primary"
              href={"/study/interventions/" + item.approval_id}
              prefetch={false}
            >
              Open review
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
