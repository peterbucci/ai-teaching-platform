"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import type {
  DashboardLesson,
  StudentDashboard,
} from "../../../../lib/tutoring/dashboard-model.ts";
import { AssignmentAction } from "../../assignments/action.tsx";
import { assignmentScopeOptions } from "../../assignments/presentation.ts";
import { LocalTime } from "../../../components/local-time.tsx";
import {
  allLearning,
  learningView,
  overviewHref,
  type LearningSelection,
} from "./presentation.ts";
import {
  LearningNotice,
  LearningStatus,
  PracticeCoverage,
  WorkVisibility,
} from "./shared.tsx";
import styles from "./learning.module.css";

export type MyLearningProps = {
  /** Null means unavailable/loading, never an empty successful dashboard. */
  dashboard: StudentDashboard | null;
  loading?: boolean;
  /** N5 owns loading, delivered-review cards and their lifecycle. No list is fetched here. */
  teacherReviews?: ReactNode;
  /** N0 may inject the existing action from its integrating client wrapper. */
  renderAssignmentAction?: (lesson: DashboardLesson) => ReactNode;
};

export function MyLearning({
  dashboard,
  loading = false,
  teacherReviews,
  renderAssignmentAction,
}: MyLearningProps) {
  const [selection, setSelection] = useState<LearningSelection>(allLearning);
  const id = useId();
  if (!dashboard || loading)
    return (
      <div className={styles.root}>
        <header className={styles.pageHead}>
          <h1>My learning</h1>
        </header>
        <LearningNotice
          title={
            loading
              ? "Loading your learning…"
              : "We couldn’t load your assignments"
          }
          loading={loading}
        >
          {loading
            ? "Your assignments and saved sessions will appear here."
            : "Your saved work has not changed. Try opening My learning again."}
        </LearningNotice>
        <Link href="/study/history" prefetch={false}>
          Open your notebook
        </Link>
      </div>
    );

  const view = learningView(dashboard, selection);
  const options = assignmentScopeOptions(dashboard.lessons, {
    classId: selection.classId,
    sourceKey: selection.sourceKey,
    locationKey: "",
  });
  const current = view.continuing;
  const action =
    renderAssignmentAction ??
    ((lesson: DashboardLesson) => (
      <AssignmentAction key={lesson.id} lesson={lesson} />
    ));
  return (
    <div className={styles.root}>
      <header className={styles.pageHead}>
        <p className={styles.kicker}>{dashboard.displayName}</p>
        <h1>My learning</h1>
        <p className={styles.meta}>
          Your assignments, reviews from your teachers, and where you left off.
        </p>
      </header>
      <div className={styles.columns}>
        <div className={styles.mainColumn}>
          {teacherReviews != null && (
            <div
              className={styles.reviewSlot}
              data-notebook-slot="teacher-reviews"
            >
              {teacherReviews}
            </div>
          )}
          {current && (
            <section
              className={styles.continueCard}
              aria-labelledby={`${id}-continue`}
              data-assignment-id={current.id}
              data-session-id={current.session?.id}
            >
              <div className={styles.pageMark} aria-hidden="true">
                ↳
              </div>
              <div className={styles.stack}>
                <h2 className={styles.kicker} id={`${id}-continue`}>
                  Pick up where you left off
                </h2>
                <h3>{current.title}</h3>
                <p className={styles.small}>
                  {current.className} · {current.sourceTitle}
                </p>
                <LearningStatus lesson={current} />
                <div className={styles.actions} key={current.id}>
                  {action(current)}
                  <Link href={overviewHref(current.id)} prefetch={false}>
                    Assignment overview
                  </Link>
                </div>
              </div>
            </section>
          )}
          {!dashboard.lessons.length ? (
            <section className={styles.empty}>
              <h2>Nothing assigned yet</h2>
              <p>
                When your teacher activates an assignment, it appears here with
                its reading and a Start button.
              </p>
              <p className={styles.small}>
                If you expected work, ask your teacher whether it has been
                activated.
              </p>
            </section>
          ) : (
            <section aria-labelledby={`${id}-assignments`}>
              <div className={styles.sectionHead}>
                <h2 id={`${id}-assignments`}>Assignments</h2>
                <span className={styles.small}>
                  {dashboard.lessons.length} available
                </span>
              </div>
              <div className={styles.controls}>
                <div
                  className={styles.filters}
                  role="group"
                  aria-label="Show assignments"
                >
                  {[...new Set([...view.filters, selection.filter])].map(
                    (filter) => (
                      <button
                        type="button"
                        key={filter}
                        aria-pressed={selection.filter === filter}
                        onClick={() => setSelection({ ...selection, filter })}
                      >
                        {filter}
                      </button>
                    ),
                  )}
                </div>
                <div className={styles.fields}>
                  {options.classes.length > 1 && (
                    <label>
                      Class
                      <select
                        value={selection.classId}
                        onChange={(event) =>
                          setSelection({
                            ...selection,
                            classId: event.target.value,
                            sourceKey: "",
                          })
                        }
                      >
                        <option value="">All classes</option>
                        {options.classes.map((option) => (
                          <option value={option.value} key={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {(options.sources.length > 1 || selection.sourceKey) && (
                    <label>
                      Source
                      <select
                        value={selection.sourceKey}
                        onChange={(event) =>
                          setSelection({
                            ...selection,
                            sourceKey: event.target.value,
                          })
                        }
                      >
                        <option value="">All sources</option>
                        {options.sources.map((option) => (
                          <option value={option.value} key={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className={styles.search}>
                    Find an assignment
                    <input
                      type="search"
                      value={selection.search}
                      placeholder="Title, reading or topic"
                      onChange={(event) =>
                        setSelection({
                          ...selection,
                          search: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
              </div>
              <p className={styles.srOnly} role="status">
                {view.visibleCount} assignments shown
              </p>
              {view.groups.map((group) => (
                <section
                  key={JSON.stringify([group.classId, group.sourceKey])}
                  className={styles.group}
                  aria-label={`${group.className} · ${group.sourceTitle}`}
                >
                  <div className={styles.groupHead}>
                    <h3>{group.className}</h3>
                    <p className={styles.small}>{group.sourceTitle}</p>
                  </div>
                  <ul className={styles.rows}>
                    {group.lessons.map((lesson) => (
                      <li
                        key={lesson.id}
                        className={styles.assignmentRow}
                        data-assignment-id={lesson.id}
                        data-session-id={lesson.session?.id}
                      >
                        <div className={styles.stack}>
                          <div className={styles.titleRow}>
                            <Link
                              className={styles.assignmentTitle}
                              href={overviewHref(lesson.id)}
                              prefetch={false}
                            >
                              {lesson.title}
                            </Link>
                            <LearningStatus lesson={lesson} />
                          </div>
                          <p className={styles.small}>{lesson.sourceSection}</p>
                          <PracticeCoverage lesson={lesson} />
                          {lesson.lastPracticedAt && (
                            <p className={styles.small}>
                              Last response{" "}
                              <LocalTime value={lesson.lastPracticedAt} />
                            </p>
                          )}
                        </div>
                        <div className={styles.actions}>{action(lesson)}</div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {!view.visibleCount && (
                <div className={styles.empty}>
                  <p>No assignments match these filters.</p>
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={() => setSelection(allLearning)}
                  >
                    Clear filters
                  </button>
                </div>
              )}
              <p className={styles.footnote}>
                Topic counts reflect submitted practice, not correctness or
                mastery. “Session complete” describes the latest session.
              </p>
            </section>
          )}
        </div>
        <aside className={styles.aside}>
          <section className={styles.sideCard}>
            <h2>Your saved work</h2>
            <p className={styles.small}>
              Revisit earlier sessions in your notebook.
            </p>
            <Link href="/study/history" prefetch={false}>
              Open your notebook →
            </Link>
          </section>
          <WorkVisibility />
        </aside>
      </div>
    </div>
  );
}
