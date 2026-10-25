import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { AuthError, requireActor } from "../../../lib/auth.ts";
import { evidenceAccess, EvidenceError } from "../../../lib/evidence/store.ts";
import { studentReader } from "../../../lib/reading/student-reader.ts";
import { Workspace } from "../../components/workspace.tsx";
import { Icon } from "../../components/icons.tsx";
import "./reader.css";
import { StandaloneNotebookReading } from "../notebook/integration/standalone-reading.tsx";

export const dynamic = "force-dynamic";

type ReadingQuery = {
  assignment?: string;
  version?: string;
  passage?: string;
  session?: string;
  citation?: string;
  from?: string;
};

async function loadReading(query: ReadingQuery) {
  try {
    const actor = await requireActor();
    return {
      studentId: actor.profileId,
      view: await studentReader(evidenceAccess(actor), {
        assignmentId: query.assignment,
        contentVersion: query.version,
        passageId: query.passage,
        sessionId: query.session,
      }),
      error: false,
    };
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect("/login");
    if (error instanceof EvidenceError && [403, 404].includes(error.status))
      notFound();
    return { studentId: null, view: null, error: true };
  }
}

export default async function ReadingPage({
  searchParams,
}: {
  searchParams: Promise<ReadingQuery>;
}) {
  const query = await searchParams;
  if (
    query.citation !== undefined &&
    (!z.uuid().safeParse(query.citation).success ||
      !query.session ||
      !query.passage)
  )
    notFound();
  const { view, error, studentId } = await loadReading(query);
  if (view && studentId)
    return (
      <StandaloneNotebookReading
        key={JSON.stringify([
          studentId,
          view.assignment.id,
          view.session?.id ?? null,
          view.reading.content_ref,
          query.citation ?? null,
          query.citation ? (query.passage ?? null) : null,
        ])}
        view={view}
        returnToSession={
          !!view.session && (!!query.citation || query.from === "study")
        }
        citation={
          query.citation && query.passage
            ? { id: query.citation, passageId: query.passage }
            : undefined
        }
      />
    );
  return (
    <Workspace area="student" section="Reading">
      <div className="lp-s-reader-refined">
        <header className="read-hero">
          <h1>Reading</h1>
        </header>
        <section className="reader-empty" role={error ? "alert" : undefined}>
          <h2>
            {error
              ? "We couldn’t load your reading"
              : "Your reading will appear here"}
          </h2>
          <p>
            {error
              ? "Your saved work has not changed. Please try again in a moment."
              : "Once your teacher approves an assignment for your class, you can explore its reading here—even before you start a study session."}
          </p>
          <Link
            href={error ? "/study/reading" : "/study/assignments"}
            className="reader-button"
          >
            <Icon name="back" />
            {error ? "Try again" : "Assignments"}
          </Link>
        </section>
      </div>
    </Workspace>
  );
}
