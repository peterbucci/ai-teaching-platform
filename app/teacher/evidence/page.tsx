import Link from "next/link";
import { Icon } from "../../components/icons.tsx";
import { loadApprovedContent } from "../../../lib/evidence/content.ts";
import { loadTeacherEvidence, type TeacherParams } from "../data.ts";
import { NoTeachingAssignments, TeacherFilters } from "../filters.tsx";
import { TeacherFrame, date, label, originLabel } from "../presentation.tsx";

export const dynamic = "force-dynamic";
export default async function EvidencePage({
  searchParams,
}: {
  searchParams: Promise<TeacherParams>;
}) {
  const params = await searchParams;
  const { assignments, origin, data } = await loadTeacherEvidence(params);
  if (!data)
    return (
      <TeacherFrame section="Student evidence">
        <NoTeachingAssignments />
      </TeacherFrame>
    );
  const content = loadApprovedContent();
  const context = { assignment: data.assignment_id, origin };
  const href = (concept?: string) =>
    `/teacher/evidence?${new URLSearchParams({ ...context, ...(concept ? { concept } : {}) })}`;
  const query = new URLSearchParams({
    ...context,
    ...(params.concept ? { concept: params.concept } : {}),
  });
  const students = data.students.map((student) => ({
    ...student,
    sessions: data.evidence
      .filter(
        (e) =>
          e.session.student_id === student.student_id &&
          (!params.concept ||
            e.attempts.some((a) =>
              a.question.concept_ids.includes(params.concept!),
            )),
      )
      .sort((a, b) => b.session.started_at.localeCompare(a.session.started_at)),
  }));
  const withSessions = students.filter(
    (student) => student.sessions.length > 0,
  );
  const withoutSessions = students.filter(
    (student) => student.sessions.length === 0,
  );
  function sessionLink({
    session,
    attempts,
  }: (typeof withSessions)[number]["sessions"][number]) {
    return (
      <li key={session.id} className="lp-session-row">
        <div>
          <span
            className={`lp-badge${session.data_origin === "synthetic_fixture" ? " lp-badge-neutral" : ""}`}
          >
            {originLabel(session.data_origin)}
          </span>
          <small>
            {label(session.status)} ·{" "}
            {attempts.filter((a) => a.submitted_at).length} responses ·{" "}
            {date(session.started_at)}
          </small>
        </div>
        <Link
          href={`/teacher/sessions/${session.id}?${query}`}
          className="lp-text-link"
        >
          Inspect session
          <Icon name="arrow" />
        </Link>
      </li>
    );
  }
  return (
    <TeacherFrame section="Student evidence" context={context}>
      <header className="lp-page-heading">
        <h1 className="lp-title">Student evidence</h1>
        <p className="lp-intro">
          Inspect students’ original answers, feedback, and practice history.
        </p>
      </header>
      <TeacherFilters
        action="/teacher/evidence"
        assignments={assignments}
        assignment={data.assignment_id}
        origin={origin}
        concept={params.concept}
      />
      <section id="responses" className="lp-panel lp-responses">
        <h2>Student sessions</h2>
        <p className="lp-panel-description mb-5">
          {params.concept
            ? `Showing ${content.concepts.get(params.concept)?.title ?? params.concept}. `
            : "Open a session to see the student's answers and feedback. "}
          {params.concept && (
            <Link href={href()} className="underline">
              Show all concepts
            </Link>
          )}
        </p>
        {withSessions.length === 0 && (
          <p className="lp-empty-results">No sessions in this view yet.</p>
        )}
        <ul>
          {withSessions.map((student) => (
            <li key={student.student_id} className="lp-student-row">
              <h3 className="lp-student-name">
                <span className="lp-avatar" aria-hidden="true">
                  {student.display_name
                    .split(/\s+/)
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <span>{student.display_name}</span>
              </h3>
              <div>
                <ul>{sessionLink(student.sessions[0])}</ul>
                {student.sessions.length > 1 && (
                  <details className="lp-previous-sessions">
                    <summary>
                      {student.sessions.length - 1} earlier sessions
                    </summary>
                    <ul>{student.sessions.slice(1).map(sessionLink)}</ul>
                  </details>
                )}
              </div>
            </li>
          ))}
        </ul>
        {withoutSessions.length > 0 && (
          <details className="lp-results-help">
            <summary>
              {withoutSessions.length} students without sessions in this view
            </summary>
            <ul className="lp-no-sessions">
              {withoutSessions.map((student) => (
                <li key={student.student_id}>{student.display_name}</li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </TeacherFrame>
  );
}
