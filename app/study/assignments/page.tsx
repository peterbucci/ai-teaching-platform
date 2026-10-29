import { redirect } from "next/navigation";
import { AuthError, requireActor } from "../../../lib/auth.ts";
import { evidenceAccess } from "../../../lib/evidence/store.ts";
import { studentDashboard } from "../../../lib/tutoring/dashboard.ts";
import { MyLearning } from "../notebook/learning/index.ts";
import { NotebookRouteShell } from "../notebook/integration/route-shell.tsx";
import { AssignedInterventionList } from "./intervention-list.tsx";
import "./assignments.css";

export const dynamic = "force-dynamic";
async function loadAssignments() {
  try {
    return await studentDashboard(evidenceAccess(await requireActor()));
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect("/login");
    return null;
  }
}

export default async function StudentAssignmentsPage() {
  const dashboard = await loadAssignments();
  return (
    <NotebookRouteShell
      route={{ kind: "learning" }}
      section="learning"
      title="My learning"
      leafHeading
    >
      <MyLearning
        dashboard={dashboard}
        teacherReviews={dashboard ? <AssignedInterventionList /> : undefined}
      />
    </NotebookRouteShell>
  );
}
