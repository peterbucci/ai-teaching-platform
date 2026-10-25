import Link from "next/link";
import { TeacherFrame, date } from "../presentation.tsx";
import { ApproveAssignment } from "./approve.tsx";
import { loadAssignments } from "./load.ts";
import {
  assignmentHref,
  assignmentListHref,
  assignmentTree,
} from "./workspace-model.ts";
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
    catalog,
    selected,
    content,
    progress,
    followups,
  } = await loadAssignments(await searchParams);
  const selection = { ...context, assignment: selected?.id };
  const review = selected?.review;
  const lessons = assignmentTree(visible, catalog, {
    includeUnassigned: !context.class && context.status === "all",
  });
  const stateLabel = (status: string) =>
    status === "active"
      ? "Active"
      : status === "inactive"
        ? "Not active yet"
        : "Unavailable";
  const heading = selected && (
    <header className="awa-page-heading">
      <p className="awa-eyebrow">
        {selected.class_name} · {selected.title}
      </p>
      <h1>
        {context.view === "progress"
          ? "Class progress"
          : context.view === "preview"
            ? "What students see"
            : "Review assignment"}
      </h1>
      {context.view === "progress" && (
        <p className="awa-intro">
          How this class is doing on each idea in the lesson, one row per
          student. Select a cell to read that student’s answers.
        </p>
      )}
      <p className="awa-chain">
        From the lesson <strong>{selected.lesson_title}</strong>, published
        version {selected.lesson_version} · {selected.enrolled}{" "}
        {selected.enrolled === 1 ? "student" : "students"} ·{" "}
        <span className={"awa-status awa-status-" + selected.status}>
          {stateLabel(selected.status)}
        </span>
      </p>
      {review && (
        <p className="awa-instructions">
          <strong>Instructions students see.</strong>{" "}
          <span className="awa-original">
            {review.instructions || "No additional instructions."}
          </span>
        </p>
      )}
      {review && !review.teacher_approved_at && context.view !== "review" && (
        <div className="awa-notice">
          <strong>
            Saved, not active. Students in this class can’t see it yet.
          </strong>
          <Link
            className="lp-button lp-button-primary"
            href={assignmentHref(selection, { view: "review" })}
          >
            Review and activate
          </Link>
        </div>
      )}
    </header>
  );

  return (
    <TeacherFrame section="Assignments">
      <div
        className={
          "awa-workspace " +
          (selected ? "awa-assignment-workspace" : "awa-discovery")
        }
      >
        {!selected ? (
          <>
            <header className="awa-page-heading awa-discovery-heading">
              <div>
                <p className="awa-eyebrow">All authorized classes</p>
                <h1>Assignments</h1>
                <p className="awa-intro">
                  Each assignment gives one class one published version of a
                  lesson. A published version never changes; later lesson edits
                  leave existing assignments and their student work unchanged.
                </p>
              </div>
              <Link
                className="lp-button"
                href={
                  "/teacher/assignments/new" +
                  (context.class ? "?class=" + context.class : "")
                }
              >
                New assignment
              </Link>
            </header>
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
              <p className="awa-note">
                {visible.length} assignments · {classes.length} authorized
                classes
              </p>
            </form>
            <div
              className="awa-assignment-tree"
              aria-label="Lessons, published versions and class assignments"
            >
              {lessons.map((lesson) => (
                <section className="awa-tree-lesson" key={lesson.id}>
                  <header className="awa-tree-heading">
                    <div>
                      <h2>{lesson.title}</h2>
                      <p className="awa-note">
                        {lesson.owned
                          ? "Teacher-provided lesson"
                          : "Approved lesson package"}
                      </p>
                    </div>
                    <div className="awa-inline-actions">
                      {lesson.draftRevision !== undefined && (
                        <span className="awa-status">
                          Draft · revision {lesson.draftRevision}
                        </span>
                      )}
                      <Link
                        className="lp-button"
                        href={
                          lesson.owned
                            ? "/teacher/lessons/" +
                              encodeURIComponent(lesson.id)
                            : "/teacher/lessons"
                        }
                      >
                        Open lesson
                      </Link>
                    </div>
                  </header>
                  {!lesson.versions.length && (
                    <p className="awa-tree-empty">
                      Not published yet, so it can’t be assigned.
                    </p>
                  )}
                  {lesson.versions.map((version) => (
                    <section
                      className="awa-tree-version"
                      key={version.version}
                      aria-label={lesson.title + ", version " + version.version}
                    >
                      <h3>Version {version.version}</h3>
                      <div className="awa-tree-classes">
                        {!version.assignments.length && (
                          <p className="awa-note">No class has this version.</p>
                        )}
                        {version.assignments.map((item) => {
                          const href = assignmentHref(context, {
                            assignment: item.id,
                            view:
                              item.status === "active" ? "progress" : "review",
                          });
                          return (
                            <div className="awa-tree-assignment" key={item.id}>
                              <div>
                                <Link className="awa-text-link" href={href}>
                                  {item.class_name}
                                </Link>
                                <span className="awa-assignment-title">
                                  {item.title}
                                </span>
                              </div>
                              <span className="awa-note">
                                {item.enrolled}{" "}
                                {item.enrolled === 1 ? "student" : "students"}
                              </span>
                              <span className="awa-note awa-tree-availability">
                                {item.status === "active" &&
                                item.teacher_approved_at
                                  ? "Activated " +
                                    date(item.teacher_approved_at).slice(0, 10)
                                  : item.status === "inactive"
                                    ? "Students can’t see it yet"
                                    : "Exact approved version unavailable"}
                              </span>
                              <span
                                className={
                                  "awa-status awa-status-" + item.status
                                }
                              >
                                {stateLabel(item.status)}
                              </span>
                              <Link
                                className="lp-button"
                                aria-label={
                                  "Open " +
                                  item.class_name +
                                  " · " +
                                  item.title +
                                  ", version " +
                                  item.lesson_version
                                }
                                href={href}
                              >
                                Open
                              </Link>
                            </div>
                          );
                        })}
                        {lesson.owned && (
                          <Link
                            className="awa-assign-version"
                            href={
                              "/teacher/assignments/new?" +
                              new URLSearchParams({
                                lesson: lesson.id,
                                version: version.version,
                                ...(context.class
                                  ? { class: context.class }
                                  : {}),
                              })
                            }
                          >
                            Assign this version
                          </Link>
                        )}
                      </div>
                    </section>
                  ))}
                </section>
              ))}
            </div>
            {!visible.length && (
              <div className="awa-empty">
                <h2>
                  {assignments.length
                    ? "No assignments match these filters"
                    : "No class assignments yet"}
                </h2>
                <p>
                  {assignments.length
                    ? "Choose another class or availability state."
                    : "Choose a published lesson version, save its assignment, then review and activate it."}
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <nav
              className="awa-context-actions"
              aria-label="Assignment actions"
            >
              <Link href={assignmentListHref(context)}>← All assignments</Link>
              {context.view === "review" ? (
                <Link href={assignmentHref(selection, { view: "progress" })}>
                  Class progress
                </Link>
              ) : (
                <Link
                  href={assignmentHref(selection, { view: "review" })}
                  aria-label="Review lesson and activation"
                >
                  Review
                </Link>
              )}
            </nav>
            {!visible.some((item) => item.id === selected.id) && (
              <p className="awa-notice">
                This linked assignment is outside the current list filters. Its
                class and version are shown below.
              </p>
            )}
            {review && content ? (
              <>
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
                      progressView={context.progressView}
                      pane={context.pane}
                      heading={heading}
                      previewHref={assignmentHref(selection, {
                        view: "preview",
                      })}
                      followups={followups.flatMap((item) =>
                        item.delivery
                          ? [
                              {
                                id: item.draft.id,
                                title: item.draft.activity.title,
                                recipientIds: item.delivery.recipient_ids,
                              },
                            ]
                          : [],
                      )}
                    />
                    <details className="awa-followups">
                      <summary>Teacher-assigned follow-ups</summary>
                      <p className="awa-note">
                        Recent intervention records for this assignment, across
                        evidence origins. Approval and delivery are separate.
                      </p>
                      {followups.length ? (
                        <ul>
                          {followups.map((item) => (
                            <li key={item.draft.id}>
                              <Link
                                href={
                                  "/teacher/interventions?" +
                                  new URLSearchParams({
                                    assignment: selected.id,
                                    origin: context.origin,
                                    draft: item.draft.id,
                                  })
                                }
                              >
                                {item.draft.activity.title}
                              </Link>
                              <span>
                                {item.delivery
                                  ? "Delivered to " +
                                    item.delivery.recipient_ids.length +
                                    " students"
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
                        href={
                          "/teacher/interventions?assignment=" +
                          selected.id +
                          "&origin=" +
                          context.origin
                        }
                      >
                        Review interventions and later work →
                      </Link>
                    </details>
                  </>
                )}
                {context.view === "review" && (
                  <>
                    {heading}
                    <div className="awa-review-layout">
                      <div>
                        <section
                          id="assignment-instructions"
                          className="awa-review-note"
                        >
                          <p>
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
                        className="awa-activation"
                        aria-label="Classroom activation"
                      >
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
                              key={review.id + ":" + review.review_token}
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
                          Availability schedules, due dates, and deactivation
                          are not supported yet.
                        </p>
                      </aside>
                    </div>
                  </>
                )}
                {context.view === "preview" && (
                  <>
                    {heading}
                    <nav className="awa-tabs" aria-label="Progress view">
                      {(
                        [
                          ["grid", "Class grid"],
                          ["concepts", "By idea"],
                          ["questions", "Questions used"],
                          ["sessions", "Study sessions"],
                        ] as const
                      ).map(([progressView, label]) => (
                        <Link
                          key={progressView}
                          href={assignmentHref(selection, {
                            view: "progress",
                            progressView,
                            pane: "grid",
                          })}
                        >
                          {label}
                        </Link>
                      ))}
                      <Link
                        aria-current="page"
                        href={assignmentHref(selection, { view: "preview" })}
                      >
                        What students see
                      </Link>
                    </nav>
                    <StudentLearningPreview
                      content={content}
                      contentRef={review.content_ref}
                      title={review.title}
                      className={review.class_name}
                      instructions={review.instructions}
                      active={!!review.teacher_approved_at}
                      assignmentId={review.id}
                    />
                  </>
                )}
              </>
            ) : (
              <>
                {heading}
                <div className="awa-empty" role="status">
                  <h2>The pinned lesson is unavailable</h2>
                  <p>
                    This assignment cannot be activated or previewed until its
                    exact approved version is restored. Its saved records have
                    not been changed.
                  </p>
                  <Link href={assignmentHref(selection)}>
                    Check availability again
                  </Link>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </TeacherFrame>
  );
}
