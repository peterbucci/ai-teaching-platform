import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import type {
  DashboardLesson,
  StudentAssignmentWork,
} from "../../../../lib/tutoring/dashboard-model.ts";
import type { StudentReaderView } from "../../../../lib/reading/model.ts";
import { assignmentStudyHref } from "../../../../lib/tutoring/navigation.ts";
import { AssignmentAction } from "../../assignments/action.tsx";
import { LocalTime } from "../../../components/local-time.tsx";
import { sourceHeading } from "../../reading/presentation.ts";
import {
  learningStatus,
  learningStatusNote,
  savedWorkHref,
} from "./presentation.ts";
import {
  LearningNotice,
  LearningStatus,
  PracticeCoverage,
  WorkVisibility,
} from "./shared.tsx";
import styles from "./learning.module.css";

export type AssignmentOverviewProps = {
  lesson: DashboardLesson | null;
  loading?: boolean;
  /** Load through existing authorized services; the wrapper prevents stale cross-assignment display.
   * Undefined is not loaded here; null explicitly means unavailable. */
  savedWork?: { assignmentId: string; work: StudentAssignmentWork } | null;
  workLoading?: boolean;
  /** Optional exact reader projection. DashboardLesson itself does not expose a version. */
  reader?: Pick<StudentReaderView, "assignment" | "reading">;
  /** Optional N0 composition slots; supply the existing AssignmentAction. */
  assignmentAction?: ReactNode;
  readingAction?: ReactNode;
};

