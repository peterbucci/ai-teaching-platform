import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError, requireActor } from "../../../lib/auth.ts";
import { evidenceAccess } from "../../../lib/evidence/store.ts";
import { studentDashboard } from "../../../lib/tutoring/dashboard.ts";
import { assignmentStudyHref } from "../../../lib/tutoring/navigation.ts";
import { Icon } from "../../components/icons.tsx";
import { Workspace } from "../../components/workspace.tsx";
import { AssignmentList } from "./list.tsx";
import { AssignedInterventionList } from "./intervention-list.tsx";
import { continuingAssignment, practiceStatus } from "./presentation.ts";
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
  const continuing = dashboard ? continuingAssignment(dashboard.lessons) : null;
  return (
    <Workspace area="student" section="Assignments">
      <div className="lp-s-assignments assignments-refined">
        <header className="assignments-title-row">
          <h1 className="heading">Assignments</h1>
          <p className="subheading">
            Everything you’re working on, all in one place.
          </p>
        </header>
        {dashboard && <AssignedInterventionList />}
        {continuing?.session && (
          <section
            className="assignment-resume"
            aria-labelledby="assignment-resume-heading"
          >
            <span className="assignment-resume-icon" aria-hidden="true">
              <Icon name="resume" />
            </span>
            <div className="assignment-resume-copy">
              <h2 id="assignment-resume-heading">
                Continue where you left off
              </h2>
              <h3>{continuing.title}</h3>
              <p>
                {continuing.className} · {practiceStatus(continuing)}
              </p>
            </div>
            <Link
              href={assignmentStudyHref(continuing.id, continuing.session.id)}
              prefetch={false}
              className="lp-button lp-button-primary"
              aria-label={`${continuing.session.status === "active" ? "Resume session" : "View saved session"}: ${continuing.title}`}
            >
              {continuing.session.status === "active"
                ? "Resume session"
                : "View saved session"}
              <Icon name="arrow" />
            </Link>
          </section>
        )}
        {dashboard === null ? (
          <section className="lp-panel assignment-empty" role="alert">
            <h2>We couldn’t load your assignments</h2>
            <p>
              Your saved work has not changed. Please try again in a moment.
            </p>
            <Link href="/study/assignments" className="lp-button">
              Try again
            </Link>
          </section>
        ) : dashboard.lessons.length === 0 ? (
          <section className="lp-panel assignment-empty">
            <Icon name="assignment" />
            <h2>Your next assignment starts here</h2>
            <p>
              There are no approved assignments for this account yet. Assigned
              work will appear here when your teacher activates it.
            </p>
          </section>
        ) : (
          <AssignmentList dashboard={dashboard} />
        )}
      </div>
    </Workspace>
  );
}
