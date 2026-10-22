import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError, requireActor } from "../../../lib/auth.ts";
import { evidenceAccess } from "../../../lib/evidence/store.ts";
import { studentStudyHistory } from "../../../lib/tutoring/store.ts";
import { Icon } from "../../components/icons.tsx";
import { Workspace } from "../../components/workspace.tsx";
import { JournalList } from "./list.tsx";
import "./journal.css";

export const dynamic = "force-dynamic";

async function loadHistory() {
  try {
    return await studentStudyHistory(evidenceAccess(await requireActor()));
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect("/login");
    return null;
  }
}

export default async function StudyHistoryPage() {
  const history = await loadHistory();
  return (
    <Workspace area="student" section="Learning journal">
      <div className="lp-s-journal">
        <header className="journal-page-head">
          <h1>Learning journal</h1>
          <p>
            Find your past sessions and revisit your questions, responses, and
            feedback.
          </p>
        </header>
        {history === null ? (
          <section className="lp-panel journal-empty" role="alert">
            <h2>We couldn’t load your journal</h2>
            <p>Your saved work has not changed. Try again in a moment.</p>
            <Link className="lp-button" href="/study/history">
              Try again
            </Link>
          </section>
        ) : history.length === 0 ? (
          <section className="lp-panel journal-empty">
            <span className="lp-avatar">
              <Icon name="book" />
            </span>
            <h2>Your study history starts here</h2>
            <p>
              When you begin an approved assignment, your session will appear
              here. Your responses and feedback stay together so you can revisit
              your thinking.
            </p>
            <Link
              href="/study/assignments"
              className="lp-button lp-button-primary"
            >
              See your assignments <Icon name="arrow" />
            </Link>
          </section>
        ) : (
          <JournalList entries={history} nowISO={new Date().toISOString()} />
        )}
      </div>
    </Workspace>
  );
}
