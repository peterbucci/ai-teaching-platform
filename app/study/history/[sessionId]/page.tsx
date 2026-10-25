import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AuthError, requireActor } from "../../../../lib/auth.ts";
import {
  EvidenceError,
  evidenceAccess,
} from "../../../../lib/evidence/store.ts";
import { readStudentNotebook } from "../../../../lib/evidence/student-notebook.ts";
import { StudentNotebookSchema } from "../../../../lib/evidence/student-notebook-contracts.ts";
import {
  studentSessionAssignment,
  studentAssignmentWork,
} from "../../../../lib/tutoring/dashboard.ts";
import { NotebookRouteShell } from "../../notebook/integration/route-shell.tsx";
import {
  NotebookSavedWorkView,
  NotebookSavedQuestionPage,
} from "../../notebook/records/index.ts";
import { notebookSavedWork } from "../../notebook/adapters.ts";
import { notebookHref } from "../../notebook/route-state.ts";
import { validatedRecordedHistory } from "../../notebook/recorded-history.ts";
import { RecordedHistoryView } from "../../notebook/records/recorded-history-view.tsx";

export const dynamic = "force-dynamic";
export default async function SavedHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sessionId } = await params;
  const query = await searchParams;
  const id = StudentNotebookSchema.shape.session.shape.id;
  if (
    !id.safeParse(sessionId).success ||
    Object.keys(query).some((key) => key !== "attempt") ||
    (query.attempt !== undefined && !id.safeParse(query.attempt).success)
  )
    notFound();
  const attemptId =
    typeof query.attempt === "string" ? query.attempt : undefined;
  let actor;
  try {
    actor = await requireActor();
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect("/login");
    throw error;
  }
  const access = evidenceAccess(actor);
  // Opt-in remains off by default until N0 adapter and combined acceptance gates pass.
  if (process.env.NOTEBOOK_RECORDED_HISTORY !== "1") {
    let assignmentId;
    try {
      assignmentId = await studentSessionAssignment(access, sessionId);
    } catch (error) {
      if (error instanceof EvidenceError && [403, 404].includes(error.status))
        notFound();
      throw error;
    }
    const work = await studentAssignmentWork(access, assignmentId);
    const selected = {
      ...work,
      sessions: work.sessions.filter((session) => session.id === sessionId),
    };
    if (
      attemptId &&
      !selected.sessions.some((session) =>
        session.responses.some((answer) => answer.id === attemptId),
      )
    )
      notFound();
    return (
      <NotebookRouteShell
        route={{ kind: "history" }}
        section="records"
        title="Saved work"
      >
        <p>
          Recorded history is unavailable in this environment. Original saved
          work remains available.
        </p>
        {attemptId ? (
          <NotebookSavedQuestionPage
            work={{
              status: "ready",
              data: notebookSavedWork(assignmentId, selected),
            }}
            identity={{ kind: "study", assignmentId, sessionId, attemptId }}
          />
        ) : (
          <NotebookSavedWorkView
            work={{
              status: "ready",
              data: notebookSavedWork(assignmentId, selected),
            }}
          />
        )}
      </NotebookRouteShell>
    );
  }
  let initial = null;
  try {
    const authorized = await readStudentNotebook(
      access,
      sessionId,
      attemptId ? { attempt_id: attemptId } : {},
    );
    initial = validatedRecordedHistory(authorized, {
      assignmentId: authorized.session.assignment_id,
      sessionId,
      attemptId,
    });
  } catch (error) {
    if (error instanceof EvidenceError && [403, 404].includes(error.status))
      notFound();
  }
  if (!initial)
    return (
      <NotebookRouteShell
        route={{ kind: "history" }}
        section="records"
        title="Saved history unavailable"
      >
        <section role="alert">
          <h1>Recorded history is temporarily unavailable</h1>
          <p>
            Your saved work has not changed. Return to Notebook to open original
            saved work.
          </p>
          <Link href="/study/history" prefetch={false}>
            Back to Notebook
          </Link>
        </section>
      </NotebookRouteShell>
    );
  const scope = {
    assignmentId: initial.session.assignment_id,
    sessionId,
    attemptId,
  };
  const fallbackHref = notebookHref({
    kind: "assignment",
    assignmentId: scope.assignmentId,
    sessionId,
    tab: "work",
  });
  return (
    <NotebookRouteShell
      route={{ kind: "history" }}
      section="records"
      title="Recorded history"
      leafHeading
    >
      <RecordedHistoryView
        key={`${actor.profileId}/${sessionId}/${attemptId ?? "all"}`}
        scope={scope}
        initial={initial}
        fallbackHref={fallbackHref}
      />
    </NotebookRouteShell>
  );
}
