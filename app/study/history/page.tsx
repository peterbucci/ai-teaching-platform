import { redirect } from "next/navigation";
import { AuthError, requireActor } from "../../../lib/auth.ts";
import { evidenceAccess } from "../../../lib/evidence/store.ts";
import { studentStudyHistory } from "../../../lib/tutoring/store.ts";
import { NotebookHistory } from "../notebook/integration/notebook-history.tsx";
import { NotebookRouteShell } from "../notebook/integration/route-shell.tsx";

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
    <NotebookRouteShell
      route={{ kind: "history" }}
      section="records"
      title="Notebook"
      leafHeading
    >
      <NotebookHistory
        nowISO={new Date().toISOString()}
        history={
          history === null
            ? {
                status: "unavailable",
                message:
                  "We couldn’t load your saved sessions. Your saved work has not changed.",
              }
            : { status: "ready", data: history }
        }
      />
    </NotebookRouteShell>
  );
}