export function AssignmentOverview({
  lesson,
  loading = false,
  savedWork,
  workLoading = false,
  reader,
  assignmentAction,
  readingAction,
}: AssignmentOverviewProps) {
  if (!lesson || loading)
    return (
      <div className={styles.root}>
        <Link href="/study/assignments" prefetch={false}>
          ← My learning
        </Link>
        <LearningNotice
          loading={loading}
          title={
            loading ? "Loading assignment…" : "This assignment is unavailable"
          }
        >
          {loading
            ? "Loading the approved lesson and your current progress."
            : "Return to My learning to choose an available assignment. Your saved work has not changed."}
        </LearningNotice>
      </div>
    );
  const work = savedWork?.assignmentId === lesson.id ? savedWork.work : null;
  const validReader =
    reader?.assignment.id === lesson.id &&
    reader.assignment.classId === lesson.classId
      ? reader
      : null;
  const sourceMismatch = reader !== undefined && !validReader;
  const hasSavedWork = Boolean(
    work?.sessions.length ||
    lesson.session ||
    lesson.lastPracticedAt ||
    lesson.lastCompletedAt,
  );
  return (
    <div className={styles.root} data-assignment-id={lesson.id}>
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <Link href="/study/assignments" prefetch={false}>
          My learning
        </Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">{lesson.title}</span>
      </nav>
      <header className={styles.pageHead}>
        <p className={styles.kicker}>{lesson.className} · Assignment</p>
        <h1>{lesson.title}</h1>
        <div className={styles.titleRow}>
          <LearningStatus lesson={lesson} />
          <span className={styles.meta}>{lesson.approval_label}</span>
        </div>
      </header>
      <div className={styles.actionBar}>
        <div className={styles.stack}>
          <strong>{learningStatus(lesson)}</strong>
          <p className={styles.small}>{learningStatusNote(lesson)}</p>
        </div>
        <Fragment key={lesson.id}>
          {assignmentAction ?? (
            <AssignmentAction
              key={lesson.id}
              lesson={lesson}
              className="lp-button-primary"
            />
          )}
        </Fragment>
      </div>
      <div className={styles.columns}>
        <div className={styles.mainColumn}>
          <section aria-label="From your teacher">
            <div className={styles.sectionHead}>
              <h2>From your teacher</h2>
            </div>
            <p className={styles.instructions}>
              {lesson.instructions ||
                "No additional instructions from your teacher."}
            </p>
          </section>
          <section aria-label="How this assignment works">
            <div className={styles.sectionHead}>
              <h2>How this assignment works</h2>
            </div>
            <ol className={styles.steps}>
              <li>
                <span aria-hidden="true">1</span>
                <div>
                  <h3>Read first, if you like</h3>
                  <p className={styles.small}>
                    Open the approved reading before you start. Opening this
                    overview does not start a session.
                  </p>
                </div>
              </li>
              <li>
                <span aria-hidden="true">2</span>
                <div>
                  <h3>Explain your thinking</h3>
                  <p className={styles.small}>
                    Use the existing study conversation to answer questions in
                    your own words.
                  </p>
                </div>
              </li>
              <li>
                <span aria-hidden="true">3</span>
                <div>
                  <h3>Ask for help in the same box</h3>
                  <p className={styles.small}>
                    You can ask a question without submitting it as an assessed
                    answer. Review any clarification before confirming an
                    answer.
                  </p>
                </div>
              </li>
            </ol>
          </section>
          <section aria-label="Learning objectives">
            <div className={styles.sectionHead}>
              <h2>What you’ll learn</h2>
              <span className={styles.small}>Approved practice topics</span>
            </div>
            {lesson.topics.length ? (
              <ol className={styles.objectives}>
                {lesson.topics.map((topic, index) => (
                  <li key={topic.id} id={`topic-${topic.id}`} tabIndex={-1}>
                    <span className={styles.topicNumber} aria-hidden="true">
                      {index + 1}
                    </span>
                    <div className={styles.stack}>
                      <h3>{topic.title}</h3>
                      {topic.objectives.map((objective, number) => (
                        <p key={number}>{objective}</p>
                      ))}
                      <p className={styles.small}>
                        {topic.practiced
                          ? "Submitted practice recorded"
                          : "No submitted practice recorded"}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.instructions}>
                Practice topics are unavailable.
              </p>
            )}
            <p className={styles.footnote}>
              These are the configured practice topics, not every concept in the
              reading. Submitted practice does not establish correctness or
              mastery.
            </p>
          </section>
          <section aria-label="Reading for this assignment">
            <div className={styles.sectionHead}>
              <h2>Reading</h2>
            </div>
            {sourceMismatch ? (
              <LearningNotice title="The reading context does not match this assignment">
                Return to My learning and reopen this assignment’s reading.
              </LearningNotice>
            ) : (
              <div className={styles.reading}>
                <div className={styles.bookMark} aria-hidden="true">
                  ≡
                </div>
                <div className={styles.stack}>
                  <h3>{lesson.sourceTitle}</h3>
                  <p className={styles.small}>
                    {lesson.sourcePath.length
                      ? lesson.sourcePath.map(sourceHeading).join(" › ")
                      : lesson.sourceSection}
                  </p>
                  {validReader ? (
                    <p className={styles.small}>
                      Version {validReader.reading.content_ref.content_version}{" "}
                      · {validReader.reading.attribution.authors.join(", ")}
                    </p>
                  ) : (
                    <p className={styles.small}>
                      Opens the approved version assigned by your teacher.
                    </p>
                  )}
                </div>
                <Fragment key={lesson.id}>
                  {readingAction ?? (
                    <AssignmentAction
                      key={lesson.id}
                      lesson={lesson}
                      kind="reading"
                    />
                  )}
                </Fragment>
              </div>
            )}
          </section>
        </div>
        <aside className={styles.aside}>
          <section className={styles.sideCard} aria-label="Current progress">
            <h2>Current progress</h2>
            <PracticeCoverage lesson={lesson} />
            <p className={styles.small}>
              Based on saved responses across your sessions.
            </p>
          </section>
          <section className={styles.sideCard} aria-label="Your sessions">
            <h2>Your sessions</h2>
            {workLoading ? (
              <p role="status">Loading saved sessions…</p>
            ) : savedWork !== undefined && !work ? (
              <p role="alert">Saved work for this assignment is unavailable.</p>
            ) : work ? (
              work.sessions.length ? (
                <ul className={styles.sessions}>
                  {work.sessions.map((session) => (
                    <li key={session.id} data-session-id={session.id}>
                      <Link
                        href={assignmentStudyHref(lesson.id, session.id)}
                        prefetch={false}
                      >
                        <strong>{learningStatus({ session })}</strong>
                        <span className={styles.small}>
                          <LocalTime value={session.startedAt} includeTime /> ·{" "}
                          {session.responses.length} submitted{" "}
                          {session.responses.length === 1
                            ? "response"
                            : "responses"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.small}>
                  No saved sessions yet. Your first one begins when you choose
                  Start assignment.
                </p>
              )
            ) : (
              <p className={styles.small}>
                {hasSavedWork
                  ? "Open your saved work to revisit earlier responses and sessions."
                  : "No sessions yet. Your first one begins when you choose Start assignment."}
              </p>
            )}
            {hasSavedWork && (
              <Link href={savedWorkHref(lesson.id)} prefetch={false}>
                View saved work →
              </Link>
            )}
          </section>
          <WorkVisibility />
        </aside>
      </div>
    </div>
  );
}
