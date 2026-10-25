import Link from "next/link";
import { TeacherFrame, date } from "../presentation.tsx";
import { ApproveAssignment } from "./approve.tsx";
import { loadAssignments } from "./load.ts";
import { assignmentHref } from "./workspace-model.ts";
import {
  AssignmentLessonReview,
  StudentLearningPreview,
} from "./lesson-review.tsx";
import { AssignmentProgress } from "./progress.tsx";
import "./assignments.css";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const {
    context,
    classes,
    assignments,
    visible,
    selected,
    content,
    progress,
    followups,
  } = await loadAssignments(await searchParams);
  const selection = { ...context, assignment: selected?.id };
  const review = selected?.review;
  return (
    <TeacherFrame section="Assignments">
      <div className="awa-workspace">
        <header className="awa-heading">
          <div>
            <p className="lp-eyebrow">Teaching workbench</p>
            <h1 className="lp-title">Assignments & class progress</h1>
            <p className="lp-intro">
              Give a published lesson to a class, then follow the learning it
              produces.
            </p>
          </div>
          <Link
            className="lp-button lp-button-primary"
            href={`/teacher/assignments/new${context.class ? `?class=${context.class}` : ""}`}
          >
            New assignment
          </Link>
        </header>
        <ol className="awa-journey" aria-label="Learning workflow">
          <li>
            <span>01</span> Published lesson version
          </li>
          <li>
            <span>02</span> Classroom assignment
          </li>
          <li>
            <span>03</span> Learning sessions
          </li>
          <li>
            <span>04</span> Evidence & progress
          </li>
        </ol>
        <details className="awa-catalog" open={context.view === "review"}>
          <summary className="awa-catalog-toggle">
            Browse assignments · {assignments.length} assignments across{" "}
            {classes.length} classes
          </summary>
          <div className="awa-section-heading">
            <div>
              <h2 id="assignment-list-heading">Class assignments</h2>
              <p>
                {assignments.length} assignments across {classes.length} classes
              </p>
            </div>
            <form action="/teacher/assignments" className="awa-filters">
              <label className="lp-field">
                Class
                <select
                  className="lp-input"
                  name="class"
                  defaultValue={context.class ?? ""}
                >
                  <option value="">All classes</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="lp-field">
                Availability
                <select
                  className="lp-input"
                  name="status"
                  defaultValue={context.status}
                >
                  <option value="all">All assignments</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </label>
              <button className="lp-button">Apply filters</button>
            </form>
          </div>
          <div className="awa-assignment-list">
            {visible.map((item) => (
              <Link
                key={item.id}
                className={`awa-assignment-row${selected?.id === item.id ? " is-selected" : ""}`}
                aria-current={selected?.id === item.id ? "true" : undefined}
                href={assignmentHref(context, {
                  assignment: item.id,
                  view: "review",
                })}
              >
                <span>
                  <small>{item.class_name}</small>
                  <strong>{item.title}</strong>
                  <span className="awa-version-path">
                    {item.lesson_title} <span aria-hidden="true">→</span>{" "}
                    Version {item.lesson_version}
                  </span>
                </span>
                <span className={`awa-status awa-status-${item.status}`}>
                  {item.status === "active"
                    ? "Active"
                    : item.status === "inactive"
                      ? "Inactive · review to activate"
                      : "Unavailable"}
                </span>
              </Link>
            ))}
            {!visible.length && (
              <div className="awa-empty">
                <h3>
                  {assignments.length
                    ? "No assignments match these filters"
                    : "No class assignments yet"}
                </h3>
                <p>
                  {assignments.length
                    ? "Choose another class or availability state."
                    : "Start with an approved, published lesson. Save its class assignment, then review and activate it."}
                </p>
                <Link href="/teacher/assignments/new">
                  Choose a published lesson →
                </Link>
              </div>
            )}
          </div>
        </details>
        {selected && (
          <section
            className="awa-selected"
            aria-labelledby="selected-assignment-heading"
          >
            <header className="awa-detail-heading">
              <div>
                <p className="lp-eyebrow">{selected.class_name}</p>
                <h2 id="selected-assignment-heading">{selected.title}</h2>
                <p>
                  {selected.lesson_title} · Published version{" "}
                  <span className="awa-version">{selected.lesson_version}</span>
                </p>
              </div>
              <span className={`awa-status awa-status-${selected.status}`}>
                {selected.status}
              </span>
            </header>
            {!visible.some((item) => item.id === selected.id) && (
              <p className="awa-notice">
                This linked assignment is outside the current list filters. Its
                class and version are shown above.
              </p>
            )}
            {review && content ? (
              <>
                <nav className="awa-tabs" aria-label="Assignment workspace">
                  {(
                    [
                      ["review", "Lesson & activation"],
                      ["progress", "Class progress"],
                      ["preview", "Student preview"],
                    ] as const
                  ).map(([view, label]) => (
                    <Link
                      key={view}
                      aria-current={context.view === view ? "page" : undefined}
                      href={assignmentHref(selection, { view })}
                    >
                      {label}
                    </Link>
                  ))}
                </nav>
                {context.view === "review" && (
                  <div className="awa-review-layout">
                    <div>
                      <section
                        className="lp-panel"
                        id="assignment-instructions"
                      >
                        <h2>Instructions for students</h2>
                        <p className="awa-original">
                          {review.instructions || "No additional instructions."}
                        </p>
                        <p className="awa-note">
                          This assignment uses one immutable lesson version.
                          Future lesson edits leave it and its saved student
                          work unchanged.
                        </p>
                      </section>
                      <AssignmentLessonReview
                        content={content}
                        contentRef={review.content_ref}
                      />
                    </div>
                    <aside
                      className="lp-panel awa-activation"
                      aria-label="Classroom activation"
                    >
                      <p className="lp-eyebrow">Classroom availability</p>
                      <h2>
                        {review.teacher_approved_at
                          ? "Active for enrolled students"
                          : "Saved, not yet active"}
                      </h2>
                      {review.teacher_approved_at ? (
                        <>
                          <p>
                            Activated on {date(review.teacher_approved_at)}.
                          </p>
                          <Link
                            className="lp-button lp-button-primary"
                            href={assignmentHref(selection, {
                              view: "progress",
                            })}
                          >
                            Open class progress
                          </Link>
                        </>
                      ) : (
                        <>
                          <p>
                            Publication prepared this lesson. Your separate
                            classroom review makes it available to enrolled
                            students in {review.class_name}.
                          </p>
                          <ApproveAssignment
                            key={`${review.id}:${review.review_token}`}
                            id={review.id}
                            token={review.review_token}
                          />
                        </>
                      )}
                      <Link
                        className="lp-button"
                        href={assignmentHref(selection, { view: "preview" })}
                      >
                        Preview student learning
                      </Link>
                      <p className="awa-note">
                        Availability schedules, due dates, and deactivation are
                        not supported yet.
                      </p>
                    </aside>
                  </div>
                )}
                {context.view === "preview" && (
                  <StudentLearningPreview
                    content={content}
                    contentRef={review.content_ref}
                    title={review.title}
                    instructions={review.instructions}
                    active={!!review.teacher_approved_at}
                    assignmentId={review.id}
                  />
                )}
                {context.view === "progress" && progress && (
                  <>
                    <AssignmentProgress
                      data={progress}
                      content={content}
                      origin={context.origin}
                      selectedStudent={context.student}
                      selectedConcept={context.concept}
                      listContext={{
                        class: context.class,
                        status: context.status,
                      }}
                    />
                    <section className="lp-panel awa-followups">
                      <h2>Teacher-assigned follow-ups</h2>
                      <p>
                        Recent intervention records for this assignment, across
                        evidence origins. Approval and delivery are separate.
                      </p>
                      {followups.length ? (
                        <ul>
                          {followups.map((item) => (
                            <li key={item.draft.id}>
                              <Link
                                href={`/teacher/interventions?${new URLSearchParams({ assignment: selected.id, origin: context.origin, draft: item.draft.id })}`}
                              >
                                {item.draft.activity.title}
                              </Link>
                              <span>
                                {item.delivery
                                  ? `Delivered to ${item.delivery.recipient_ids.length} students`
                                  : item.approval
                                    ? "Approved · not delivered"
                                    : item.draft.status === "dismissed"
                                      ? "Dismissed"
                                      : "Private draft · not assigned"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No saved follow-up records yet.</p>
                      )}
                      <Link
                        href={`/teacher/interventions?assignment=${selected.id}&origin=${context.origin}`}
                      >
                        Review interventions and later work →
                      </Link>
                    </section>
                  </>
                )}
              </>
            ) : (
              <div className="awa-empty" role="status">
                <h3>The pinned lesson is unavailable</h3>
                <p>
                  This assignment cannot be activated or previewed until its
                  exact approved version is restored. Its saved records have not
                  been changed. Other assignments remain available above.
                </p>
                <Link href={assignmentHref(selection)}>
                  Check availability again
                </Link>
              </div>
            )}
          </section>
        )}
      </div>
    </TeacherFrame>
  );
}
