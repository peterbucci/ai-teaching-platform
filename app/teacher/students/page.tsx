import Link from "next/link";
import { Icon } from "../../components/icons.tsx";
import { loadApprovedContent } from "../../../lib/evidence/content.ts";
import {
  loadTeacherView,
  evidenceDescription,
  type TeacherFilters,
} from "../data.ts";
import { TeacherFiltersForm } from "../filters.tsx";
import { TeacherFrame, date, label, originLabel } from "../presentation.tsx";

export const dynamic = "force-dynamic";

export default async function TeacherStudentsPage({
  searchParams,
}: {
  searchParams: Promise<TeacherFilters & { q?: string }>;
}) {
  const params = await searchParams;
  const { assignments, origin, data } = await loadTeacherView(params);
  const query = (params.q ?? "").trim().slice(0, 100);
  const content = loadApprovedContent();
  return (
    <TeacherFrame section="Students">
      <header className="lp-page-heading">
        <p className="lp-eyebrow">Your classroom</p>
        <h1 className="lp-title">Students</h1>
        <p className="lp-intro">
          Meet the class through their work. Open a student to inspect their
          saved sessions.
        </p>
      </header>
      {data ? (
        <>
          <TeacherFiltersForm
            action="/teacher/students"
            assignments={assignments}
            assignment={data.assignment_id}
            origin={origin}
          />
          <div className="lp-teacher-context">
            <strong>{data.class_name}</strong>
            <span>{data.students.length} enrolled students</span>
            <span>{evidenceDescription(origin)}</span>
          </div>
          <section
            className="lp-panel lp-directory"
            aria-labelledby="directory-heading"
          >
            <div className="lp-teacher-section-heading">
              <div>
                <h2 id="directory-heading">Class directory</h2>
                <p>Evidence for {data.title}</p>
              </div>
              <form
                action="/teacher/students"
                className="lp-student-search"
                role="search"
              >
                <input
                  type="hidden"
                  name="assignment"
                  value={data.assignment_id}
                />
                <input type="hidden" name="origin" value={origin} />
                <label className="lp-field" htmlFor="student-search">
                  Find a student
                  <input
                    id="student-search"
                    className="lp-input"
                    type="search"
                    name="q"
                    defaultValue={query}
                    maxLength={100}
                    placeholder="Search by name"
                  />
                </label>
                <button className="lp-button">Search</button>
              </form>
            </div>
            <div className="lp-directory-list">
              {data.students
                .filter((student) =>
                  student.display_name
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((student) => {
                  const sessions = data.evidence
                    .filter(
                      (item) => item.session.student_id === student.student_id,
                    )
                    .sort((a, b) =>
                      b.session.started_at.localeCompare(a.session.started_at),
                    );
                  const responses = sessions.flatMap((item) =>
                    item.attempts.filter(
                      (attempt) => attempt.submitted_at !== null,
                    ),
                  );
                  const concepts = new Set(
                    responses.flatMap(
                      (attempt) => attempt.question.concept_ids,
                    ),
                  );
                  const latestResponse = responses
                    .map((attempt) => attempt.submitted_at!)
                    .sort()
                    .at(-1);
                  return (
                    <details
                      key={student.student_id}
                      className="lp-directory-student"
                    >
                      <summary>
                        <span className="lp-avatar" aria-hidden="true">
                          {student.display_name
                            .split(/\s+/)
                            .map((part) => part[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <span className="lp-directory-student-name">
                          <strong>{student.display_name}</strong>
                          <small>
                            {responses.length
                              ? `${responses.length} submitted responses · ${sessions.length} sessions`
                              : "No submitted answers in this view"}
                          </small>
                        </span>
                        <span className="lp-directory-last-active">
                          {latestResponse
                            ? date(latestResponse)
                            : "Awaiting activity"}
                        </span>
                        <span className="lp-expand-icon" aria-hidden="true">
                          +
                        </span>
                      </summary>
                      <div className="lp-directory-profile">
                        <p>
                          <strong>Concepts practiced:</strong>{" "}
                          {concepts.size
                            ? [...concepts]
                                .map(
                                  (id) => content.concepts.get(id)?.title ?? id,
                                )
                                .join(" · ")
                            : "No concepts with submitted responses in this view."}
                        </p>
                        <p className="lp-panel-description">
                          These records describe learning activity, not a
                          student’s ability or lasting understanding. Open the
                          evidence to see assistance, uncertainty, and source
                          references.
                        </p>
                        {sessions.length ? (
                          <ul>
                            {sessions.map(({ session, attempts }) => (
                              <li
                                key={session.id}
                                className="lp-directory-session"
                              >
                                <div>
                                  <span
                                    className={`lp-badge${session.data_origin === "synthetic_fixture" ? " lp-badge-neutral" : ""}`}
                                  >
                                    {originLabel(session.data_origin)}
                                  </span>
                                  <strong>
                                    {label(session.status)} ·{" "}
                                    {
                                      attempts.filter(
                                        (attempt) => attempt.submitted_at,
                                      ).length
                                    }{" "}
                                    responses
                                  </strong>
                                  <small>
                                    Started {date(session.started_at)}
                                  </small>
                                </div>
                                <Link
                                  href={`/teacher/sessions/${session.id}`}
                                  className="lp-text-link"
                                >
                                  Inspect session <Icon name="arrow" />
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="lp-empty-results">
                            No sessions match this evidence source. Missing
                            activity is not a learning judgment.
                          </p>
                        )}
                      </div>
                    </details>
                  );
                })}
            </div>
            {!data.students.some((student) =>
              student.display_name.toLowerCase().includes(query.toLowerCase()),
            ) && (
              <p className="lp-empty-results">
                No students match “{query}”.{" "}
                <Link
                  className="lp-text-link"
                  href={`/teacher/students?${new URLSearchParams({ assignment: data.assignment_id, origin })}`}
                >
                  Clear search
                </Link>
              </p>
            )}
          </section>
        </>
      ) : (
        <section className="lp-panel">
          <h2>No class roster available</h2>
          <p>This teacher account has no teaching assignments.</p>
        </section>
      )}
    </TeacherFrame>
  );
}
